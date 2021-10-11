const { BehaviorSubject } = require("rxjs");
const { filter, map } = require("rxjs/operators");

module.exports = function (engine) {
  const scopeRegistry = engine.getRegistry("scopes");

  function createInstanceKey(key, instanceId) {
    return instanceId ? `${key}_${instanceId}` : key;
  }

  return async function scopeInstanceFactory(key, instanceId, spec, { data, meta, height, locale, user } = {}) {
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
        children: engine.getRegistry(`scopes/${instanceKey}`)
      };

      const impl = await engine.createScope(state, spec);

      instance = {
        instanceKey,
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
        },
        async spawn(key, instanceId, spec = {}, refSelector, { height, locale, user, meta, data } = {}) {
          console.log("spawing child scope", { key, instanceId, spec, refSelector }, { height, locale, user, meta, data });
          const childInstanceKey = createInstanceKey(key, instanceId);
          const existingChildInstance = await state.children.get(childInstanceKey);
          if (existingChildInstance) {
            return existingChildInstance.scope;
          }

          // Create our child join state observable to produce initialvalue and refresh the child scope if things changes in the parent collection
          const upstreamValue = new BehaviorSubject();
          spec.upstream = upstreamValue.pipe(
            filter(state => {
              console.log("processing child state", state);
              if (Array.isArray(state)) {
                return state.length > 0;
              } else {
                return true;
              }
            }),
            map(state => {
              console.log("processing child state #2", state);
              if (Array.isArray(state)) {
                return state[0];
              } else {
                return state;
              }
            })
          );

          // Connect our child state to constantly update our child scope if the join inline data changes
          console.log("connecting parent state to child (upstreamValue", { selector: refSelector, query: { id: instanceId } });
          const upstreamStateSubscription = impl.query({ selector: refSelector, query: { id: instanceId } }).result.subscribe(upstreamValue);
          const childInstance = await scopeInstanceFactory(key, instanceId, spec, { data, meta, height, locale, user });
          const childStateSubscription = childInstance.query().result.subscribe(childState => {
            // FIXME: Make sure we don't get an infinite loop with child - parent - child -parent state updates in parent scope collection
            impl.triggerReducers(
              {
                type: "sync-child-state",
                key,
                id: instanceId,
                selector: refSelector,
                scopeInstance: childInstance
              },
              childState
            );
          });

          // register children
          state.children.register(childInstanceKey, {
            childStateSubscription,
            upstreamStateSubscription,
            scopeInstance: childInstance
          });

          return childInstance;
        }
      };

      scopeRegistry.register(instanceKey, instance);

      return instance;
    }
  };
};
