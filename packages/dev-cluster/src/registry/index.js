const { isFunction } = require('lodash');

module.exports = function registryFactory(key, hydrator) {
    const registries = {};

    function registry() {
        const objects = {};
        return {
            async get(key) {
                const dehydrated = objects[key];
                if(dehydrated) {
                    if(hydrator && isFunction(hydrator.hydrate)) {
                        return hydrator.hydrate(dehydrated);
                    }
                    else {
                        return JSON.parse(hydrated);
                    }
                }
                else {
                    return null;
                }
            },
            async registry(key, data) {
                if(hydrator && isFunction(hydrator.dehydrate)) {
                    objects[key] = await hydrator.dehydrate(data);
                }
                else {
                    objects[key] = JSON.stringify(data);
                }
            }
        }
    }

    if(!registries[key]) {
        registries[key] = registry();
    }

    return registries[key];
}