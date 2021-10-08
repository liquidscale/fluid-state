module.exports = function ({ findUnit }) {
  return async function (key) {
    return findUnit(key, { stereotype: "scope" });
  };
};
