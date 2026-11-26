// A trimmed-down `getSystemData` answer of a MyPlace tablet: one air
// conditioner with four zones (two with a sensor, one with motion detection,
// one placeholder beyond noOfZones), two MyLights and three MyThings.

export function systemData() {
  return {
    aircons: {
      ac1: {
        info: {
          aaAutoFanModeEnabled: true,
          airconErrorCode: '',
          climateControlModeEnabled: false,
          countDownToOff: 0,
          countDownToOn: 0,
          fan: 'high',
          filterCleanStatus: 0,
          freshAirStatus: 'off',
          mode: 'cool',
          myAutoModeEnabled: true,
          myZone: 1,
          name: 'Main AC',
          noOfZones: 3,
          setTemp: 24,
          state: 'on',
        },
        zones: {
          z01: {
            error: 0,
            maxDamper: 100,
            measuredTemp: 25.4,
            minDamper: 0,
            motion: 0,
            motionConfig: 2,
            name: 'Living',
            number: 1,
            rssi: 40,
            setTemp: 24,
            state: 'open',
            type: 1,
            value: 100,
          },
          z02: {
            error: 0,
            maxDamper: 100,
            measuredTemp: 23.1,
            minDamper: 0,
            motion: 0,
            motionConfig: 1,
            name: 'Bedroom',
            number: 2,
            rssi: 35,
            setTemp: 22,
            state: 'close',
            type: 1,
            value: 50,
          },
          z03: {
            error: 0,
            maxDamper: 100,
            measuredTemp: 0,
            minDamper: 0,
            motion: 0,
            motionConfig: 0,
            name: 'Hallway',
            number: 3,
            rssi: 0,
            setTemp: 25,
            state: 'open',
            type: 0,
            value: 80,
          },
          z04: {
            measuredTemp: 0,
            name: 'Zone 4',
            number: 4,
            rssi: 0,
            setTemp: 25,
            state: 'close',
            type: 0,
            value: 100,
          },
        },
      },
    },
    myLights: {
      lights: {
        a1b2c3: { id: 'a1b2c3', name: 'Kitchen', relay: false, state: 'on', value: 60 },
        d4e5f6: { id: 'd4e5f6', name: 'Porch', relay: true, state: 'off' },
      },
    },
    myThings: {
      things: {
        200001: { id: '200001', name: 'Blind', channelDipState: 1, value: 100 },
        200002: { id: '200002', name: 'Garage', channelDipState: 3, value: 0 },
        200003: { id: '200003', name: 'Pump', channelDipState: 8, value: 100 },
      },
    },
    system: {
      hasAircons: true,
      hasLights: true,
      hasThings: true,
      name: 'MyPlace',
      needsUpdate: false,
      rid: 'abc123XYZ',
      sysType: 'MyPlace',
    },
  };
}

/**
 * A fake Advantage Air client recording the changes it receives.
 */
export function fakeClient(data = systemData()) {
  return {
    data,
    changes: [],
    failing: false,
    async getSystemData() {
      if (this.failing) {
        throw new Error('unreachable');
      }
      return structuredClone(this.data);
    },
    async change(endpoint, change) {
      this.changes.push({ endpoint, change });
      return true;
    },
  };
}
