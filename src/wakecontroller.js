import EventEmitter from 'events';
import HttpWake from './httpwake.js';
import WakeOnLan from './wol.js';

class WakeController extends EventEmitter {
    constructor(config, handlers = {}) {
        super();

        const configuredWakeMethod = config.power?.wakeMethod ?? 'wol';
        const wakeMethod = typeof configuredWakeMethod === 'string' ? configuredWakeMethod.toLowerCase() : '';
        switch (wakeMethod) {
            case 'wol':
                this.wakeHandler = handlers.wol ?? new WakeOnLan(config);
                break;
            case 'http':
                this.wakeHandler = handlers.http ?? new HttpWake(config);
                break;
            default:
                throw new Error(`Unsupported power wake method: ${wakeMethod}.`);
        }

        this.wakeHandler.on?.('debug', (debug) => this.emit('debug', debug));
        this.wakeHandler.on?.('error', (error) => this.emit('error', error));
    }

    async wake() {
        return this.wakeHandler.wake();
    }
}

export default WakeController;
