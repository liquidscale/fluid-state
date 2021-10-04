const uniqid = require("uniqid");
const lodash = require("lodash");

module.exports = function ({ version = 1, engine } = {}) {
  const spi = {
    resolveFunction(...args) {
      return engine.resolveFunction(...args);
    },
    resolveScope(...args) {
      return engine.resolveScope(...args);
    },
    getConfig() {
      return engine.getConfig();
    }
  };

  return {
    version,
    idgen: () => uniqid(),
    console,
    ...lodash,
    scopeRef: require("./scope-ref")(spi),
    morph: require("./morph")(spi),
    view: require("./view")(spi),
    config: require("./config")(spi)
  };
};
