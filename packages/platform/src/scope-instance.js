module.exports = function (engine) {
  const scopeRegistry = engine.getRegistry("scopes");

  function createInstanceKey(key, instanceId) {
    return instanceId ? `${key}_${instanceId}` : key;
  }

  return async function (key, instanceId, spec, { data, meta, height, locale, user } = {}) {
    const instanceKey = createInstanceKey(key, instanceId);
    let instance = await scopeRegistry.get(instanceKey);
    if (instance) {
      console.log("found existing scope instance", instance);
      return spec.selector ? instance.select(spec.selector) : instance;
    } else {
      console.log("instantiating scope %s(%s)", key, instanceId, { spec, data, meta, height, locale, user });

      const state = {
        instanceKey,
        instanceId,
        key,
        selector: null,
        locale,
        height,
        user,
        meta,
        reducers: spec.reducers || [],
        children: engine.getRegistry(`scopes/${instanceKey}`)
      };

      const impl = await engine.createScope(state, spec);

      instance = {
        immutable(value) {
          state.immutable = !!value;
          return this;
        },
        select(selector) {
          state.selector = selector;
          return this;
        },
        async invoke(fn, data, context) {
          console.log("invoking function", fn, { data }, state);
          if (state.immutable) {
            console.log("loading immutable state for scope %s(%s)", key, instanceId);
            const state = impl.getState();
            return fn(state, data, context);
          } else {
            console.log("loading mutable state for scope %s(%s)", key, instanceId);
            return impl.getMutator(fn)(data, context);
          }
        },
        query(...args) {
          return impl.query(...args);
        }
      };

      scopeRegistry.register(instanceKey, instance);

      return instance;
    }
  };
};
