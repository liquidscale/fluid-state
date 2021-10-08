module.exports = function (factory, platform, engine) {
  const { scopeRef } = require("@liquidscale/platform")({ engine });
  const state = {};

  const scopeContext = {
    scope(...args) {
      state.parent = scopeRef(...args);
      return this;
    }
  };

  // producing our target function
  const targetFn = factory.call(scopeContext, platform);

  // wrapping our function to properly pass the scope and other parameters (tbd)
  return async ({ key, height, locale, user, meta, data = {} }, spec = {}) => {
    const instanceId = data[spec.idField || "id"];
    console.log("executing targetfn to retrieve the scope spec", key, instanceId);

    if (state.parent) {
      const parentScopeInstance = await state.scope.buildForContext({ data, meta, locale, height, user });
      return parentScopeInstance.spawn(targetFn, instanceId, spec);
    } else {
      const spec = await targetFn(instanceId);
      return platform.scopeInstance(key, instanceId, spec, { data, meta, height, locale, user });
    }
  };
};
