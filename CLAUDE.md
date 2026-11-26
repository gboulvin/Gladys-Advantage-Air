# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for **Advantage Air** air
conditioning systems (MyAir, e-zone, MyPlace): a Node.js service (Node 22+,
ESM, no build step) that runs in its own sandboxed Docker container and talks
to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template
([integration-template-js](https://github.com/GladysAssistant/integration-template-js)).

It talks to the Advantage Air wall tablet over the **local network only**
(HTTP, port 2025, no authentication): `getSystemData` to read, `setAircon`,
`setLights` and `setThings` with a `json` query parameter to change. The
tablet has no push channel: the integration polls it on its own timer
(`refresh_interval`, 5–300 s) and publishes only what changed.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/devices.test.js          # one file
node --test --test-name-pattern "zone"    # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                 SDK wiring only: handlers registered before connect()
src/advantageAir.js      HTTP client of the tablet (one request at a time, retries)
src/hub.js               one system: refresh loop, states, scene events, commands
src/devices/index.js     tablet data -> devices; collectStates, findBinding
src/devices/aircon.js    air conditioner features (power, mode, set point, fan, timers)
src/devices/zone.js      zone features (open, opening, temperature, set point, MyZone)
src/devices/light.js     MyLights
src/devices/thing.js     MyThings (blinds, garage doors, lights, relays)
src/devices/mappings.js  Advantage Air <-> Gladys value enums (AC_MODE, AC_FAN_SPEED...)
src/events.js            scene triggers, computed from two successive snapshots
src/scenes.js            scene action handlers (manifest `scene_actions`)
src/widgets.js           dashboard widget handlers (manifest `widgets`)
src/actions.js           Configuration screen buttons (manifest `actions`)
src/config.js            DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md    user documentation, re-hosted by Gladys (en and fr mandatory)
test/                    node --test, against the SDK's fake Gladys and a fake tablet
```

A device is described by **bindings**: `{ feature, read(data), write(value, data) }`.
`read` takes a snapshot of `getSystemData` and returns the Gladys state (or
`null`); `write` turns a Gladys command into `{ endpoint, change }` (or `null`
when there is nothing to do). Add a feature by adding a binding: discovery,
state publication and commands follow.

## Rules

- **External ids are forever.** They are built with
  `gladys.externalIds(type, platformId)` from the system `rid` and the keys the
  tablet gives (`ac1`, `z01`, light and thing ids), never from a name. Changing
  one creates a new device and orphans the old one. The same goes for every key
  users store: manifest `config_schema`, `actions`, widget, scene trigger and
  scene action keys, feature keys.
- **Every feature carries `name`, `min`, `max`, `read_only` and
  `has_feedback`**: Gladys stores them NOT NULL. `test/devices.test.js` checks
  it, and that every writable feature has a `write` and every read-only one none.
- **Gladys enums.** `AC_MODE`, `AC_FAN_SPEED` and `COVER_STATE` in
  `src/devices/mappings.js` mirror `server/utils/constants.js` of Gladys; never
  invent values. `supported_options` values are integers, labels plain strings.
- **The tablet is fragile.** Never send parallel requests (the client queues
  them), never poll faster than every 5 seconds.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  personal data.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Four languages.** Every user-facing text — manifest `label`,
  `description`, `placeholder`, action and widget messages, connection status —
  is a `{ en, fr, de, es }` object, and `docs/en.md`, `docs/fr.md`,
  `docs/de.md`, `docs/es.md` stay in sync. `test/manifest.test.js` checks the
  manifest. The catalog `description` holds 10 to 100 characters per language.
- **Manifest minimum version.** `keywords` and `countries` require
  `gladys_version >= 5.3.0` (and `widgets` / `scene_*` 5.1.0, `categories`
  4.86.0). The integration is `transports: ["local"]` and declared for the
  countries where Advantage Air is sold (`AU`, `NZ`).
- **Manifest ↔ code.** `test/manifest.test.js` ties the manifest to the code
  (defaults, action, scene action, trigger and widget handlers): change both
  sides together. Scene event `data` only carries keys the trigger declares.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
