import assert from 'node:assert/strict';
import test from 'node:test';
import HttpWake from '../src/httpwake.js';

const config = (power = {}) => ({
    power: {
        wakeMethod: 'http',
        wakeUrl: 'http://192.168.0.50:8080/tv/on',
        ...power
    }
});

test('HTTP wake defaults to POST and accepts a 2xx response', async () => {
    let request;
    const fetchFn = async (url, options) => {
        request = { url, options };
        return { status: 204 };
    };

    const result = await new HttpWake(config(), fetchFn).wake();

    assert.equal(result, true);
    assert.equal(request.url.href, 'http://192.168.0.50:8080/tv/on');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.redirect, 'manual');
});

test('HTTP wake supports GET', async () => {
    let method;
    const fetchFn = async (url, options) => {
        method = options.method;
        return { status: 200 };
    };

    await new HttpWake(config({ wakeHttpMethod: 'GET' }), fetchFn).wake();

    assert.equal(method, 'GET');
});

test('HTTP wake rejects non-2xx responses without retrying', async () => {
    let calls = 0;
    const fetchFn = async () => {
        calls++;
        return { status: 503 };
    };

    await assert.rejects(
        new HttpWake(config(), fetchFn).wake(),
        /failed with status 503/
    );
    assert.equal(calls, 1);
});

test('HTTP wake does not follow redirects', async () => {
    let redirect;
    const fetchFn = async (url, options) => {
        redirect = options.redirect;
        return { status: 302 };
    };

    await assert.rejects(new HttpWake(config(), fetchFn).wake(), /failed with status 302/);
    assert.equal(redirect, 'manual');
});

test('HTTP wake times out cleanly', async () => {
    const fetchFn = async () => new Promise(() => {});

    await assert.rejects(
        new HttpWake(config({ wakeTimeout: 100 }), fetchFn).wake(),
        /timed out after 100 milliseconds/
    );
});

test('HTTP wake reports connection errors without exposing the URL', async () => {
    const fetchFn = async () => {
        const error = new TypeError('fetch failed for http://user:secret@192.168.0.50:8080/tv/on');
        error.cause = { code: 'ECONNREFUSED' };
        throw error;
    };

    await assert.rejects(
        new HttpWake(config(), fetchFn).wake(),
        (error) => {
            assert.match(error.message, /failed to connect \(ECONNREFUSED\)/);
            assert.doesNotMatch(error.message, /user|secret|192\.168\.0\.50/);
            return true;
        }
    );
});

test('HTTP wake rejects incomplete or invalid configuration before requesting', async () => {
    let calls = 0;
    const fetchFn = async () => {
        calls++;
        return { status: 200 };
    };

    await assert.rejects(new HttpWake(config({ wakeUrl: undefined }), fetchFn).wake(), /requires power\.wakeUrl/);
    await assert.rejects(new HttpWake(config({ wakeUrl: 'file:///tmp/wake' }), fetchFn).wake(), /only supports HTTP and HTTPS/);
    await assert.rejects(new HttpWake(config({ wakeUrl: 'http://user:secret@192.168.0.50:8080/tv/on' }), fetchFn).wake(), /must not include credentials/);
    await assert.rejects(new HttpWake(config({ wakeHttpMethod: 'DELETE' }), fetchFn).wake(), /only supports GET and POST/);
    await assert.rejects(new HttpWake(config({ wakeTimeout: 0 }), fetchFn).wake(), /timeout must be an integer/);
    assert.equal(calls, 0);
});
