import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { AdvantageAirHub } from '../src/hub.js';
import { normalizeConfig } from '../src/config.js';
import { SCENE_TRIGGER_KEYS, TRIGGERS } from '../src/events.js';
import { AC_MODE } from '../src/devices/mappings.js';
import { fakeClient } from './fixtures/systemData.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const config = normalizeConfig({ host: '192.168.1.50' });

function setup() {
  const gladys = createFakeGladys();
  const client = fakeClient();
  const hub = new AdvantageAirHub(gladys, { createClient: () => client, confirmDelayMs: 60_000 });
  hub.configure(config);
  return { gladys, client, hub };
}

const lastState = (gladys, externalId) =>
  gladys.fake.states.filter((s) => s.device_feature_external_id === externalId).at(-1)?.state;

test('the first refresh publishes the devices and their states, no scene event', async () => {
  const { gladys, hub } = setup();
  const { structureChanged } = await hub.refresh();
  assert.equal(structureChanged, true);
  assert.equal(gladys.fake.discoveredDevices.length, hub.entries.length);
  assert.ok(gladys.fake.states.length > 20);
  assert.equal(gladys.fake.sceneEvents.length, 0);
  hub.stop();
});

test('an unchanged system publishes nothing again', async () => {
  const { gladys, hub } = setup();
  await hub.refresh();
  const published = gladys.fake.states.length;
  const { structureChanged } = await hub.refresh();
  assert.equal(structureChanged, false);
  assert.equal(gladys.fake.states.length, published);
  hub.stop();
});

test('transitions publish the new states and fire the scene events', async () => {
  const { gladys, client, hub } = setup();
  await hub.refresh();
  const info = client.data.aircons.ac1.info;
  info.state = 'off';
  info.mode = 'heat';
  info.filterCleanStatus = 1;
  info.airconErrorCode = 'E12';
  client.data.aircons.ac1.zones.z02.state = 'open';
  client.data.aircons.ac1.zones.z01.motion = 20;
  await hub.refresh();

  const ac = hub.entries.find((e) => e.kind === 'aircon');
  assert.equal(lastState(gladys, ac.featureIds.POWER), 0);
  assert.equal(lastState(gladys, ac.featureIds.MODE), AC_MODE.HEATING);

  const events = gladys.fake.sceneEvents.map((e) => e.key).sort();
  assert.deepEqual(events, [...SCENE_TRIGGER_KEYS].sort());
  const power = gladys.fake.sceneEvents.find((e) => e.key === TRIGGERS.AIRCON_POWER_CHANGED);
  assert.deepEqual(power.data, { device: ac.externalId, state: 'off', mode: 'heat' });

  // Every key the events carry is declared by their trigger.
  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = manifest.scene_triggers.find((t) => t.key === key);
    const declared = [...(trigger.fields ?? []), ...(trigger.variables ?? [])].map((f) => f.key);
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `${key}: data.${name} is flat`);
    }
  }

  // Same data again: no new event.
  const count = gladys.fake.sceneEvents.length;
  await hub.refresh();
  assert.equal(gladys.fake.sceneEvents.length, count);
  hub.stop();
});

test('a new zone re-publishes the discovered devices', async () => {
  const { gladys, client, hub } = setup();
  await hub.refresh();
  client.data.aircons.ac1.info.noOfZones = 4;
  const { structureChanged } = await hub.refresh();
  assert.equal(structureChanged, true);
  assert.ok(gladys.fake.discoveredDevices.some((d) => d.name === 'Zone 4'));
  hub.stop();
});

test('setValue sends the change, shows the requested value and re-reads', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { gladys, client, hub } = setup();
  await hub.refresh();
  const ac = hub.entries.find((e) => e.kind === 'aircon');
  assert.equal(await hub.setValue(ac.featureIds.POWER, 0), true);
  assert.deepEqual(client.changes, [
    { endpoint: 'setAircon', change: { ac1: { info: { state: 'off' } } } },
  ]);
  assert.equal(lastState(gladys, ac.featureIds.POWER), 0);

  // The unit ignored the command: the re-read publishes the real state back.
  t.mock.timers.tick(60_000);
  await hub.refreshing;
  assert.equal(lastState(gladys, ac.featureIds.POWER), 1);
  hub.stop();
});

test('setValue refuses read-only and unknown features', async () => {
  const { hub } = setup();
  await hub.refresh();
  const living = hub.entries.find((e) => e.name === 'Living');
  await assert.rejects(hub.setValue(living.featureIds.TEMPERATURE, 20), /read-only/);
  await assert.rejects(hub.setValue('ext:nope:x', 1), /Unknown feature/);
  hub.stop();
});

test('an unreachable tablet is reported to the listeners, then the recovery', async () => {
  const { client, hub } = setup();
  const seen = [];
  hub.onRefresh((change) => seen.push(change));
  await hub.refresh();
  client.failing = true;
  await assert.rejects(hub.refresh());
  assert.ok(hub.lastError);
  client.failing = false;
  await hub.refresh();
  assert.equal(hub.lastError, null);
  assert.deepEqual(
    seen.map((s) => [s.changed, Boolean(s.error)]),
    [
      [true, false],
      [false, true],
      [true, false],
    ],
  );
  hub.stop();
});

test('without an address the hub stays idle', async () => {
  const gladys = createFakeGladys();
  const hub = new AdvantageAirHub(gladys);
  hub.configure(normalizeConfig());
  assert.equal(hub.isConfigured(), false);
  assert.deepEqual(await hub.refresh(), { structureChanged: false });
  await assert.rejects(hub.send({ endpoint: 'setAircon', change: {} }), /No tablet address/);
});
