// -----------------------------------------------------------------------------
// Scene triggers (manifest `scene_triggers`, Gladys 5.1+).
//
// The states of the features already drive the standard "device state" scene
// trigger. These events add what a numeric state cannot say: the transition
// itself, with its details (which mode, which error code...).
//
// They are computed by comparing two successive snapshots of the tablet data:
// one event per TRANSITION, never on the first read (nothing changed yet), and
// `data` flat, with only the keys the manifest declares for the trigger.
// -----------------------------------------------------------------------------

import { AIRCON_TYPE, ZONE_TYPE } from './devices/index.js';
import { MOTION_DETECTED_VALUE } from './devices/zone.js';

// Trigger keys, as declared in the manifest. Keys are forever: scenes store them.
export const TRIGGERS = {
  AIRCON_POWER_CHANGED: 'aircon_power_changed',
  AIRCON_MODE_CHANGED: 'aircon_mode_changed',
  FILTER_CLEAN_NEEDED: 'filter_clean_needed',
  AIRCON_ERROR: 'aircon_error',
  ZONE_STATE_CHANGED: 'zone_state_changed',
  ZONE_MOTION_DETECTED: 'zone_motion_detected',
};

export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);

const infoOf = (data, acKey) => data?.aircons?.[acKey]?.info;
const zoneOf = (data, acKey, zoneKey) => data?.aircons?.[acKey]?.zones?.[zoneKey];

const errorCode = (info) => String(info?.airconErrorCode ?? '').trim();

function airconEvents(entry, before, after) {
  const events = [];
  const previous = infoOf(before, entry.acKey);
  const current = infoOf(after, entry.acKey);
  if (!previous || !current) {
    return events;
  }
  const device = entry.externalId;
  if (previous.state !== current.state && ['on', 'off'].includes(current.state)) {
    events.push({
      key: TRIGGERS.AIRCON_POWER_CHANGED,
      data: { device, state: current.state, mode: String(current.mode ?? '') },
    });
  }
  if (previous.mode !== current.mode && current.mode) {
    events.push({
      key: TRIGGERS.AIRCON_MODE_CHANGED,
      data: { device, mode: current.mode, previous_mode: String(previous.mode ?? '') },
    });
  }
  if (Number(previous.filterCleanStatus) !== 1 && Number(current.filterCleanStatus) === 1) {
    events.push({ key: TRIGGERS.FILTER_CLEAN_NEEDED, data: { device } });
  }
  const code = errorCode(current);
  if (code && code !== errorCode(previous)) {
    events.push({ key: TRIGGERS.AIRCON_ERROR, data: { device, error_code: code } });
  }
  return events;
}

function zoneEvents(entry, before, after) {
  const events = [];
  const previous = zoneOf(before, entry.acKey, entry.zoneKey);
  const current = zoneOf(after, entry.acKey, entry.zoneKey);
  if (!previous || !current) {
    return events;
  }
  const device = entry.externalId;
  if (previous.state !== current.state && ['open', 'close'].includes(current.state)) {
    events.push({
      key: TRIGGERS.ZONE_STATE_CHANGED,
      data: {
        device,
        state: current.state,
        opening: current.state === 'open' && Number.isFinite(current.value) ? current.value : 0,
      },
    });
  }
  if (previous.motion !== MOTION_DETECTED_VALUE && current.motion === MOTION_DETECTED_VALUE) {
    events.push({ key: TRIGGERS.ZONE_MOTION_DETECTED, data: { device } });
  }
  return events;
}

/**
 * Scene events between two snapshots of the tablet data.
 */
export function computeSceneEvents(entries, before, after) {
  if (!before || !after) {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.kind === AIRCON_TYPE) return airconEvents(entry, before, after);
    if (entry.kind === ZONE_TYPE) return zoneEvents(entry, before, after);
    return [];
  });
}
