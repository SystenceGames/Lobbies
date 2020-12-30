import events = require('events');
import settings = require('./config/settings');

class EventBus extends events.EventEmitter {

    emit(event: string, arg1?: any, arg2?: any): boolean {
        if (settings.eventBusMessagesToNotLog.indexOf(event) < 0) {
            console.log("EventBus sending message: " + event);
        }
        return super.emit(event, arg1, arg2);
    }
    //on(event: string, listener: Function): events.EventEmitter {
    //    debugger;
    //    return super.on(event, listener);
    //}
}
let eventBus: events.EventEmitter = new EventBus();
eventBus.setMaxListeners(50);
export = eventBus;