// -----------------------------------------------------------------------------
// Device type: MYLIGHTS light (one per `myLights.lights` entry of the tablet).
//
// A relay light only switches on and off; any other light also dims (0-100 %).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { ENDPOINTS } from '../advantageAir.js';

export const LIGHT_TYPE = 'light';

export const LIGHT_FEATURES = { POWER: 'power', BRIGHTNESS: 'brightness' };

const lightOf = (data, id) => data?.myLights?.lights?.[id];

function lightChange(id, body) {
  return { endpoint: ENDPOINTS.LIGHTS, change: { [id]: { id, ...body } } };
}

export function isDimmable(light) {
  return !light?.relay;
}

export function describeLight(gladys, { platformId, lightId, data }) {
  const light = lightOf(data, lightId) ?? {};
  const ids = gladys.externalIds(LIGHT_TYPE, `${platformId}-${lightId}`);
  const read = (fn) => (snapshot) => {
    const current = lightOf(snapshot, lightId);
    return current ? fn(current) : null;
  };

  const bindings = [
    {
      feature: {
        name: 'On/Off',
        external_id: ids.feature(LIGHT_FEATURES.POWER),
        category: DEVICE_FEATURE_CATEGORIES.LIGHT,
        type: DEVICE_FEATURE_TYPES.LIGHT.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.state === 'on' ? 1 : 0)),
      write: (value) => lightChange(lightId, { state: Number(value) === 1 ? 'on' : 'off' }),
    },
  ];

  if (isDimmable(light)) {
    bindings.push({
      feature: {
        name: 'Brightness',
        external_id: ids.feature(LIGHT_FEATURES.BRIGHTNESS),
        category: DEVICE_FEATURE_CATEGORIES.LIGHT,
        type: DEVICE_FEATURE_TYPES.LIGHT.BRIGHTNESS,
        unit: DEVICE_FEATURE_UNITS.PERCENT,
        min: 0,
        max: 100,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (Number.isFinite(current.value) ? current.value : null)),
      write: (value) => {
        const brightness = Math.min(100, Math.max(0, Math.round(Number(value))));
        if (!Number.isFinite(brightness)) {
          throw new Error(`Invalid brightness: ${value}`);
        }
        return brightness === 0
          ? lightChange(lightId, { state: 'off' })
          : lightChange(lightId, { state: 'on', value: brightness });
      },
    });
  }

  return {
    kind: LIGHT_TYPE,
    externalId: ids.device,
    lightId,
    name: light.name || `Light ${lightId}`,
    featureIds: {
      POWER: ids.feature(LIGHT_FEATURES.POWER),
      BRIGHTNESS: ids.feature(LIGHT_FEATURES.BRIGHTNESS),
    },
    bindings,
  };
}
