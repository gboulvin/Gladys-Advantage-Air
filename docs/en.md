# Advantage Air

Control your **Advantage Air** ducted air conditioning — **MyAir**, **e-zone**
and **MyPlace** systems — from Gladys. The integration talks to the wall tablet
of the system over your **local network**: no account, no cloud, it keeps
working without Internet.

## Overview

Once configured, the integration finds every device of the system:

- **Air conditioners**: on/off, mode (cool, heat, fan, dry and MyAuto when
  available), set point (16–32 °C), fan speed (low, medium, high, auto /
  MyFan), turn on and turn off timers (minutes), fresh air when fitted.
- **Zones**: open / close, opening (5–100 %) of the zones without a
  temperature sensor; temperature, set point, **MyZone**, sensor signal and
  motion (when the sensor detects it) of the zones with a sensor.
- **MyLights**: on/off and brightness of the dimmable lights.
- **MyThings**: blinds and garage doors (open / close), lights and relays.

## Prerequisites

- An Advantage Air system with its wall tablet running the **MyAir**,
  **e-zone** or **MyPlace** app. Keep the app open: it serves the local API.
- The tablet and Gladys on the **same local network**.
- A **fixed IP address** for the tablet: reserve it in your router (DHCP
  reservation), otherwise the integration loses it when the address changes.
- Gladys 5.3 or later.

## Configuration

1. Find the IP address of the tablet (Android settings → About tablet →
   Status, or the list of devices of your router).
2. In Gladys, open the integration's **Configuration** tab and enter it in
   **Tablet IP address**. Keep the port **2025**.
3. Optionally change the **Refresh interval**: how often the tablet is read
   (15 seconds by default, 5 to 300). A shorter interval shows changes made on
   the tablet sooner.
4. Save, then click **Test the connection**: the integration lists the air
   conditioners, zones, lights and things it found.
5. Open the **Discovery** tab and add the devices you want.

## Scenes

The scene editor gets new cards in the **Integrations** category:

- Triggers: **Air conditioner turned on or off**, **Air conditioning mode
  changed**, **Filter needs cleaning**, **Air conditioner error**, **Zone
  opened or closed**, **Motion detected in a zone**. Each one can be filtered
  on a device; their details are readable in the following actions, e.g.
  `{{triggerEvent.data.error_code}}`.
- Actions: **Control an air conditioner** (power, mode, fan and set point in a
  single command), **Control a zone**, **Open or close all zones**, **Set the
  MyZone**, **Set a timer** (0 minutes cancels it).

The usual device state triggers and "control a device" actions work too.

## Dashboard

- **Air conditioner** widget: set point and MyZone temperature (live), power,
  mode, fan, filter, error and timers, with a button to turn the unit on or
  off.
- **Zones** widget: state, opening and temperature of every zone, with buttons
  to open or close them all.

In the widget settings, pick the air conditioner to show (the first one
otherwise).

## Troubleshooting

- **"The Advantage Air tablet does not answer"**: check that the tablet is on,
  that the MyAir / e-zone / MyPlace app is open (the tablet must not be asleep
  with the app closed), and that the address has not changed. Open
  `http://<tablet address>:2025/getSystemData` in a browser on the same
  network: you should see a JSON document.
- **A change made in Gladys comes back to its previous value**: the unit
  refused it (e.g. MyAuto mode on a system without it). The integration always
  shows the state the tablet confirms.
- **A zone is missing**: zones beyond the number configured on the unit are
  ignored. Zones added later appear in the Discovery tab.
- **Security**: the local API of the tablet has no password. Never expose port
  2025 to the Internet.
