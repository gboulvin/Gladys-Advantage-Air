// -----------------------------------------------------------------------------
// Entry point of the Advantage Air integration for Gladys Assistant.
//
// This file only wires the SDK to the hub (src/hub.js), which talks to the
// Advantage Air wall tablet over the local network:
//   1. instantiates the SDK (connection, auth, reconnection: handled by it);
//   2. registers the event handlers BEFORE connect();
//   3. connects, reads the tablet and publishes the devices.
//
// Environment variables provided by the Gladys supervisor to the container:
//   GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { isConfigured, normalizeConfig } from './src/config.js';
import { AdvantageAirHub } from './src/hub.js';
import { buildDiscoveredDevices } from './src/devices/index.js';
import { ACTIONS } from './src/actions.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();
const hub = new AdvantageAirHub(gladys);

let connectedStatus = null;

// Mirror the reachability of the tablet in the Configuration screen, and
// nudge the dashboard widgets when the data changed.
hub.onRefresh(({ changed, error }) => {
  reportStatus(error).catch(() => {});
  if (changed) {
    refreshWidgets(gladys);
  }
});

async function reportStatus(error) {
  const connected = !error && hub.isConfigured();
  if (connected === connectedStatus) {
    return;
  }
  connectedStatus = connected;
  if (connected) {
    await gladys.setConnectionStatus(true);
  } else if (!hub.isConfigured()) {
    await gladys.setConnectionStatus(false, {
      en: 'Enter the address of your Advantage Air tablet.',
      fr: "Saisissez l'adresse de votre tablette Advantage Air.",
      de: 'Geben Sie die Adresse Ihres Advantage-Air-Tablets ein.',
      es: 'Introduzca la dirección de su tableta Advantage Air.',
    });
  } else {
    await gladys.setConnectionStatus(false, {
      en: 'The Advantage Air tablet does not answer.',
      fr: 'La tablette Advantage Air ne répond pas.',
      de: 'Das Advantage-Air-Tablet antwortet nicht.',
      es: 'La tableta Advantage Air no responde.',
    });
  }
}

// (Re)apply the configuration: read the tablet right away, then on a timer.
async function applyConfig(rawConfig) {
  const config = normalizeConfig(rawConfig);
  hub.configure(config);
  if (!isConfigured(config)) {
    hub.stop();
    await reportStatus(null);
    return;
  }
  hub.start();
  await hub.refresh().catch(() => {});
  refreshWidgets(gladys);
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> reading the tablet');
  await hub.refresh();
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(hub.entries));
});

// --- Command: the user acts on a controllable feature ------------------------
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
  // Throwing acks the command as failed, with the message.
  await hub.setValue(feature.external_id, value);
});

// --- Manifest actions: buttons in the Configuration screen -------------------
for (const [actionKey, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(actionKey, (fields) => handler(hub, { fields }));
}

// --- Scene actions -----------------------------------------------------------
for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(actionKey, (fields) => handler(hub, { fields }));
}

// --- Dashboard widgets -------------------------------------------------------
for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(widgetKey, (request) => widget.get(hub, request));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(widgetKey, (actionKey, params, { settings }) =>
      widget.action(hub, { actionKey, params, settings }),
    );
  }
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  await applyConfig(newConfig);
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    connectedStatus = null;
    await applyConfig(await gladys.getConfig());
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Logs der Integration.',
        es: 'La inicialización ha fallado, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  hub.stop();
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  hub.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Advantage Air integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
