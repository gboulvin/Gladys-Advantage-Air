// -----------------------------------------------------------------------------
// Device type: MYTHINGS channel (one per `myThings.things` entry of the tablet).
//
// MyThings drives blinds, garage doors, lights and generic relays. Every
// channel carries a `value` from 0 to 100: the position of a blind, the
// brightness of a light, 100 / 0 for a relay. Its `channelDipState` says what
// is wired on it.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { ENDPOINTS } from '../advantageAir.js';
import { COVER_STATE, THING_TYPES } from './mappings.js';

export const THING_TYPE = 'thing';

export const THING_FEATURES = {
  STATE: 'state',
  POSITION: 'position',
  POWER: 'power',
  BRIGHTNESS: 'brightness',
};

const thingOf = (data, id) => data?.myThings?.things?.[id];

function thingChange(id, value) {
  return { endpoint: ENDPOINTS.THINGS, change: { [id]: { id, value } } };
}

export function thingKind(thing) {
  const channel = Number(thing?.channelDipState);
  if (THING_TYPES.BLIND.includes(channel)) return 'blind';
  if (THING_TYPES.GARAGE_DOOR.includes(channel)) return 'garage';
  if (THING_TYPES.DIMMABLE_LIGHT.includes(channel)) return 'dimmable-light';
  if (THING_TYPES.LIGHT.includes(channel)) return 'light';
  return 'relay';
}

function coverBindings(ids, read, thingId) {
  return [
    {
      feature: {
        name: 'State',
        external_id: ids.feature(THING_FEATURES.STATE),
        category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
        type: DEVICE_FEATURE_TYPES.SHUTTER.STATE,
        min: -1,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.value > 0 ? COVER_STATE.OPEN : COVER_STATE.CLOSE)),
      write: (value) => {
        const state = Number(value);
        if (state === COVER_STATE.OPEN) return thingChange(thingId, 100);
        if (state === COVER_STATE.CLOSE) return thingChange(thingId, 0);
        // MyThings cannot stop a moving channel.
        return null;
      },
    },
    {
      feature: {
        name: 'Position',
        external_id: ids.feature(THING_FEATURES.POSITION),
        category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
        type: DEVICE_FEATURE_TYPES.SHUTTER.POSITION,
        unit: DEVICE_FEATURE_UNITS.PERCENT,
        min: 0,
        max: 100,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      },
      read: read((current) => (Number.isFinite(current.value) ? current.value : null)),
    },
  ];
}

function lightBindings(ids, read, thingId, dimmable) {
  const bindings = [
    {
      feature: {
        name: 'On/Off',
        external_id: ids.feature(THING_FEATURES.POWER),
        category: DEVICE_FEATURE_CATEGORIES.LIGHT,
        type: DEVICE_FEATURE_TYPES.LIGHT.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.value > 0 ? 1 : 0)),
      write: (value) => thingChange(thingId, Number(value) === 1 ? 100 : 0),
    },
  ];
  if (dimmable) {
    bindings.push({
      feature: {
        name: 'Brightness',
        external_id: ids.feature(THING_FEATURES.BRIGHTNESS),
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
        const brightness = Math.round(Number(value));
        if (!Number.isFinite(brightness)) {
          throw new Error(`Invalid brightness: ${value}`);
        }
        return thingChange(thingId, Math.min(100, Math.max(0, brightness)));
      },
    });
  }
  return bindings;
}

function relayBindings(ids, read, thingId) {
  return [
    {
      feature: {
        name: 'On/Off',
        external_id: ids.feature(THING_FEATURES.POWER),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: false,
        has_feedback: true,
        keep_history: true,
      },
      read: read((current) => (current.value > 0 ? 1 : 0)),
      write: (value) => thingChange(thingId, Number(value) === 1 ? 100 : 0),
    },
  ];
}

export function describeThing(gladys, { platformId, thingId, data }) {
  const thing = thingOf(data, thingId) ?? {};
  const ids = gladys.externalIds(THING_TYPE, `${platformId}-${thingId}`);
  const read = (fn) => (snapshot) => {
    const current = thingOf(snapshot, thingId);
    return current ? fn(current) : null;
  };
  const kind = thingKind(thing);

  let bindings;
  if (kind === 'blind' || kind === 'garage') {
    bindings = coverBindings(ids, read, thingId);
  } else if (kind === 'dimmable-light' || kind === 'light') {
    bindings = lightBindings(ids, read, thingId, kind === 'dimmable-light');
  } else {
    bindings = relayBindings(ids, read, thingId);
  }

  return {
    kind: THING_TYPE,
    thingKind: kind,
    externalId: ids.device,
    thingId,
    name: thing.name || `Thing ${thingId}`,
    bindings,
  };
}
