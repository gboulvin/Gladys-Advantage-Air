// -----------------------------------------------------------------------------
// Device registry: turns the data of the tablet (`getSystemData`) into Gladys
// devices.
//
// `describeSystem` returns one entry per physical device:
//   - kind / name / externalId          identity of the device
//   - bindings: [{ feature, read, write? }]
//       feature  the Gladys feature payload (discovery)
//       read     (data) => state | null, reads the feature state from a
//                snapshot of the tablet data (null = unknown, not published)
//       write    (value, data) => { endpoint, change } | null, turns a Gladys
//                command into a change for the tablet (null = nothing to do)
//
// External ids are forever: they are built from the `rid` of the system (the
// tablet's unique id) and from the keys the tablet gives to each unit, zone,
// light and thing — never from a name the user can rename.
// -----------------------------------------------------------------------------

import { AIRCON_TYPE, describeAircon } from './aircon.js';
import { ZONE_TYPE, describeZone } from './zone.js';
import { LIGHT_TYPE, describeLight } from './light.js';
import { THING_TYPE, describeThing } from './thing.js';

export { AIRCON_TYPE, ZONE_TYPE, LIGHT_TYPE, THING_TYPE };

/**
 * Stable id of the system, from the tablet's `rid`. External ids only take a
 * conservative alphabet: anything else becomes a dash.
 */
export function systemPlatformId(data) {
  const rid = String(data?.system?.rid ?? '').trim();
  const safe = rid.replace(/[^A-Za-z0-9_-]/g, '-');
  return safe.length > 0 ? safe : 'myair';
}

const sortedKeys = (object) => Object.keys(object ?? {}).sort();

/**
 * Every device of the system, in a stable order.
 */
export function describeSystem(gladys, data) {
  if (!data) {
    return [];
  }
  const platformId = systemPlatformId(data);
  const entries = [];
  const acKeys = sortedKeys(data.aircons);
  for (const acKey of acKeys) {
    const aircon = describeAircon(gladys, { platformId, acKey, data });
    entries.push(aircon);
    // With several units, zone names repeat ("Living"): prefix them.
    const prefix = acKeys.length > 1 ? aircon.name : undefined;
    for (const zoneKey of sortedKeys(data.aircons[acKey].zones)) {
      const zone = data.aircons[acKey].zones[zoneKey];
      // Zones beyond the number the unit is configured for are placeholders.
      const count = Number(data.aircons[acKey].info?.noOfZones);
      if (Number.isFinite(count) && count > 0 && Number(zone?.number) > count) {
        continue;
      }
      entries.push(describeZone(gladys, { platformId, acKey, zoneKey, data, prefix }));
    }
  }
  for (const lightId of sortedKeys(data.myLights?.lights)) {
    entries.push(describeLight(gladys, { platformId, lightId, data }));
  }
  for (const thingId of sortedKeys(data.myThings?.things)) {
    entries.push(describeThing(gladys, { platformId, thingId, data }));
  }
  return entries;
}

/**
 * The discovery payload of every device of the system.
 */
export function buildDiscoveredDevices(entries) {
  return entries.map((entry) => ({
    name: entry.name,
    external_id: entry.externalId,
    features: entry.bindings.map((binding) => binding.feature),
  }));
}

/**
 * The state of every feature, read from a snapshot of the tablet data (in the
 * `publishStates` format). Unknown values are left out.
 */
export function collectStates(entries, data) {
  const states = [];
  for (const entry of entries) {
    for (const binding of entry.bindings) {
      const state = binding.read(data);
      if (state !== null && state !== undefined && Number.isFinite(state)) {
        states.push({ device_feature_external_id: binding.feature.external_id, state });
      }
    }
  }
  return states;
}

export function findEntry(entries, externalId) {
  return entries.find((entry) => entry.externalId === externalId);
}

export function findBinding(entries, featureExternalId) {
  for (const entry of entries) {
    const binding = entry.bindings.find((b) => b.feature.external_id === featureExternalId);
    if (binding) {
      return { entry, binding };
    }
  }
  return undefined;
}
