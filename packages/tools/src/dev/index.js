module.exports = function (args) {
  return require(`./${args._.length > 0 ? args._.shift() : "watch"}`)(args);
};
