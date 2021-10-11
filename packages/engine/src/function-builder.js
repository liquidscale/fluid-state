module.exports = function (factory, platform, engine) {
  const { scopeRef } = require("@liquidscale/platform")({ engine });
  const state = {};

  /**
   * Builder context for this particular function. Each function can have a scope, triggers, dependencies, access to environment,
   * required permissions or subscriptions. The context let LQS optimize how function are called to minimize overhead when not needed
   *  on a per-function basis.
   */
  const fnContext = {
    scope(...args) {
      if (typeof args[0] === "string") {
        console.log("creating a new ref", args);
        state.scope = scopeRef(...args);
      } else {
        console.log("reusing ref", args[0]);
        state.scope = args[0];
      }
      return this;
    },
    trigger() {
      console.log("registering a platform timer trigger", arguments);
      return this;
    },
    immutable() {
      state.immutable = true;
      return this;
    }
  };

  // producing our target function
  const targetFn = factory.call(fnContext, platform);

  // wrapping our function to properly pass the scope and other parameters (tbd)
  return async (data, { key, version, meta, locale, height, user, immutable }) => {
    console.log("calling function %s@%s", key, version || 1);
    try {
      if (state.scope) {
        const scopeInstance = await state.scope.buildForContext({ data, meta, locale, height, user });
        if (scopeInstance) {
          return scopeInstance.immutable(immutable || state.immutable).invoke(targetFn, data, platform.forContext({ meta, locale, user }));
        } else {
          throw new Error("invalid scope ref", state.scope);
        }
      } else {
        return targetFn(data, platform.forContext({ meta, locale, user }));
      }
    } catch (err) {
      console.error("fn", err);
      throw err;
    }
  };
};
