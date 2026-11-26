// -----------------------------------------------------------------------------
// Advantage Air local API client.
//
// The wall tablet of a MyAir / e-zone / MyPlace system serves a small HTTP API
// on the LAN (port 2025 by default), with no authentication:
//
//   GET /getSystemData                -> the whole system state, as JSON
//   GET /setAircon?json=<change>      -> change air conditioners and zones
//   GET /setLights?json=<change>      -> change MyLights
//   GET /setThings?json=<change>      -> change MyThings (blinds, garage, relays)
//
// A change answers `{ "ack": true }`, or `{ "ack": false, "reason": "..." }`.
// The tablet is an Android app running on a modest device: it does not like
// parallel requests, so every request goes through a single queue.
// -----------------------------------------------------------------------------

export const ENDPOINTS = {
  AIRCON: 'setAircon',
  LIGHTS: 'setLights',
  THINGS: 'setThings',
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

export class AdvantageAirError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = 'AdvantageAirError';
    this.code = code;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class AdvantageAirClient {
  /**
   * @param {object} options
   * @param {string} options.host IP address or host name of the tablet
   * @param {number} [options.port] API port (2025)
   * @param {Function} [options.fetch] fetch implementation (tests)
   * @param {number} [options.timeoutMs] per-request timeout
   * @param {number} [options.retries] extra attempts on a network error
   * @param {number} [options.retryDelayMs] pause between two attempts
   */
  constructor({
    host,
    port = 2025,
    fetch = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = RETRY_DELAY_MS,
  }) {
    if (!host) {
      throw new AdvantageAirError('No tablet address configured', { code: 'not_configured' });
    }
    this.baseUrl = `http://${host}:${port}`;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
    this.queue = Promise.resolve();
  }

  /**
   * Read the whole system state.
   * @returns {Promise<object>} `{ aircons, myLights?, myThings?, system }`
   */
  async getSystemData() {
    const data = await this.request('getSystemData');
    if (!data || typeof data !== 'object' || typeof data.aircons !== 'object') {
      throw new AdvantageAirError('The tablet answered without air conditioner data', {
        code: 'invalid_response',
      });
    }
    return data;
  }

  /**
   * Send a change to one of the `set*` endpoints.
   * @param {string} endpoint one of ENDPOINTS
   * @param {object} change e.g. `{ ac1: { info: { state: 'on' } } }`
   */
  async change(endpoint, change) {
    if (!Object.values(ENDPOINTS).includes(endpoint)) {
      throw new AdvantageAirError(`Unknown endpoint ${endpoint}`, { code: 'invalid_endpoint' });
    }
    const answer = await this.request(
      `${endpoint}?json=${encodeURIComponent(JSON.stringify(change))}`,
    );
    if (answer && answer.ack === false) {
      throw new AdvantageAirError(
        `The tablet refused the change: ${answer.reason ?? 'no reason'}`,
        {
          code: 'refused',
        },
      );
    }
    return true;
  }

  // One request at a time, in call order.
  request(path) {
    const run = this.queue.then(() => this.requestWithRetries(path));
    this.queue = run.catch(() => {});
    return run;
  }

  async requestWithRetries(path) {
    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) {
        await sleep(this.retryDelayMs);
      }
      try {
        return await this.requestOnce(path);
      } catch (err) {
        lastError = err;
        // A 4xx answer will not get better with a retry.
        if (err.code === 'http_error' && err.status < 500) {
          break;
        }
      }
    }
    throw lastError;
  }

  async requestOnce(path) {
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}/${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: 'application/json' },
      });
    } catch (err) {
      const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      throw new AdvantageAirError(
        timeout
          ? `The tablet at ${this.baseUrl} did not answer in time`
          : `Cannot reach the tablet at ${this.baseUrl}: ${err?.message ?? err}`,
        { code: timeout ? 'timeout' : 'unreachable' },
      );
    }
    if (!response.ok) {
      const error = new AdvantageAirError(`The tablet answered HTTP ${response.status}`, {
        code: 'http_error',
      });
      error.status = response.status;
      throw error;
    }
    // The tablet does not always send a JSON content type: parse the text.
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new AdvantageAirError('The tablet answered something that is not JSON', {
        code: 'invalid_response',
      });
    }
  }
}
