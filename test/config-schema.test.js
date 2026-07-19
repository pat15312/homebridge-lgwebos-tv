import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('configuration schema defaults to WOL and requires a URL for HTTP wake', async () => {
    const schema = JSON.parse(await readFile(new URL('../config.schema.json', import.meta.url), 'utf8'));
    const power = schema.schema.properties.devices.items.properties.power;

    assert.equal(power.properties.wakeMethod.default, 'wol');
    assert.deepEqual(power.properties.wakeHttpMethod.anyOf.flatMap(option => option.enum), ['POST', 'GET']);
    assert.equal(power.properties.wakeTimeout.default, 5000);
    assert.deepEqual(power.allOf[0].then.required, ['wakeUrl']);
});
