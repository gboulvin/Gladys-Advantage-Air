// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// Operations a scene author places in a scene, with parameters and a result.
// The standard "control a device" scene action already sets ONE feature; these
// set several at once, in a single change sent to the tablet (power + mode +
// fan + set point), or reach what no feature carries (open every zone).
//
//   - `fields` arrive RESOLVED (scene variables substituted, defaults
//     applied); a `"source": "devices"` field is the chosen device external_id;
//   - the resolved object holds the declared `outputs` (scalars only);
//   - throwing fails THIS action only: the scene logs it and continues.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { ENDPOINTS } from './advantageAir.js';
import { AIRCON_TYPE, ZONE_TYPE } from './devices/index.js';
import { hasSensor, supportsMyZone } from './devices/zone.js';
import {
  clampTemperature,
  clampTimer,
  damperValue,
  fanFromGladys,
  AC_FAN_SPEED,
} from './devices/mappings.js';

const logger = createLogger({ name: 'scenes' });

export const UNCHANGED = 'unchanged';

const FAN_TO_GLADYS = {
  low: AC_FAN_SPEED.LOW,
  medium: AC_FAN_SPEED.MID,
  high: AC_FAN_SPEED.HIGH,
  auto: AC_FAN_SPEED.AUTO,
};

const isSet = (value) =>
  value !== undefined && value !== null && value !== '' && value !== UNCHANGED;

async function entryOf(hub, externalId, kind) {
  await hub.ensureData();
  const entry = hub.entry(externalId);
  if (!entry || entry.kind !== kind) {
    const what = kind === AIRCON_TYPE ? 'an air conditioner' : 'a zone';
    throw new Error(`The chosen device is not ${what} of this Advantage Air system`);
  }
  return entry;
}

const infoOf = (hub, acKey) => hub.data?.aircons?.[acKey]?.info ?? {};
const zonesOf = (hub, acKey) => hub.data?.aircons?.[acKey]?.zones ?? {};

export const SCENE_ACTIONS = {
  /**
   * Power, mode, fan speed and set point of a unit, in one change.
   */
  async control_aircon(hub, { fields }) {
    const entry = await entryOf(hub, fields.device, AIRCON_TYPE);
    const info = {};
    if (isSet(fields.power)) {
      info.state = fields.power === 'on' ? 'on' : 'off';
    }
    if (isSet(fields.mode)) {
      info.mode = fields.mode;
    }
    if (isSet(fields.fan)) {
      info.fan = fanFromGladys(FAN_TO_GLADYS[fields.fan], infoOf(hub, entry.acKey));
    }
    if (isSet(fields.target_temperature)) {
      info.setTemp = clampTemperature(fields.target_temperature);
    }
    if (Object.keys(info).length === 0) {
      return { changed: false };
    }
    logger.info(`Scene action control_aircon <- ${entry.name}`);
    await hub.send({ endpoint: ENDPOINTS.AIRCON, change: { [entry.acKey]: { info } } });
    return { changed: true };
  },

  /**
   * Open or close a zone, set its opening or its set point.
   */
  async control_zone(hub, { fields }) {
    const entry = await entryOf(hub, fields.device, ZONE_TYPE);
    const zone = zonesOf(hub, entry.acKey)[entry.zoneKey] ?? {};
    const body = {};
    if (isSet(fields.state)) {
      body.state = fields.state === 'open' ? 'open' : 'close';
    }
    if (isSet(fields.opening) && !hasSensor(zone)) {
      body.value = damperValue(fields.opening);
    }
    if (isSet(fields.target_temperature) && hasSensor(zone)) {
      body.setTemp = clampTemperature(fields.target_temperature);
    }
    if (Object.keys(body).length === 0) {
      return { changed: false };
    }
    logger.info(`Scene action control_zone <- ${entry.name}`);
    await hub.send({
      endpoint: ENDPOINTS.AIRCON,
      change: { [entry.acKey]: { zones: { [entry.zoneKey]: body } } },
    });
    return { changed: true };
  },

  /**
   * Start (or cancel, with 0 minutes) the turn on / turn off timer.
   */
  async set_timer(hub, { fields }) {
    const entry = await entryOf(hub, fields.device, AIRCON_TYPE);
    const key = fields.timer === 'on' ? 'countDownToOn' : 'countDownToOff';
    const minutes = clampTimer(fields.minutes ?? 0);
    logger.info(`Scene action set_timer <- ${entry.name} ${key}=${minutes}`);
    await hub.send({
      endpoint: ENDPOINTS.AIRCON,
      change: { [entry.acKey]: { info: { [key]: minutes } } },
    });
    return { changed: true };
  },

  /**
   * Make a zone the MyZone: the unit follows its temperature.
   */
  async set_myzone(hub, { fields }) {
    const entry = await entryOf(hub, fields.device, ZONE_TYPE);
    const info = infoOf(hub, entry.acKey);
    const zone = zonesOf(hub, entry.acKey)[entry.zoneKey] ?? {};
    if (!supportsMyZone(info, zone)) {
      return { changed: false };
    }
    logger.info(`Scene action set_myzone <- ${entry.name}`);
    await hub.send({
      endpoint: ENDPOINTS.AIRCON,
      change: { [entry.acKey]: { info: { myZone: zone.number } } },
    });
    return { changed: true };
  },

  /**
   * Open or close every zone of a unit at once.
   */
  async set_all_zones(hub, { fields }) {
    const entry = await entryOf(hub, fields.device, AIRCON_TYPE);
    const state = fields.state === 'open' ? 'open' : 'close';
    const count = await setAllZones(hub, entry.acKey, state);
    return { changed: count > 0, zones: count };
  },
};

/**
 * Open or close every (configured) zone of a unit, in one change.
 * @returns {Promise<number>} the number of zones changed
 */
export async function setAllZones(hub, acKey, state) {
  await hub.ensureData();
  const zoneKeys = hub.entries
    .filter((entry) => entry.kind === ZONE_TYPE && entry.acKey === acKey)
    .map((entry) => entry.zoneKey);
  const zones = zonesOf(hub, acKey);
  const changes = Object.fromEntries(
    zoneKeys
      .filter((zoneKey) => zones[zoneKey]?.state !== state)
      .map((zoneKey) => [zoneKey, { state }]),
  );
  const count = Object.keys(changes).length;
  if (count > 0) {
    logger.info(`${state === 'open' ? 'Opening' : 'Closing'} ${count} zone(s) of ${acKey}`);
    await hub.send({ endpoint: ENDPOINTS.AIRCON, change: { [acKey]: { zones: changes } } });
  }
  return count;
}
