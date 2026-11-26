import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { AdvantageAirHub } from '../src/hub.js';
import { normalizeConfig } from '../src/config.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { fakeClient } from './fixtures/systemData.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

async function setup() {
  const client = fakeClient();
  const hub = new AdvantageAirHub(createFakeGladys(), {
    createClient: () => client,
    confirmDelayMs: 60_000,
  });
  hub.configure(normalizeConfig({ host: '192.168.1.50' }));
  await hub.refresh();
  const byName = (name) => hub.entries.find((e) => e.name === name).externalId;
  return { client, hub, byName };
}

function assertDeclaredOutputs(key, outputs) {
  const declared = manifest.scene_actions.find((a) => a.key === key).outputs.map((o) => o.key);
  for (const name of Object.keys(outputs)) {
    assert.ok(declared.includes(name), `${key}: output "${name}" is not declared`);
  }
}

test('control_aircon sends every set field in one change', async () => {
  const { client, hub, byName } = await setup();
  const outputs = await SCENE_ACTIONS.control_aircon(hub, {
    fields: {
      device: byName('Main AC'),
      power: 'on',
      mode: 'heat',
      fan: 'auto',
      target_temperature: 21.3,
    },
  });
  assert.deepEqual(outputs, { changed: true });
  assertDeclaredOutputs('control_aircon', outputs);
  assert.deepEqual(client.changes, [
    {
      endpoint: 'setAircon',
      change: { ac1: { info: { state: 'on', mode: 'heat', fan: 'autoAA', setTemp: 21.5 } } },
    },
  ]);
  hub.stop();
});

test('control_aircon with nothing to change sends nothing', async () => {
  const { client, hub, byName } = await setup();
  const outputs = await SCENE_ACTIONS.control_aircon(hub, {
    fields: { device: byName('Main AC'), power: 'unchanged', mode: 'unchanged', fan: 'unchanged' },
  });
  assert.deepEqual(outputs, { changed: false });
  assert.equal(client.changes.length, 0);
  hub.stop();
});

test('control_zone applies what the zone supports', async () => {
  const { client, hub, byName } = await setup();
  await SCENE_ACTIONS.control_zone(hub, {
    fields: { device: byName('Hallway'), state: 'open', opening: 42, target_temperature: 20 },
  });
  await SCENE_ACTIONS.control_zone(hub, {
    fields: { device: byName('Living'), state: 'unchanged', opening: 42, target_temperature: 20 },
  });
  assert.deepEqual(
    client.changes.map((c) => c.change),
    [
      { ac1: { zones: { z03: { state: 'open', value: 40 } } } },
      { ac1: { zones: { z01: { setTemp: 20 } } } },
    ],
  );
  hub.stop();
});

test('set_timer, set_myzone and set_all_zones', async () => {
  const { client, hub, byName } = await setup();
  await SCENE_ACTIONS.set_timer(hub, {
    fields: { device: byName('Main AC'), timer: 'on', minutes: 30 },
  });
  assert.deepEqual(await SCENE_ACTIONS.set_myzone(hub, { fields: { device: byName('Bedroom') } }), {
    changed: true,
  });
  assert.deepEqual(await SCENE_ACTIONS.set_myzone(hub, { fields: { device: byName('Hallway') } }), {
    changed: false,
  });
  const outputs = await SCENE_ACTIONS.set_all_zones(hub, {
    fields: { device: byName('Main AC'), state: 'open' },
  });
  assert.deepEqual(outputs, { changed: true, zones: 1 });
  assertDeclaredOutputs('set_all_zones', outputs);
  assert.deepEqual(
    client.changes.map((c) => c.change),
    [
      { ac1: { info: { countDownToOn: 30 } } },
      { ac1: { info: { myZone: 2 } } },
      { ac1: { zones: { z02: { state: 'open' } } } },
    ],
  );
  hub.stop();
});

test('a scene action on the wrong kind of device fails with a clear message', async () => {
  const { hub, byName } = await setup();
  await assert.rejects(
    SCENE_ACTIONS.control_aircon(hub, { fields: { device: byName('Living'), power: 'on' } }),
    /not an air conditioner/,
  );
  await assert.rejects(
    SCENE_ACTIONS.control_zone(hub, { fields: { device: byName('Main AC'), state: 'open' } }),
    /not a zone/,
  );
  hub.stop();
});
