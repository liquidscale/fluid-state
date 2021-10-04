module.exports = function (engine) {
  return function (scopeKey, spec) {
    console.log("creating a scope reference", scopeKey, spec);
    return {
      async build(data, { height = 0 } = {}, opts = {}) {
        console.log("rebuilding scope %s from ref at height", scopeKey, height, data, spec, opts);
        const targetScope = await engine.resolveScope(scopeKey);
        if (targetScope) {
          // support overriding idField to match the current call's data
          if (opts.idField) {
            spec.idField = opts.idField;
          }
          console.log("rebuilding scope instance", { height, data }, spec);
          return targetScope.build({ height, data }, spec);
        } else {
          throw new Error("unknown scope");
        }
      }
    };
  };
};
