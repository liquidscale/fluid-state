module.exports = function ({ type = "memory" } = {}) {
  return require(`@liquidscale/${type}-store`)();
};
