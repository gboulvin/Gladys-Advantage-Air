import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { AdvantageAirHub } from '../src/hub.js';
import { normalizeConfig } from '../src/config.js';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { AIRCON_STATUS_WIDGET, WIDGETS, ZONES_WIDGET, refreshWidgets } from '../src/widgets.js';
import { fakeClient } from './fixtures/systemData.js';

async function setup({ host = '192.168.1.50' } = {}) {
  const client = fakeClient();
  const hub = new AdvantageAirHub(createFakeGladys(), {
    createClient: () => client,
    confirmDelayMs: 60_000,
  });
  hub.configure(normalizeConfig({ host }));
  return { client, hub };
}

const request = (settings = {}) => ({ settings, language: 'en', units: 'metric' });

test('every widget content is rendered exactly as sent', async () => {
  const { client, hub } = await setup();
  for (const widget of Object.values(WIDGETS)) {
    assert.deepEqual(validateWidgetContent(await widget.get(hub, request())), []);
  }
  // With timers, an error and a dirty filter too.
  Object.assign(client.data.aircons.ac1.info, {
    countDownToOn: 90,
    countDownToOff: 15,
    airconErrorCode: 'E12',
    filterCleanStatus: 1,
  });
  await hub.refresh();
  const content = await WIDGETS[AIRCON_STATUS_WIDGET].get(hub, request());
  assert.deepEqual(validateWidgetContent(content), []);
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items.length, 7);
  hub.stop();
});

test('the live tiles and the power button reference published features', async () => {
  const { hub } = await setup();
  await hub.refresh();
  const featureIds = new Set(
    buildDiscoveredDevices(hub.entries).flatMap((device) =>
      device.features.map((f) => f.external_id),
    ),
  );
  const content = await WIDGETS[AIRCON_STATUS_WIDGET].get(hub, request());
  const bound = content.components.filter((c) => c.device_feature);
  assert.equal(bound.length, 3, 'set point, MyZone temperature, power button');
  for (const component of bound) {
    assert.ok(featureIds.has(component.device_feature), component.device_feature);
  }
  const button = content.components.find((c) => c.type === 'button');
  assert.equal(button.value, 0, 'the unit is on: the button turns it off');
  hub.stop();
});

test('the widget follows its device setting, a zone leads to its unit', async () => {
  const { hub } = await setup();
  await hub.refresh();
  const living = hub.entries.find((e) => e.name === 'Living').externalId;
  const content = await WIDGETS[ZONES_WIDGET].get(hub, request({ device: living }));
  const status = content.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((item) => item.label),
    ['Living', 'Bedroom', 'Hallway'],
  );
  assert.equal(status.items[0].value.en, 'Open · 100 % · 25.4 °C');
  assert.equal(status.items[1].value.fr, 'Fermée · 23.1 °C');
  hub.stop();
});

test('the zones buttons open or close every zone and answer a toast', async () => {
  const { client, hub } = await setup();
  const content = await WIDGETS[ZONES_WIDGET].get(hub, request());
  const buttons = content.components.filter((c) => c.type === 'button');
  assert.equal(buttons.length, 2);
  for (const { action } of buttons) {
    const toast = await WIDGETS[ZONES_WIDGET].action(hub, {
      actionKey: action.key,
      params: action.params,
      settings: {},
    });
    assert.ok(toast.en && toast.en.length <= 200);
    assert.ok(toast.fr && toast.de && toast.es);
  }
  assert.deepEqual(
    client.changes.map((c) => c.change),
    [
      { ac1: { zones: { z02: { state: 'open' } } } },
      { ac1: { zones: { z01: { state: 'close' }, z03: { state: 'close' } } } },
    ],
  );
  await assert.rejects(
    WIDGETS[ZONES_WIDGET].action(hub, { actionKey: 'nope', params: {}, settings: {} }),
    /Unknown widget action/,
  );
  hub.stop();
});

test('without an address or a tablet, the widgets say so', async () => {
  const idle = await setup({ host: '' });
  for (const widget of Object.values(WIDGETS)) {
    const content = await widget.get(idle.hub, request());
    assert.deepEqual(validateWidgetContent(content), []);
    assert.match(content.components[0].text.en, /Enter the address/);
  }
  const down = await setup();
  down.client.failing = true;
  const content = await WIDGETS[AIRCON_STATUS_WIDGET].get(down.hub, request());
  assert.match(content.components[0].text.en, /does not answer/);
  down.hub.stop();
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
