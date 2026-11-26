// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+).
//
// Two widgets, each bound to one air conditioner through its `device` setting
// (a `"source": "devices"` select; left empty, the first unit is used):
//   - `aircon_status`: set point and MyZone temperature as live tiles, then
//     power, mode, fan, filter, errors and timers, and a power button;
//   - `zones`: every zone with its state, opening and temperature, and two
//     buttons to open or close them all.
//
// The content is declarative (validated by `validateWidgetContent` in the
// tests). The hub nudges the widgets whenever the tablet data changes.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { AIRCON_TYPE, ZONE_TYPE } from './devices/index.js';
import { FAN_LABELS, MODE_LABELS } from './devices/mappings.js';
import { hasSensor } from './devices/zone.js';
import { setAllZones } from './scenes.js';

const logger = createLogger({ name: 'widgets' });

export const AIRCON_STATUS_WIDGET = 'aircon_status';
export const ZONES_WIDGET = 'zones';

const ZONES_ACTIONS = { OPEN_ALL: 'open_all', CLOSE_ALL: 'close_all' };

const TTL_SECONDS = 60;

const T = {
  notConfigured: {
    en: 'Enter the address of your Advantage Air tablet in the integration configuration.',
    fr: "Saisissez l'adresse de votre tablette Advantage Air dans la configuration de l'intégration.",
    de: 'Geben Sie die Adresse Ihres Advantage-Air-Tablets in der Konfiguration der Integration ein.',
    es: 'Introduzca la dirección de su tableta Advantage Air en la configuración de la integración.',
  },
  unreachable: {
    en: 'The Advantage Air tablet does not answer. Check that it is on and connected to the network.',
    fr: 'La tablette Advantage Air ne répond pas. Vérifiez qu’elle est allumée et connectée au réseau.',
    de: 'Das Advantage-Air-Tablet antwortet nicht. Prüfen Sie, ob es eingeschaltet und verbunden ist.',
    es: 'La tableta Advantage Air no responde. Compruebe que está encendida y conectada a la red.',
  },
  noAircon: {
    en: 'No air conditioner found on this system.',
    fr: 'Aucun climatiseur trouvé sur ce système.',
    de: 'Keine Klimaanlage in diesem System gefunden.',
    es: 'No se encontró ningún aire acondicionado en este sistema.',
  },
  noZone: {
    en: 'This air conditioner has no zone.',
    fr: "Ce climatiseur n'a aucune zone.",
    de: 'Diese Klimaanlage hat keine Zone.',
    es: 'Este aire acondicionado no tiene zonas.',
  },
  setPoint: { en: 'Set point', fr: 'Consigne', de: 'Sollwert', es: 'Consigna' },
  myZone: { en: 'MyZone', fr: 'MyZone', de: 'MyZone', es: 'MyZone' },
  power: { en: 'Power', fr: 'Marche', de: 'Betrieb', es: 'Encendido' },
  on: { en: 'On', fr: 'Allumé', de: 'Ein', es: 'Encendido' },
  off: { en: 'Off', fr: 'Éteint', de: 'Aus', es: 'Apagado' },
  mode: { en: 'Mode', fr: 'Mode', de: 'Modus', es: 'Modo' },
  fan: { en: 'Fan', fr: 'Ventilation', de: 'Lüfter', es: 'Ventilador' },
  filter: { en: 'Filter', fr: 'Filtre', de: 'Filter', es: 'Filtro' },
  filterOk: { en: 'OK', fr: 'OK', de: 'OK', es: 'OK' },
  filterClean: {
    en: 'Needs cleaning',
    fr: 'À nettoyer',
    de: 'Reinigung nötig',
    es: 'Necesita limpieza',
  },
  error: { en: 'Error', fr: 'Erreur', de: 'Fehler', es: 'Error' },
  none: { en: 'None', fr: 'Aucune', de: 'Keiner', es: 'Ninguno' },
  timerOn: { en: 'Turns on in', fr: "S'allume dans", de: 'Schaltet ein in', es: 'Se enciende en' },
  timerOff: { en: 'Turns off in', fr: "S'éteint dans", de: 'Schaltet aus in', es: 'Se apaga en' },
  turnOn: { en: 'Turn on', fr: 'Allumer', de: 'Einschalten', es: 'Encender' },
  turnOff: { en: 'Turn off', fr: 'Éteindre', de: 'Ausschalten', es: 'Apagar' },
  openAll: { en: 'Open all', fr: 'Tout ouvrir', de: 'Alle öffnen', es: 'Abrir todas' },
  closeAll: { en: 'Close all', fr: 'Tout fermer', de: 'Alle schließen', es: 'Cerrar todas' },
  open: { en: 'Open', fr: 'Ouverte', de: 'Offen', es: 'Abierta' },
  closed: { en: 'Closed', fr: 'Fermée', de: 'Geschlossen', es: 'Cerrada' },
};

