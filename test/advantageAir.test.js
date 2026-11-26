import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdvantageAirClient, ENDPOINTS } from '../src/advantageAir.js';
import { systemData } from './fixtures/systemData.js';

function fakeFetch(answers) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    const answer = answers.shift();
    if (answer instanceof Error) {
      throw answer;
    }
    return {
      ok: answer.status === undefined || answer.status < 400,
      status: answer.status ?? 200,
      text: async () =>
        typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body),
    };
  };
  return { fetch, calls };
}

const options = { host: '192.168.1.50', retryDelayMs: 1 };

test('getSystemData reads the whole system', async () => {
  const { fetch, calls } = fakeFetch([{ body: systemData() }]);
  const client = new AdvantageAirClient({ ...options, fetch });
  const data = await client.getSystemData();
  assert.equal(data.system.rid, 'abc123XYZ');
  assert.deepEqual(calls, ['http://192.168.1.50:2025/getSystemData']);
});

test('change sends the JSON change in the query string', async () => {
  const { fetch, calls } = fakeFetch([{ body: { ack: true, request: 'setAircon' } }]);
  const client = new AdvantageAirClient({ ...options, port: 2026, fetch });
  await client.change(ENDPOINTS.AIRCON, { ac1: { info: { state: 'on' } } });
  const url = new URL(calls[0]);
  assert.equal(url.port, '2026');
  assert.equal(url.pathname, '/setAircon');
  assert.deepEqual(JSON.parse(url.searchParams.get('json')), { ac1: { info: { state: 'on' } } });
});

test('a refused change throws with the reason', async () => {
  const { fetch } = fakeFetch([{ body: { ack: false, reason: 'bad zone' } }]);
  const client = new AdvantageAirClient({ ...options, fetch });
  await assert.rejects(client.change(ENDPOINTS.AIRCON, {}), /refused the change: bad zone/);
});

test('a network error is retried, then reported', async () => {
  const { fetch, calls } = fakeFetch([new Error('ECONNRESET'), { body: systemData() }]);
  const client = new AdvantageAirClient({ ...options, fetch });
  await client.getSystemData();
  assert.equal(calls.length, 2);

  const failing = fakeFetch([new Error('a'), new Error('b'), new Error('c')]);
  const client2 = new AdvantageAirClient({ ...options, fetch: failing.fetch });
  await assert.rejects(client2.getSystemData(), (err) => err.code === 'unreachable');
  assert.equal(failing.calls.length, 3);
});

test('a 4xx answer is not retried, an answer that is not JSON is rejected', async () => {
  const { fetch, calls } = fakeFetch([{ status: 404, body: 'not found' }]);
  const client = new AdvantageAirClient({ ...options, fetch, retries: 2 });
  await assert.rejects(client.getSystemData(), /HTTP 404/);
  assert.equal(calls.length, 1);

  const garbage = fakeFetch([{ body: '<html>' }, { body: '<html>' }, { body: '<html>' }]);
  const client2 = new AdvantageAirClient({ ...options, fetch: garbage.fetch });
  await assert.rejects(client2.getSystemData(), /not JSON/);
});

test('requests run one at a time', async () => {
  let running = 0;
  let maxRunning = 0;
  const fetch = async () => {
    running += 1;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1;
    return { ok: true, status: 200, text: async () => '{"ack":true}' };
  };
  const client = new AdvantageAirClient({ ...options, fetch });
  await Promise.all([
    client.change(ENDPOINTS.LIGHTS, {}),
    client.change(ENDPOINTS.THINGS, {}),
    client.change(ENDPOINTS.AIRCON, {}),
  ]);
  assert.equal(maxRunning, 1);
});

test('the client refuses an empty address and an unknown endpoint', async () => {
  assert.throws(() => new AdvantageAirClient({ host: '' }), /No tablet address/);
  const client = new AdvantageAirClient({ ...options, fetch: async () => ({}) });
  await assert.rejects(client.change('reboot', {}), /Unknown endpoint/);
});
