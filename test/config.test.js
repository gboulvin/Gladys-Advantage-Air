import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG, isConfigured } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.equal(isConfigured(normalizeConfig()), false);
});

test('normalizeConfig coerces numeric strings coming from a form', () => {
  const config = normalizeConfig({ host: '192.168.1.50', port: '2025', refresh_interval: '30' });
  assert.equal(config.port, 2025);
  assert.equal(config.refresh_interval, 30);
  assert.equal(isConfigured(config), true);
});

test('normalizeConfig keeps the host part of a pasted URL', () => {
  assert.equal(
    normalizeConfig({ host: ' http://192.168.1.50:2025/getSystemData ' }).host,
    '192.168.1.50',
  );
  assert.equal(normalizeConfig({ host: 'myplace.lan' }).host, 'myplace.lan');
});

test('normalizeConfig bounds the refresh interval and falls back on bad numbers', () => {
  assert.equal(normalizeConfig({ refresh_interval: 1 }).refresh_interval, 5);
  assert.equal(normalizeConfig({ refresh_interval: 9999 }).refresh_interval, 300);
  assert.equal(normalizeConfig({ refresh_interval: '' }).refresh_interval, 15);
  assert.equal(normalizeConfig({ port: 'abc' }).port, 2025);
});
