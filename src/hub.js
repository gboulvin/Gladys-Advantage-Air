// -----------------------------------------------------------------------------
// The hub: the integration's view of ONE Advantage Air system.
//
// It owns the API client, keeps the last snapshot of the tablet data, and:
//   - refreshes it on a timer (the tablet has no push channel), publishing
//     only the states that changed (publishChangedStates) and the scene events
//     of the transitions it sees;
//   - runs the commands coming from Gladys (onSetValue), the scene actions and
//     the widget buttons, then re-reads the tablet to publish the CONFIRMED
//     states.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { AdvantageAirClient } from './advantageAir.js';
import { isConfigured } from './config.js';
import {
  buildDiscoveredDevices,
  collectStates,
  describeSystem,
  findBinding,
  findEntry,
} from './devices/index.js';
import { computeSceneEvents } from './events.js';

const logger = createLogger({ name: 'hub' });

// An unchanged state is still re-sent every 30 minutes, so it stays dated.
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;
// The tablet applies a change in about a second: re-read it after that.
const CONFIRM_DELAY_MS = 1_500;

// Structure of the devices (not their states): a change means re-publishing
// the discovered devices (a zone added, a light renamed...).
function structureOf(entries) {
  return JSON.stringify(
    buildDiscoveredDevices(entries).map((device) => ({
      ...device,
      features: device.features.map(({ external_id, name, read_only, supported_options }) => ({
        external_id,
        name,
        read_only,
        supported_options,
      })),
    })),
  );
}

export class AdvantageAirHub {
  /**
   * @param {object} gladys the SDK instance (or the fake Gladys of the tests)
   * @param {object} [options]
   * @param {Function} [options.createClient] (config) => client, for the tests
   * @param {number} [options.confirmDelayMs]
   */
  constructor(gladys, { createClient, confirmDelayMs = CONFIRM_DELAY_MS } = {}) {
    this.gladys = gladys;
    this.createClient =
      createClient ??
      ((config) => new AdvantageAirClient({ host: config.host, port: config.port }));
    this.confirmDelayMs = confirmDelayMs;
    this.config = null;
    this.client = null;
    this.data = null;
    this.entries = [];
    this.structure = null;
    this.lastError = null;
    this.lastUpdate = null;
    this.timer = null;
    this.confirmTimer = null;
    this.refreshing = null;
    this.listeners = new Set();
  }

  /**
   * Apply a (new) configuration. Forgets the previous system when the
   * address changed.
   */
  configure(config) {
    const changed =
      !this.config || this.config.host !== config.host || this.config.port !== config.port;
    this.config = config;
    if (changed) {
      this.client = isConfigured(config) ? this.createClient(config) : null;
      this.data = null;
      this.entries = [];
      this.structure = null;
      this.lastError = null;
    }
    if (this.timer) {
      this.start();
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  /**
   * Called after every refresh with `{ changed, error }`.
   */
  onRefresh(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start the periodic refresh (restarts it with the current interval).
   */
  start() {
    this.stop();
    const intervalMs = (this.config?.refresh_interval ?? 15) * 1000;
    this.timer = setInterval(() => {
      this.refresh().catch(() => {});
    }, intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }
  }

  /**
   * Read the tablet without publishing anything (connection test).
   */
  async fetch() {
    if (!this.client) {
      throw new Error('No tablet address configured');
    }
    return this.client.getSystemData();
  }

  /**
   * Read the tablet, then publish what changed. Concurrent calls share the
   * same read.
   * @returns {Promise<{ structureChanged: boolean }>}
   */
  refresh() {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  async doRefresh() {
    if (!this.client) {
      return { structureChanged: false };
    }
    let data;
    try {
      data = await this.client.getSystemData();
    } catch (err) {
      const firstFailure = this.lastError === null;
      this.lastError = err;
      if (firstFailure) {
        logger.warn(`Cannot read the tablet: ${err.message}`);
      }
      this.notify({ changed: false, error: err });
      throw err;
    }
    const recovered = this.lastError !== null;
    if (recovered) {
      logger.info('The tablet answers again');
    }
    this.lastError = null;
    this.lastUpdate = new Date();

    const previous = this.data;
    const entries = describeSystem(this.gladys, data);
    const structure = structureOf(entries);
    const structureChanged = structure !== this.structure;
    this.data = data;
    this.entries = entries;
    this.structure = structure;

    if (structureChanged) {
      logger.info(`System read: ${entries.length} device(s)`);
      await this.gladys.publishDiscoveredDevices(buildDiscoveredDevices(entries));
    }
    await this.gladys.publishChangedStates(collectStates(entries, data), {
      heartbeat: STATE_HEARTBEAT_MS,
    });
    for (const event of computeSceneEvents(entries, previous, data)) {
      try {
        await this.gladys.publishSceneEvent(event.key, event.data);
      } catch (err) {
        logger.error(`Scene event ${event.key} refused`, err);
      }
    }
    const changed =
      structureChanged || recovered || JSON.stringify(previous) !== JSON.stringify(data);
    this.notify({ changed, error: null });
    return { structureChanged };
  }

  notify(change) {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (err) {
        logger.error('Refresh listener failed', err);
      }
    }
  }

  /**
   * Make sure a snapshot exists (first command before the first refresh).
   */
  async ensureData() {
    if (!this.data) {
      await this.refresh();
    }
    return this.data;
  }

  /**
   * Run a Gladys command on a feature.
   * @returns {Promise<boolean>} false when the command has nothing to change
   */
  async setValue(featureExternalId, value) {
    await this.ensureData();
    const found = findBinding(this.entries, featureExternalId);
    if (!found) {
      throw new Error(`Unknown feature ${featureExternalId}`);
    }
    if (typeof found.binding.write !== 'function') {
      throw new Error(`${found.binding.feature.name} is read-only`);
    }
    const command = found.binding.write(value, this.data);
    if (!command) {
      return false;
    }
    await this.send(command);
    // Show the requested value now, the confirmed one follows the re-read.
    // Through publishChangedStates, so that a re-read that finds the old
    // value (the unit refused it) publishes it again.
    await this.gladys
      .publishChangedStates([
        { device_feature_external_id: featureExternalId, state: Number(value) },
      ])
      .catch(() => {});
    return true;
  }

  /**
   * Send raw changes (scene actions, widgets) and schedule a re-read.
   * @param {...{endpoint: string, change: object}} commands
   */
  async send(...commands) {
    if (!this.client) {
      throw new Error('No tablet address configured');
    }
    for (const { endpoint, change } of commands) {
      logger.info(`${endpoint} <- ${JSON.stringify(change)}`);
      await this.client.change(endpoint, change);
    }
    this.scheduleConfirm();
  }

  scheduleConfirm() {
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
    }
    this.confirmTimer = setTimeout(() => {
      this.confirmTimer = null;
      this.refresh().catch(() => {});
    }, this.confirmDelayMs);
    this.confirmTimer.unref?.();
  }

  entry(externalId) {
    return findEntry(this.entries, externalId);
  }
}