// Join multi-language parts: `localized(T.open, ' · 80 %')`.
function localized(...parts) {
  const languages = ['en', 'fr', 'de', 'es'];
  return Object.fromEntries(
    languages.map((language) => [
      language,
      parts.map((part) => (typeof part === 'string' ? part : (part[language] ?? part.en))).join(''),
    ]),
  );
}

function message(text) {
  return { ttl_seconds: TTL_SECONDS, components: [{ type: 'text', text, variant: 'body' }] };
}

/**
 * The unit a widget instance shows: the one of its `device` setting, or the
 * first one. A zone picked by mistake leads to its unit.
 */
function airconFor(hub, settings = {}) {
  const chosen = settings.device ? hub.entry(settings.device) : undefined;
  if (chosen?.kind === AIRCON_TYPE) {
    return chosen;
  }
  if (chosen?.kind === ZONE_TYPE) {
    return hub.entries.find((e) => e.kind === AIRCON_TYPE && e.acKey === chosen.acKey);
  }
  return hub.entries.find((e) => e.kind === AIRCON_TYPE);
}

// A content for the states where there is nothing to show yet.
async function unavailableContent(hub) {
  if (!hub.isConfigured()) {
    return message(T.notConfigured);
  }
  try {
    await hub.ensureData();
  } catch {
    return message(T.unreachable);
  }
  return hub.lastError ? message(T.unreachable) : null;
}

const formatMinutes = (minutes) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
    : `${minutes} min`;

function airconStatusContent(hub, aircon) {
  const info = hub.data.aircons[aircon.acKey]?.info ?? {};
  const isOn = info.state === 'on';
  const components = [
    {
      type: 'value',
      label: T.setPoint,
      icon: 'thermometer',
      device_feature: aircon.featureIds.TARGET_TEMPERATURE,
    },
  ];

  const myZone = hub.entries.find(
    (e) =>
      e.kind === ZONE_TYPE &&
      e.acKey === aircon.acKey &&
      hub.data.aircons[aircon.acKey]?.zones?.[e.zoneKey]?.number === info.myZone &&
      hasSensor(hub.data.aircons[aircon.acKey].zones[e.zoneKey]),
  );
  if (myZone && info.myZone) {
    components.push({
      type: 'value',
      label: localized(
        T.myZone,
        ` ${hub.data.aircons[aircon.acKey].zones[myZone.zoneKey].name ?? ''}`,
      ),
      icon: 'home',
      device_feature: myZone.featureIds.TEMPERATURE,
    });
  }

  const items = [
    {
      label: T.power,
      icon: 'power',
      value: isOn ? T.on : T.off,
      color: isOn ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    },
    {
      label: T.mode,
      icon: 'sliders',
      value: MODE_LABELS[info.mode] ?? String(info.mode ?? '-'),
      color: info.mode === 'heat' ? WIDGET_COLORS.WARNING : WIDGET_COLORS.INFO,
    },
    {
      label: T.fan,
      icon: 'wind',
      value: FAN_LABELS[info.fan] ?? String(info.fan ?? '-'),
      color: WIDGET_COLORS.NEUTRAL,
    },
    {
      label: T.filter,
      icon: 'filter',
      value: Number(info.filterCleanStatus) === 1 ? T.filterClean : T.filterOk,
      color: Number(info.filterCleanStatus) === 1 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    },
  ];
  const errorCode = String(info.airconErrorCode ?? '').trim();
  items.push({
    label: T.error,
    icon: 'alert-triangle',
    value: errorCode || T.none,
    color: errorCode ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
  });
  if (Number(info.countDownToOn) > 0) {
    items.push({
      label: T.timerOn,
      icon: 'clock',
      value: formatMinutes(Number(info.countDownToOn)),
      color: WIDGET_COLORS.INFO,
    });
  }
  if (Number(info.countDownToOff) > 0) {
    items.push({
      label: T.timerOff,
      icon: 'clock',
      value: formatMinutes(Number(info.countDownToOff)),
      color: WIDGET_COLORS.INFO,
    });
  }
  components.push({ type: 'status', items });

  // A device-bound button: the tap reaches onSetValue like the device card.
  components.push({
    type: 'button',
    label: isOn ? T.turnOff : T.turnOn,
    icon: 'power',
    style: isOn ? 'secondary' : 'primary',
    device_feature: aircon.featureIds.POWER,
    value: isOn ? 0 : 1,
  });

  return { ttl_seconds: TTL_SECONDS, components };
}

