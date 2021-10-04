const fos = require("filter-objects");
const { merge, remove } = require("lodash");

module.exports = function (engine) {
  return function (target) {
    return {
      upsert(selector, changes) {
        const exists = fos.filter(selector, target);
        if (exists.length > 0) {
          merge(exists[0], changes.$set || changes);
        } else {
          target.push(merge(selector, changes.$set || changes));
        }
      },
      delete(id) {
        console.log("deleting", id);
        remove(target, i => i.id === id);
      }
    };
  };
};
