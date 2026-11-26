// -----------------------------------------------------------------------------
// Value mappings between the Advantage Air API and the Gladys enums.
//
// The Gladys values mirror server/utils/constants.js of the Gladys repository
// (AC_MODE, AC_FAN_SPEED, COVER_STATE): the SDK exports the categories and
// types, not these value enums.
// -----------------------------------------------------------------------------

export const AC_MODE = { AUTO: 0, COOLING: 1, HEATING: 2, DRYING: 3, FAN: 4 };
export const AC_FAN_SPEED = { AUTO: 0, LOW: 1, MID: 3, HIGH: 5 };
export const COVER_STATE = { STOP: 0, OPEN: 1, CLOSE: -1 };

// Advantage Air mode -> Gladys AC_MODE. `myauto` is the MyAuto mode of the
// systems that support it (info.myAutoModeEnabled).
export const MODES = [
  { aa: 'cool', gladys: AC_MODE.COOLING, label: 'Cool' },
  { aa: 'heat', gladys: AC_MODE.HEATING, label: 'Heat' },
  { aa: 'vent', gladys: AC_MODE.FAN, label: 'Fan' },
  { aa: 'dry', gladys: AC_MODE.DRYING, label: 'Dry' },
  { aa: 'myauto', gladys: AC_MODE.AUTO, label: 'MyAuto' },
];

// Advantage Air fan speed -> Gladys AC_FAN_SPEED. `autoAA` is the MyFan
// automatic speed (info.aaAutoFanModeEnabled), `auto` the older automatic
// speed of the indoor unit itself.
export const FAN_SPEEDS = [
  { aa: 'low', gladys: AC_FAN_SPEED.LOW, label: 'Low' },
  { aa: 'medium', gladys: AC_FAN_SPEED.MID, label: 'Medium' },
  { aa: 'high', gladys: AC_FAN_SPEED.HIGH, label: 'High' },
  { aa: 'auto', gladys: AC_FAN_SPEED.AUTO, label: 'Auto' },
];

// Set points the Advantage Air controllers accept, in °C.
export const TEMPERATURE_RANGE = { min: 16, max: 32 };

// Countdown timers (countDownToOn / countDownToOff), in minutes.
export const TIMER_RANGE = { min: 0, max: 720 };

// MyThings channel types (channelDipState), as the tablet reports them.
export const THING_TYPES = {
  BLIND: [1, 2],
  GARAGE_DOOR: [3],
  DIMMABLE_LIGHT: [4],
  LIGHT: [5],
};

// Human labels, used by the widgets and the scene events.
export const MODE_LABELS = {
  cool: { en: 'Cool', fr: 'Froid', de: 'Kühlen', es: 'Frío' },
  heat: { en: 'Heat', fr: 'Chaud', de: 'Heizen', es: 'Calor' },
  vent: { en: 'Fan', fr: 'Ventilation', de: 'Lüften', es: 'Ventilación' },
  dry: { en: 'Dry', fr: 'Déshumidification', de: 'Entfeuchten', es: 'Deshumidificar' },
  myauto: { en: 'MyAuto', fr: 'MyAuto', de: 'MyAuto', es: 'MyAuto' },
};

export const FAN_LABELS = {
  low: { en: 'Low', fr: 'Faible', de: 'Niedrig', es: 'Baja' },
  medium: { en: 'Medium', fr: 'Moyenne', de: 'Mittel', es: 'Media' },
  high: { en: 'High', fr: 'Forte', de: 'Hoch', es: 'Alta' },
  auto: { en: 'Auto', fr: 'Auto', de: 'Auto', es: 'Auto' },
  autoAA: { en: 'MyFan', fr: 'MyFan', de: 'MyFan', es: 'MyFan' },
};

export function modeToGladys(aaMode) {
  return MODES.find((mode) => mode.aa === aaMode)?.gladys ?? null;
}

export function modeFromGladys(value) {
  const mode = MODES.find((entry) => entry.gladys === Number(value));
  if (!mode) {
    throw new Error(`Unsupported air conditioning mode: ${value}`);
  }
  return mode.aa;
}

export function fanToGladys(aaFan) {
  if (aaFan === 'autoAA') {
    return AC_FAN_SPEED.AUTO;
  }
  return FAN_SPEEDS.find((fan) => fan.aa === aaFan)?.gladys ?? null;
}

/**
 * Gladys fan speed -> Advantage Air. The automatic speed is MyFan (`autoAA`)
 * on the systems that have it, the unit's own `auto` otherwise. The
 * intermediate Gladys speeds snap to the closest one the unit knows.
 */
export function fanFromGladys(value, info = {}) {
  const speed = Number(value);
  if (!Number.isFinite(speed)) {
    throw new Error(`Unsupported fan speed: ${value}`);
  }
  if (speed === AC_FAN_SPEED.AUTO) {
    return info.aaAutoFanModeEnabled ? 'autoAA' : 'auto';
  }
  if (speed <= 2) {
    return 'low';
  }
  if (speed <= 4) {
    return 'medium';
  }
  return 'high';
}

/**
 * Damper opening: the controllers accept 5 to 100 %, by steps of 5.
 */
export function damperValue(value) {
  const percent = Math.round(Number(value) / 5) * 5;
  if (!Number.isFinite(percent)) {
    throw new Error(`Invalid opening: ${value}`);
  }
  return Math.min(100, Math.max(5, percent));
}

export function clampTemperature(value) {
  const temperature = Number(value);
  if (!Number.isFinite(temperature)) {
    throw new Error(`Invalid temperature: ${value}`);
  }
  // The controllers work by half degrees at best.
  const rounded = Math.round(temperature * 2) / 2;
  return Math.min(TEMPERATURE_RANGE.max, Math.max(TEMPERATURE_RANGE.min, rounded));
}

export function clampTimer(value) {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) {
    throw new Error(`Invalid timer: ${value}`);
  }
  return Math.min(TIMER_RANGE.max, Math.max(TIMER_RANGE.min, minutes));
}
