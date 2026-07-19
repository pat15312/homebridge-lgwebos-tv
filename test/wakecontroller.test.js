import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import LgWebOsDevice from '../src/lgwebosdevice.js';
import WakeController from '../src/wakecontroller.js';

class WakeHandler extends EventEmitter {
    constructor() {
        super();
        this.calls = 0;
    }

    async wake() {
        this.calls++;
        return true;
    }
}

const deviceConfig = (power = {}) => ({
    name: 'Test TV',
    host: '192.0.2.10',
    mac: 'ab:cd:ef:fe:dc:ba',
    displayType: 1,
    inputs: {},
    buttons: [],
    sensors: [],
    sound: { modes: [], outputs: [] },
    picture: { modes: [] },
    power
});

test('existing configurations default to WOL and make no HTTP request', async () => {
    const wol = new WakeHandler();
    const http = new WakeHandler();
    const controller = new WakeController(deviceConfig(), { wol, http });

    assert.equal(await controller.wake(), true);
    assert.equal(wol.calls, 1);
    assert.equal(http.calls, 0);
});

test('HTTP configurations invoke only the HTTP wake handler', async () => {
    const wol = new WakeHandler();
    const http = new WakeHandler();
    const controller = new WakeController(deviceConfig({ wakeMethod: 'http' }), { wol, http });

    assert.equal(await controller.wake(), true);
    assert.equal(wol.calls, 0);
    assert.equal(http.calls, 1);
});

test('external integration power-on uses the configured wake controller', async () => {
    const api = {
        platformAccessory: class {},
        hap: {
            Characteristic: {},
            Service: {},
            Categories: {},
            encode: {},
            uuid: {}
        }
    };
    const device = new LgWebOsDevice(api, deviceConfig(), '', '', '', '', '', '');
    const wakeController = new WakeHandler();
    device.wakeController = wakeController;

    assert.equal(await device.setOverExternalIntegration('RESTFul', 'Power', true), true);
    assert.equal(wakeController.calls, 1);
});

test('all device power-on paths use the wake controller and UUID stays MAC-based', async () => {
    const source = await readFile(new URL('../src/lgwebosdevice.js', import.meta.url), 'utf8');
    const wakeCalls = source.match(/this\.wakeController\.wake\(\)/g) ?? [];

    assert.equal(wakeCalls.length, 2);
    assert.doesNotMatch(source, /this\.wol\.wakeOnLan\(\)/);
    assert.match(source, /AccessoryUUID\.generate\(this\.mac\)/);
    assert.doesNotMatch(source, /AccessoryUUID\.generate\([^)]*wake/i);
});
