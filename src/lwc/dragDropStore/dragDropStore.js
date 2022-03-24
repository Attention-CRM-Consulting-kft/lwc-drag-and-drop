const stores = {}
const storeActions = {}

function registerDragDropper(thisArg, {name, handler, initialState}) {
    if (name != null) {
        if (!stores[name]) {
            let store = {
                state: {},
                version: 0,
                subscribers: [],
                publishChange(version) {
                    for (const subscriber of this.subscribers) {
                        if (version === store.version) {
                            subscriber.handler.call(subscriber.subscriber, store.state);
                        }
                    }
                }
            }
            if (initialState) {
                store.state = initialState;
            }
            let storeAction = {
                setState(state) {
                    stores[name].state = state;
                    stores[name].publishChange(++stores[name].version);
                },
            };
            stores[name] = store;
            storeActions[name] = storeAction;
        }
        stores[name].subscribers.push({subscriber: thisArg, handler: handler});
        return storeActions[name];
    }
    console.error('missing store name');
    return null;
}

function unregisterDragDropper(thisArg, name) {
    if (name) {
        if(stores[name]){
            stores[name].subscribers = stores[name].subscribers.filter(e => e.subscriber !== thisArg);
        }
    } else {
        for (let store in stores) {
            stores[store].subscribers = stores[store].subscribers.filter(e => e.subscriber !== thisArg);
        }
    }
}

export {registerDragDropper}
export {unregisterDragDropper}