function zonesContent(hub, aircon) {
  const zones = hub.data.aircons[aircon.acKey]?.zones ?? {};
  const zoneEntries = hub.entries.filter((e) => e.kind === ZONE_TYPE && e.acKey === aircon.acKey);
  if (zoneEntries.length === 0) {
    return message(T.noZone);
  }
  const items = zoneEntries.slice(0, 10).map((entry) => {
    const zone = zones[entry.zoneKey] ?? {};
    const isOpen = zone.state === 'open';
    const parts = [isOpen ? T.open : T.closed];
    if (isOpen && Number.isFinite(zone.value)) {
      parts.push(` · ${zone.value} %`);
    }
    if (hasSensor(zone) && Number.isFinite(zone.measuredTemp) && zone.measuredTemp !== 0) {
      parts.push(` · ${zone.measuredTemp} °C`);
    }
    return {
      label: String(zone.name || entry.zoneKey).slice(0, 40),
      icon: 'wind',
      value: localized(...parts),
      color: isOpen ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    };
  });
  return {
    ttl_seconds: TTL_SECONDS,
    components: [
      { type: 'status', items },
      {
        type: 'button',
        label: T.openAll,
        icon: 'unlock',
        style: 'secondary',
        action: { key: ZONES_ACTIONS.OPEN_ALL, params: { device: aircon.externalId } },
      },
      {
        type: 'button',
        label: T.closeAll,
        icon: 'lock',
        style: 'secondary',
        action: {
          key: ZONES_ACTIONS.CLOSE_ALL,
          params: { device: aircon.externalId },
          confirm: true,
        },
      },
    ],
  };
}

export const WIDGETS = {
  [AIRCON_STATUS_WIDGET]: {
    async get(hub, { settings }) {
      logger.debug(`onWidgetGet <- ${AIRCON_STATUS_WIDGET}`);
      const unavailable = await unavailableContent(hub);
      if (unavailable) {
        return unavailable;
      }
      const aircon = airconFor(hub, settings);
      return aircon ? airconStatusContent(hub, aircon) : message(T.noAircon);
    },
  },

  [ZONES_WIDGET]: {
    async get(hub, { settings }) {
      logger.debug(`onWidgetGet <- ${ZONES_WIDGET}`);
      const unavailable = await unavailableContent(hub);
      if (unavailable) {
        return unavailable;
      }
      const aircon = airconFor(hub, settings);
      return aircon ? zonesContent(hub, aircon) : message(T.noAircon);
    },

    // `params` are the ones the content declared: never user input.
    async action(hub, { actionKey, params }) {
      logger.info(`onWidgetAction <- ${ZONES_WIDGET}.${actionKey}`);
      if (actionKey !== ZONES_ACTIONS.OPEN_ALL && actionKey !== ZONES_ACTIONS.CLOSE_ALL) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      await hub.ensureData();
      const aircon = hub.entry(params.device);
      if (!aircon || aircon.kind !== AIRCON_TYPE) {
        throw new Error('Unknown air conditioner');
      }
      const open = actionKey === ZONES_ACTIONS.OPEN_ALL;
      const count = await setAllZones(hub, aircon.acKey, open ? 'open' : 'close');
      if (count === 0) {
        return open
          ? {
              en: 'Every zone is already open.',
              fr: 'Toutes les zones sont déjà ouvertes.',
              de: 'Alle Zonen sind bereits offen.',
              es: 'Todas las zonas ya están abiertas.',
            }
          : {
              en: 'Every zone is already closed.',
              fr: 'Toutes les zones sont déjà fermées.',
              de: 'Alle Zonen sind bereits geschlossen.',
              es: 'Todas las zonas ya están cerradas.',
            };
      }
      return open
        ? {
            en: `${count} zone(s) opening.`,
            fr: `Ouverture de ${count} zone(s).`,
            de: `${count} Zone(n) werden geöffnet.`,
            es: `Abriendo ${count} zona(s).`,
          }
        : {
            en: `${count} zone(s) closing.`,
            fr: `Fermeture de ${count} zone(s).`,
            de: `${count} Zone(n) werden geschlossen.`,
            es: `Cerrando ${count} zona(s).`,
          };
    },
  },
};

/**
 * Ask the core to re-pull every widget now (rate-limited core-side to 1 per
 * 10 s per widget, dropped while disconnected).
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
