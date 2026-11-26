# Advantage Air for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
controls **Advantage Air** ducted air conditioning systems — **MyAir**,
**e-zone** and **MyPlace** — over the **local network**, through the API of the
wall tablet. No account, no cloud.

Built on the official
[JavaScript integration template](https://github.com/GladysAssistant/integration-template-js)
and the [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

| Manifest   | Value                                             |
| ---------- | ------------------------------------------------- |
| Transport  | `local` only (HTTP to the tablet, port 2025)      |
| Countries  | `AU`, `NZ` (where Advantage Air systems are sold) |
| Categories | `climate`, `lighting`                             |
| Languages  | English, French, German, Spanish                  |
| Gladys     | `>=5.3.0` (`keywords` and `countries` fields)     |

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Devices

| Advantage Air       | Gladys device and features                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Air conditioner     | `air-conditioning` power, mode (cool, heat, fan, dry, MyAuto), target temperature, fan speed (low, medium, high, auto/MyFan); `duration` timers (min); fresh air `switch` |
| Zone without sensor | `switch` open / close, `switch` dimmer opening (5–100 %)                                                                                                                  |
| Zone with sensor    | the above (opening read-only), `temperature-sensor`, `thermostat` target temperature, `switch` MyZone, `signal`, `motion-sensor` when motion is configured                |
| MyLights            | `light` on/off, brightness (dimmable lights)                                                                                                                              |
| MyThings            | blinds and garage doors as `shutter` state + position; lights as `light`; other channels as `switch`                                                                      |

External ids are built from the system `rid` and the keys the tablet gives
(`ac1`, `z01`, light and thing ids): renaming a zone on the tablet keeps the
device and its history.

## Scene triggers, scene actions and widgets

| Kind          | Key                    | What                                                                   |
| ------------- | ---------------------- | ---------------------------------------------------------------------- |
| Scene trigger | `aircon_power_changed` | a unit turned on / off (filter on the state; `state`, `mode`)          |
| Scene trigger | `aircon_mode_changed`  | the mode changed (filter on the mode; `mode`, `previous_mode`)         |
| Scene trigger | `filter_clean_needed`  | the unit asks for its filter to be cleaned                             |
| Scene trigger | `aircon_error`         | the unit reports an error code (`error_code`)                          |
| Scene trigger | `zone_state_changed`   | a zone opened / closed (filter on the state; `state`, `opening`)       |
| Scene trigger | `zone_motion_detected` | the sensor of a zone detected motion                                   |
| Scene action  | `control_aircon`       | power, mode, fan speed and set point in a single change                |
| Scene action  | `control_zone`         | open / close a zone, its opening or its set point                      |
| Scene action  | `set_all_zones`        | open or close every zone of a unit                                     |
| Scene action  | `set_myzone`           | make a zone the MyZone                                                 |
| Scene action  | `set_timer`            | turn on / turn off timer (0 cancels)                                   |
| Widget        | `aircon_status`        | set point, MyZone temperature, mode, fan, filter, errors, power button |
| Widget        | `zones`                | every zone with its state and temperature, open all / close all        |

## How it works

The tablet serves `GET /getSystemData` (the whole system as JSON) and
`GET /setAircon|setLights|setThings?json=<change>`. It has no push channel, so
the integration reads it every `refresh_interval` seconds (15 by default),
publishes only the states that changed (`publishChangedStates`), fires the
scene triggers of the transitions it sees, and re-publishes the discovered
devices when the structure changes (a zone added, a light renamed). Commands
are sent one at a time — the tablet dislikes parallel requests — and the
system is re-read right after, so Gladys shows the state the unit confirmed.

```
index.js              SDK wiring
src/advantageAir.js   HTTP client of the tablet
src/hub.js            refresh loop, states, scene events, commands
src/devices/          tablet data -> Gladys devices (one file per kind)
src/events.js         scene triggers
src/scenes.js         scene actions
src/widgets.js        dashboard widgets
src/actions.js        "Test the connection" button
```

## Development

```bash
npm install
npm test               # node --test, against the SDK's fake Gladys and a fake tablet
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store validation
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="advantage-air" \
LOG_LEVEL=debug \
npm start
```

See [`CLAUDE.md`](CLAUDE.md) for the project rules.

## Release

Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md),
then run **Actions → Release → Run workflow** (`patch`, `minor` or `major`): the
workflow bumps the version in `package.json` and the manifest, rolls the
changelog, tags, builds the multi-arch image to
`ghcr.io/gboulvin/gladys-advantage-air` and publishes the GitHub Release.

## Security

See [`SECURITY.md`](SECURITY.md). The local API of the tablet has no
authentication: keep it on a trusted network.

## Credits

Advantage Air, MyAir, e-zone, MyPlace, MyLights and MyThings are trademarks of
Advantage Air Australia. This project is not affiliated with Advantage Air. The
local API mapping follows the open-source Home Assistant integration.

## License

Apache-2.0
