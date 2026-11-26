# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.0] - 2026-11-26

### Added

- First release of the Advantage Air integration for Gladys Assistant, over the
  local API of the wall tablet (MyAir, e-zone, MyPlace): no account, no cloud.
- Air conditioners: power, mode (cool, heat, fan, dry, MyAuto), set point, fan
  speed (low, medium, high, auto / MyFan), turn on / turn off timers and fresh
  air damper.
- Zones: open / close, opening of the zones without sensor, temperature, set
  point, MyZone, motion and sensor signal of the zones with a sensor.
- MyLights (on/off and dimmable) and MyThings (blinds, garage doors, lights and
  relays).
- Scene triggers: air conditioner turned on or off, mode changed, filter needs
  cleaning, error code, zone opened or closed, motion detected in a zone.
- Scene actions: control an air conditioner (power, mode, fan and set point at
  once), control a zone, open or close all zones, set the MyZone, set a timer.
- Dashboard widgets: air conditioner status with a power button, and the zones
  with buttons to open or close them all.
- A "Test the connection" button in the Configuration screen.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/gboulvin/Gladys-Advantage-Air/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gboulvin/Gladys-Advantage-Air/releases/tag/v1.0.0
