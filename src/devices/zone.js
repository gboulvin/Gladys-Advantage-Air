// -----------------------------------------------------------------------------
// Device type: ZONE (one per `aircons.acN.zones.zNN` entry of the tablet).
//
// A zone is a motorised damper in the ducts. Two kinds exist:
//   - `type: 0`: no temperature sensor, the user sets the opening (5-100 %);
//   - any other type: a temperature sensor drives the damper to reach the
//     zone set point; the opening is then read-only.
// Zones with a sensor can be the "MyZone" (the zone the unit follows), and
// some sensors also detect motion (motionConfig >= 2).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { ENDPOINTS } from '../advantageAir.js';
import { TEMPERATURE_RANGE, clampTemperature, damperValue } from './mappings.js';

export const ZONE_TYPE = 'zone';

export const ZONE_FEATURES = {
  OPEN: 'open',
  OPENING: 'opening',
  TEMPERATURE: 'temperature',
  TARGET_TEMPERATURE: 'target-temperature',
  MY_ZONE: 'myzone',
  MOTION: 'motion',
  SIGNAL: 'signal',
};

// Value of `zone.motion` when the sensor sees someone (same rule as the Home
// Assistant integration).
export const MOTION_DETECTED_VALUE = 20;

const zoneOf = (data, acKey, zoneKey) => data?.aircons?.[acKey]?.zones?.[zoneKey];
const infoOf = (data, acKey) => data?.aircons?.[acKey]?.info;

export function hasSensor(zone) {
  return Number(zone?.type ?? 0) !== 0;
}

export function hasMotionSensor(zone) {
  return Number(zone?.motionConfig ?? 0) >= 2;
}

export function supportsMyZone(info, zone) {
  return info?.myZone !== undefined && hasSensor(zone);
}

function zoneChange(acKey, zoneKey, body) {
  return { endpoint: ENDPOINTS.AIRCON, change: { [acKey]: { zones: { [zoneKey]: body } } } };
}

/**
 * Describe one zone: its discovery payload and the bindings between its
 * features and the tablet data.
 */
export function describeZone(gladys, { platformId, acKey, zoneKey, data, prefix }) {
  const zone = zoneOf(data, acKey, zoneKey) ?? {};
  const info = infoOf(data, acKey) ?? {};
  const ids = gladys.externalIds(ZONE_TYPE, `${platformId}-${acKey}-${zoneKey}`);
  const read = (fn) => (snapshot) => {
    const current = zoneOf(snapshot, acKey, zoneKey);
    return current ? fn(current, infoOf(snapshot, acKey) ?? {}) : null;
  };
  const sensor = hasSensor(zone);

  const bindings = [
    {
      feature: {
        name: 'Open',
        external_id: ids.feature(ZONE_FEATURES.OPEN),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.state === 'open' ? 1 : 0)),
      write: (value) =>
        zoneChange(acKey, zoneKey, { state: Number(value) === 1 ? 'open' : 'close' }),
    },
    {
      feature: {
        name: sensor ? 'Damper opening' : 'Opening',
        external_id: ids.feature(ZONE_FEATURES.OPENING),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.DIMMER,
        unit: DEVICE_FEATURE_UNITS.PERCENT,
        min: 0,
        max: 100,
        // With a sensor, the controller moves the damper by itself.
        read_only: sensor,
        has_feedback: !sensor,
        keep_history: true,
      },
      read: read((current) =>
        current.state === 'open' && Number.isFinite(current.value) ? current.value : 0,
      ),
      write: sensor
        ? undefined
        : (value) =>
            Number(value) <= 0
              ? zoneChange(acKey, zoneKey, { state: 'close' })
              : zoneChange(acKey, zoneKey, { state: 'open', value: damperValue(value) }),
    },
  ];

  if (sensor) {
    bindings.push(
      {
        feature: {
          name: 'Temperature',
          external_id: ids.feature(ZONE_FEATURES.TEMPERATURE),
          category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.CELSIUS,
          min: -20,
          max: 60,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
        // A sensor that lost its battery reads 0: better no value than 0 °C.
        read: read((current) =>
          Number.isFinite(current.measuredTemp) && current.measuredTemp !== 0
            ? current.measuredTemp
            : null,
        ),
      },
      {
        feature: {
          name: 'Target temperature',
          external_id: ids.feature(ZONE_FEATURES.TARGET_TEMPERATURE),
          category: DEVICE_FEATURE_CATEGORIES.THERMOSTAT,
          type: DEVICE_FEATURE_TYPES.THERMOSTAT.TARGET_TEMPERATURE,
          unit: DEVICE_FEATURE_UNITS.CELSIUS,
          min: TEMPERATURE_RANGE.min,
          max: TEMPERATURE_RANGE.max,
          read_only: false,
          has_feedback: true,
          keep_history: true,
        },
        read: read((current) => (Number.isFinite(current.setTemp) ? current.setTemp : null)),
        write: (value) => zoneChange(acKey, zoneKey, { setTemp: clampTemperature(value) }),
      },
      {
        feature: {
          name: 'Sensor signal',
          external_id: ids.feature(ZONE_FEATURES.SIGNAL),
          category: DEVICE_FEATURE_CATEGORIES.SIGNAL,
          type: DEVICE_FEATURE_TYPES.SIGNAL.QUALITY,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          min: 0,
          max: 100,
          read_only: true,
          has_feedback: false,
          keep_history: false,
        },
        read: read((current) => (Number.isFinite(current.rssi) ? current.rssi : null)),
      },
    );
  }

  if (supportsMyZone(info, zone)) {
    bindings.push({
      feature: {
        name: 'MyZone',
        external_id: ids.feature(ZONE_FEATURES.MY_ZONE),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current, currentInfo) => (currentInfo.myZone === current.number ? 1 : 0)),
      write: (value, snapshot) => {
        const current = zoneOf(snapshot, acKey, zoneKey) ?? zone;
        if (Number(value) === 1) {
          return {
            endpoint: ENDPOINTS.AIRCON,
            change: { [acKey]: { info: { myZone: current.number } } },
          };
        }
        // Turning MyZone off only means something on the zone that holds it.
        if (infoOf(snapshot, acKey)?.myZone !== current.number) {
          return null;
        }
        return { endpoint: ENDPOINTS.AIRCON, change: { [acKey]: { info: { myZone: 0 } } } };
      },
    });
  }

  if (hasMotionSensor(zone)) {
    bindings.push({
      feature: {
        name: 'Motion',
        external_id: ids.feature(ZONE_FEATURES.MOTION),
        category: DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
        min: 0,
        max: 1,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
      read: read((current) => (current.motion === MOTION_DETECTED_VALUE ? 1 : 0)),
    });
  }

  const zoneName = zone.name || zoneKey.toUpperCase();
  return {
    kind: ZONE_TYPE,
    externalId: ids.device,
    acKey,
    zoneKey,
    name: prefix ? `${prefix} ${zoneName}` : zoneName,
    featureIds: Object.fromEntries(
      Object.entries(ZONE_FEATURES).map(([key, featureKey]) => [key, ids.feature(featureKey)]),
    ),
    bindings,
  };
}
