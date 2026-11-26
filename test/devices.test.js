import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_FEATURE_CATEGORIES } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  buildDiscoveredDevices,
  collectStates,
  describeSystem,
  findBinding,
  systemPlatformId,
} from '../src/devices/index.js';
import { AC_FAN_SPEED, AC_MODE, COVER_STATE, fanFromGladys } from '../src/devices/mappings.js';
import { systemData } from './fixtures/systemData.js';

const gladys = createFakeGladys();
const data = systemData();
const entries = describeSystem(gladys, data);

const byName = (name) => entries.find((entry) => entry.name === name);
const stateOf = (externalId) =>
  collectStates(entries, data).find((s) => s.device_feature_external_id === externalId)?.state;
const write = (externalId, value, snapshot = data) =>
  findBinding(entries, externalId).binding.write(value, snapshot);

test('one device per unit, configured zone, light and thing', () => {
  assert.deepEqual(
    entries.map((entry) => `${entry.kind}:${entry.name}`),
    [
      'aircon:Main AC',
      'zone:Living',
      'zone:Bedroom',
      'zone:Hallway',
      'light:Kitchen',
      'light:Porch',
      'thing:Blind',
      'thing:Garage',
      'thing:Pump',
    ],
  );
});

test('external ids are built from the system rid and the tablet keys', () => {
  assert.equal(systemPlatformId(data), 'abc123XYZ');
  assert.equal(systemPlatformId({ system: { rid: 'a b/c' } }), 'a-b-c');
  assert.equal(systemPlatformId({ system: {} }), 'myair');
  assert.equal(byName('Living').externalId, gladys.externalIds('zone', 'abc123XYZ-ac1-z01').device);
  // Renaming a zone on the tablet keeps its external id.
  const renamed = systemData();
  renamed.aircons.ac1.zones.z01.name = 'Lounge';
  const zone = describeSystem(gladys, renamed).find((entry) => entry.zoneKey === 'z01');
  assert.equal(zone.externalId, byName('Living').externalId);
});

test('Gladys accepts the discovery payload', async () => {
  const fresh = createFakeGladys();
  await fresh.publishDiscoveredDevices(buildDiscoveredDevices(describeSystem(fresh, data)));
  assert.equal(fresh.fake.discoveredDevices.length, entries.length);
});

test('every feature carries the columns Gladys needs to create it', () => {
  for (const device of buildDiscoveredDevices(entries)) {
    for (const feature of device.features) {
      const where = `${device.name} / ${feature.name}`;
      assert.ok(typeof feature.name === 'string' && feature.name.length > 0, `${where}: name`);
      assert.ok(Number.isFinite(feature.min), `${where}: min`);
      assert.ok(Number.isFinite(feature.max), `${where}: max`);
      assert.ok(feature.min <= feature.max, `${where}: min must not exceed max`);
      assert.equal(typeof feature.read_only, 'boolean', `${where}: read_only`);
      assert.equal(typeof feature.has_feedback, 'boolean', `${where}: has_feedback`);
      for (const option of feature.supported_options ?? []) {
        assert.ok(Number.isInteger(option.value), `${where}: option values are integers`);
        assert.ok(
          option.value >= feature.min && option.value <= feature.max,
          `${where}: option range`,
        );
        assert.ok(option.label, `${where}: option label`);
      }
    }
  }
});

test('writable features have a writer, read-only ones none', () => {
  for (const entry of entries) {
    for (const binding of entry.bindings) {
      assert.equal(
        typeof binding.write === 'function',
        !binding.feature.read_only,
        `${entry.name} / ${binding.feature.name}`,
      );
    }
  }
});

test('the air conditioner reads its state', () => {
  const ac = byName('Main AC');
  assert.equal(stateOf(ac.featureIds.POWER), 1);
  assert.equal(stateOf(ac.featureIds.MODE), AC_MODE.COOLING);
  assert.equal(stateOf(ac.featureIds.TARGET_TEMPERATURE), 24);
  assert.equal(stateOf(ac.featureIds.FAN_SPEED), AC_FAN_SPEED.HIGH);
  assert.equal(stateOf(ac.featureIds.FRESH_AIR), 0);
  const modes = ac.bindings.find((b) => b.feature.external_id === ac.featureIds.MODE);
  assert.ok(modes.feature.supported_options.some((o) => o.label === 'MyAuto'));
});

test('the air conditioner turns Gladys commands into tablet changes', () => {
  const ac = byName('Main AC');
  assert.deepEqual(write(ac.featureIds.POWER, 0), {
    endpoint: 'setAircon',
    change: { ac1: { info: { state: 'off' } } },
  });
  assert.deepEqual(write(ac.featureIds.MODE, AC_MODE.HEATING).change, {
    ac1: { info: { mode: 'heat' } },
  });
  assert.deepEqual(write(ac.featureIds.TARGET_TEMPERATURE, 40).change, {
    ac1: { info: { setTemp: 32 } },
  });
  assert.deepEqual(write(ac.featureIds.FAN_SPEED, AC_FAN_SPEED.AUTO).change, {
    ac1: { info: { fan: 'autoAA' } },
  });
  assert.deepEqual(write(ac.featureIds.TIMER_OFF, 90).change, {
    ac1: { info: { countDownToOff: 90 } },
  });
  assert.throws(() => write(ac.featureIds.MODE, 42), /Unsupported/);
});

