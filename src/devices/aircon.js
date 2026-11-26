// -----------------------------------------------------------------------------
// Device type: AIR CONDITIONER (one per `aircons.acN` entry of the tablet).
//
// Features: power, mode, target temperature, fan speed, the two countdown
// timers and, when the system has one, the fresh air damper.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { ENDPOINTS } from '../advantageAir.js';
import {
  FAN_SPEEDS,
  MODES,
  TEMPERATURE_RANGE,
  TIMER_RANGE,
  clampTemperature,
  clampTimer,
  fanFromGladys,
  fanToGladys,
  modeFromGladys,
  modeToGladys,
} from './mappings.js';

export const AIRCON_TYPE = 'aircon';

export const AIRCON_FEATURES = {
  POWER: 'power',
  MODE: 'mode',
  TARGET_TEMPERATURE: 'target-temperature',
  FAN_SPEED: 'fan-speed',
  TIMER_ON: 'timer-on',
  TIMER_OFF: 'timer-off',
  FRESH_AIR: 'fresh-air',
};

const infoOf = (data, acKey) => data?.aircons?.[acKey]?.info;

function infoChange(acKey, info) {
  return { endpoint: ENDPOINTS.AIRCON, change: { [acKey]: { info } } };
}

export function hasFreshAir(info) {
  return info?.freshAirStatus !== undefined && info.freshAirStatus !== 'none';
}

/**
 * Describe one air conditioner: its discovery payload and the bindings
 * between its features and the tablet data.
 */
export function describeAircon(gladys, { platformId, acKey, data }) {
  const info = infoOf(data, acKey) ?? {};
  const ids = gladys.externalIds(AIRCON_TYPE, `${platformId}-${acKey}`);
  const read = (fn) => (snapshot) => {
    const current = infoOf(snapshot, acKey);
    return current ? fn(current) : null;
  };

  const modes = MODES.filter((mode) => mode.aa !== 'myauto' || info.myAutoModeEnabled);
  const fans = FAN_SPEEDS.filter(
    (fan) => fan.aa !== 'auto' || info.aaAutoFanModeEnabled || info.fan === 'auto',
  );

  const bindings = [
    {
      feature: {
        name: 'Power',
        external_id: ids.feature(AIRCON_FEATURES.POWER),
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.state === 'on' ? 1 : 0)),
      write: (value) => infoChange(acKey, { state: Number(value) === 1 ? 'on' : 'off' }),
    },
    {
      feature: {
        name: 'Mode',
        external_id: ids.feature(AIRCON_FEATURES.MODE),
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.MODE,
        min: 0,
        max: 4,
        read_only: false,
        has_feedback: true,
        keep_history: true,
        supported_options: modes.map((mode, index) => ({
          value: mode.gladys,
          label: mode.label,
          sort_order: index,
        })),
      },
      read: read((current) => modeToGladys(current.mode)),
      write: (value) => infoChange(acKey, { mode: modeFromGladys(value) }),
    },
    {
      feature: {
        name: 'Target temperature',
        external_id: ids.feature(AIRCON_FEATURES.TARGET_TEMPERATURE),
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.TARGET_TEMPERATURE,
        unit: DEVICE_FEATURE_UNITS.CELSIUS,
        min: TEMPERATURE_RANGE.min,
        max: TEMPERATURE_RANGE.max,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (Number.isFinite(current.setTemp) ? current.setTemp : null)),
      write: (value) => infoChange(acKey, { setTemp: clampTemperature(value) }),
    },
    {
      feature: {
        name: 'Fan speed',
        external_id: ids.feature(AIRCON_FEATURES.FAN_SPEED),
        category: DEVICE_FEATURE_CATEGORIES.AIR_CONDITIONING,
        type: DEVICE_FEATURE_TYPES.AIR_CONDITIONING.FAN_SPEED,
        min: 0,
        max: 7,
        read_only: false,
        has_feedback: true,
        keep_history: true,
        supported_options: fans.map((fan, index) => ({
          value: fan.gladys,
          label: fan.aa === 'auto' && info.aaAutoFanModeEnabled ? 'MyFan' : fan.label,
          sort_order: index,
        })),
      },
      read: read((current) => fanToGladys(current.fan)),
      write: (value, snapshot) =>
        infoChange(acKey, { fan: fanFromGladys(value, infoOf(snapshot, acKey) ?? info) }),
    },
    {
      feature: {
        name: 'Turn on timer',
        external_id: ids.feature(AIRCON_FEATURES.TIMER_ON),
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        min: TIMER_RANGE.min,
        max: TIMER_RANGE.max,
        read_only: false,
        has_feedback: true,
        keep_history: false,
      },
      read: read((current) => (Number.isFinite(current.countDownToOn) ? current.countDownToOn : 0)),
      write: (value) => infoChange(acKey, { countDownToOn: clampTimer(value) }),
    },
    {
      feature: {
        name: 'Turn off timer',
        external_id: ids.feature(AIRCON_FEATURES.TIMER_OFF),
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        min: TIMER_RANGE.min,
        max: TIMER_RANGE.max,
        read_only: false,
        has_feedback: true,
        keep_history: false,
      },
      read: read((current) =>
        Number.isFinite(current.countDownToOff) ? current.countDownToOff : 0,
      ),
      write: (value) => infoChange(acKey, { countDownToOff: clampTimer(value) }),
    },
  ];

  if (hasFreshAir(info)) {
    bindings.push({
      feature: {
        name: 'Fresh air',
        external_id: ids.feature(AIRCON_FEATURES.FRESH_AIR),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.freshAirStatus === 'on' ? 1 : 0)),
      write: (value) => infoChange(acKey, { freshAirStatus: Number(value) === 1 ? 'on' : 'off' }),
    });
  }

  return {
    kind: AIRCON_TYPE,
    externalId: ids.device,
    acKey,
    name: info.name || acKey.toUpperCase(),
    featureIds: Object.fromEntries(
      Object.entries(AIRCON_FEATURES).map(([key, featureKey]) => [key, ids.feature(featureKey)]),
    ),
    bindings,
  };
}
