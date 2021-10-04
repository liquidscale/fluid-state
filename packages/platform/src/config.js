module.exports = function (engine) {
  const handler = {
    get(target, key) {
      return target.get(key);
    }
  };

  return new Proxy(engine.getConfig(), handler);
};
