module.exports = function (platform) {
  return function (scope) {
    const _state = {};

    return {
      select(config) {
        _state.config = config;
        return this;
      },
      render() {
        console.log("rendering view", _state.config);
        return scope.query(_state.config);
      }
    };
  };
};