test('fan speeds snap to what the unit knows', () => {
  assert.equal(fanFromGladys(AC_FAN_SPEED.AUTO, { aaAutoFanModeEnabled: false }), 'auto');
  assert.equal(fanFromGladys(2), 'low');
  assert.equal(fanFromGladys(4), 'medium');
  assert.equal(fanFromGladys(7), 'high');
});

test('a zone with a sensor reads temperature, set point, MyZone and motion', () => {
  const living = byName('Living');
  assert.equal(stateOf(living.featureIds.OPEN), 1);
  assert.equal(stateOf(living.featureIds.TEMPERATURE), 25.4);
  assert.equal(stateOf(living.featureIds.TARGET_TEMPERATURE), 24);
  assert.equal(stateOf(living.featureIds.MY_ZONE), 1);
  assert.equal(stateOf(living.featureIds.MOTION), 0);
  assert.equal(stateOf(byName('Bedroom').featureIds.MY_ZONE), 0);
  assert.equal(findBinding(entries, byName('Bedroom').featureIds.MOTION), undefined);
  assert.deepEqual(write(byName('Bedroom').featureIds.MY_ZONE, 1).change, {
    ac1: { info: { myZone: 2 } },
  });
  assert.equal(
    write(byName('Bedroom').featureIds.MY_ZONE, 0),
    null,
    'not the MyZone: nothing to do',
  );
  assert.deepEqual(write(living.featureIds.MY_ZONE, 0).change, { ac1: { info: { myZone: 0 } } });
});

test('a zone without a sensor is driven by its opening', () => {
  const hallway = byName('Hallway');
  assert.equal(findBinding(entries, hallway.featureIds.TEMPERATURE), undefined);
  assert.equal(stateOf(hallway.featureIds.OPENING), 80);
  assert.deepEqual(write(hallway.featureIds.OPENING, 33).change, {
    ac1: { zones: { z03: { state: 'open', value: 35 } } },
  });
  assert.deepEqual(write(hallway.featureIds.OPENING, 0).change, {
    ac1: { zones: { z03: { state: 'close' } } },
  });
  assert.deepEqual(write(hallway.featureIds.OPEN, 0).change, {
    ac1: { zones: { z03: { state: 'close' } } },
  });
  assert.equal(stateOf(byName('Bedroom').featureIds.OPENING), 0, 'a closed zone reads 0 %');
});

test('lights: relay and dimmable', () => {
  const kitchen = byName('Kitchen');
  assert.equal(stateOf(kitchen.featureIds.POWER), 1);
  assert.equal(stateOf(kitchen.featureIds.BRIGHTNESS), 60);
  assert.deepEqual(write(kitchen.featureIds.BRIGHTNESS, 30), {
    endpoint: 'setLights',
    change: { a1b2c3: { id: 'a1b2c3', state: 'on', value: 30 } },
  });
  const porch = byName('Porch');
  assert.equal(findBinding(entries, porch.featureIds.BRIGHTNESS), undefined);
  assert.deepEqual(write(porch.featureIds.POWER, 1).change, {
    d4e5f6: { id: 'd4e5f6', state: 'on' },
  });
});

test('things: blind, garage door and relay', () => {
  const blind = byName('Blind');
  const garage = byName('Garage');
  const pump = byName('Pump');
  assert.equal(blind.thingKind, 'blind');
  assert.equal(garage.thingKind, 'garage');
  assert.equal(pump.thingKind, 'relay');
  const featureOf = (entry, category) =>
    entry.bindings.find((b) => b.feature.category === category);
  const blindState = featureOf(blind, DEVICE_FEATURE_CATEGORIES.SHUTTER).feature.external_id;
  assert.equal(stateOf(blindState), COVER_STATE.OPEN);
  assert.deepEqual(write(blindState, COVER_STATE.CLOSE), {
    endpoint: 'setThings',
    change: { 200001: { id: '200001', value: 0 } },
  });
  assert.equal(write(blindState, COVER_STATE.STOP), null);
  const garageState = featureOf(garage, DEVICE_FEATURE_CATEGORIES.SHUTTER).feature.external_id;
  assert.equal(stateOf(garageState), COVER_STATE.CLOSE);
  const pumpPower = featureOf(pump, DEVICE_FEATURE_CATEGORIES.SWITCH).feature.external_id;
  assert.equal(stateOf(pumpPower), 1);
});

test('several units prefix the zone names, a sensor without battery reads nothing', () => {
  const two = systemData();
  two.aircons.ac2 = structuredClone(two.aircons.ac1);
  two.aircons.ac2.info.name = 'Upstairs';
  two.aircons.ac1.zones.z01.measuredTemp = 0;
  const list = describeSystem(gladys, two);
  assert.ok(list.some((entry) => entry.name === 'Upstairs Living'));
  const living = list.find((entry) => entry.name === 'Main AC Living');
  assert.equal(
    collectStates(list, two).find(
      (s) => s.device_feature_external_id === living.featureIds.TEMPERATURE,
    ),
    undefined,
  );
});
