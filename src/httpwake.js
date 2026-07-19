import EventEmitter from 'events';

class HttpWake extends EventEmitter {
    constructor(config, fetchFn = globalThis.fetch) {
        super();
        this.power = config.power ?? {};
        this.fetch = fetchFn;
        this.logDebug = config.log?.debug;
    }

    getRequestOptions() {
        if (typeof this.power.wakeUrl !== 'string' || this.power.wakeUrl.length === 0) {
            throw new Error(`HTTP wake requires power.wakeUrl.`);
        }

        let url;
        try {
            url = new URL(this.power.wakeUrl);
        } catch {
            throw new Error(`HTTP wake requires a valid power.wakeUrl.`);
        }

        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error(`HTTP wake only supports HTTP and HTTPS URLs.`);
        }

        if (url.username || url.password) {
            throw new Error(`HTTP wake URL must not include credentials.`);
        }

        const configuredMethod = this.power.wakeHttpMethod ?? 'POST';
        const method = typeof configuredMethod === 'string' ? configuredMethod.toUpperCase() : '';
        if (!['GET', 'POST'].includes(method)) {
            throw new Error(`HTTP wake only supports GET and POST requests.`);
        }

        const timeout = this.power.wakeTimeout ?? 5000;
        if (!Number.isInteger(timeout) || timeout < 100 || timeout > 60000) {
            throw new Error(`HTTP wake timeout must be an integer between 100 and 60000 milliseconds.`);
        }

        if (typeof this.fetch !== 'function') {
            throw new Error(`HTTP wake is not supported by this Node.js runtime.`);
        }

        return { url, method, timeout };
    }

    async wake() {
        const { url, method, timeout } = this.getRequestOptions();
        const abortController = new AbortController();
        let timeoutId;

        try {
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    abortController.abort();
                    reject(new Error(`HTTP wake request timed out after ${timeout} milliseconds.`));
                }, timeout);
            });

            const response = await Promise.race([
                this.fetch(url, {
                    method,
                    redirect: 'manual',
                    signal: abortController.signal
                }),
                timeoutPromise
            ]);

            if (!response || !Number.isInteger(response.status)) {
                throw new Error(`HTTP wake request returned an invalid response.`);
            }

            try {
                if (response.body?.cancel) await response.body.cancel();
            } catch {
                // The response body is irrelevant to the wake result.
            }

            if (response.status < 200 || response.status >= 300) {
                throw new Error(`HTTP wake request failed with status ${response.status}.`);
            }

            if (this.logDebug) this.emit('debug', `HTTP wake ${method} succeeded with status ${response.status}.`);
            return true;
        } catch (error) {
            if (error.message?.startsWith('HTTP wake')) throw error;

            const code = error.cause?.code;
            const safeCode = typeof code === 'string' && /^[A-Z0-9_]+$/i.test(code) ? ` (${code})` : '';
            throw new Error(`HTTP wake request failed to connect${safeCode}.`);
        } finally {
            clearTimeout(timeoutId);
        }
    }
}

export default HttpWake;
