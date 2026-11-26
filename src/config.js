// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of the manifest. The
// SDK fetches it (`gladys.getConfig()`) and notifies every change
// (`gladys.onConfigUpdated()`); this module only provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined` or with numbers typed as strings.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // IP address (or host name) of the Advantage Air wall tablet. Empty until the
  // user fills it in: the integration then stays idle.
  host: '',
  // The tablet serves its local API on port 2025.
  port: 2025,
  // Seconds between two reads of the tablet.
  refresh_interval: 15,
};

export const REFRESH_INTERVAL_BOUNDS = { min: 5, max: 300 };

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && value !== '' && value !== null ? number : fallback;
}

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const host = typeof raw.host === 'string' ? raw.host.trim() : DEFAULT_CONFIG.host;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    // Users often paste a URL: keep the host part only.
    host: host.replace(/^https?:\/\//i, '').replace(/[:/].*$/, ''),
    port: Math.round(toNumber(raw.port, DEFAULT_CONFIG.port)),
    refresh_interval: clamp(
      Math.round(toNumber(raw.refresh_interval, DEFAULT_CONFIG.refresh_interval)),
      REFRESH_INTERVAL_BOUNDS,
    ),
  };
}

/**
 * Whether the config holds enough to reach a tablet.
 */
export function isConfigured(config) {
  return typeof config.host === 'string' && config.host.length > 0;
}
