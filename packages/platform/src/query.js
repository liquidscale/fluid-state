const JsonQ = require("json-q");
const mm = require("micromongo");
const uniqid = require("uniqid");
const { BehaviorSubject } = require("rxjs");
const { filter, map } = require("rxjs/operators");
const { createHash } = require("crypto");
const { isUndefined } = require("lodash");

module.exports = function (engine) {
  return function (state, { selector, query, projection, sort, limit, skip } = {}) {
    const q = {
      id: uniqid(),
      state: new BehaviorSubject(),
      hash: null
    };

    // Connect query result to our query state
    const queryResult = q.state.pipe(
      filter(result => {
        if (result) {
          // quickly check if our selected data has changed since last
          const hash = createHash("md5").update(JSON.stringify(result)).digest("hex");
          const modified = hash !== q.hash;
          q.hash = hash;
          return modified;
        }
      }),
      map(result => {
        if (query) {
          if (Array.isArray(result)) {
            return mm.find(result, query, projection);
          } else {
            return JsonQ.get(result, query);
          }
        }
        /* query */
        return result;
      }),
      map(result => {
        const stages = [];
        if (Array.isArray(result)) {
          !isUndefined(limit) && stages.push({ $sort: sort });
          !isUndefined(skip) && stages.push({ $limit: limit });
          !isUndefined(sort) && stages.push({ $skip: skip });
        }

        if (stages.length > 0) {
          return mm.aggregate(result, stages);
        } else {
          return result;
        }
      }),
      map(result => {
        if (projection) {
          const excludes = projection.map(field => (field.indexOf("-") === 0 ? field.substring(1) : null)).filter(identity);
          const includes = intersection(projection, excludes);
          if (Array.isArray(result)) {
            return result.map(r => pick(omit(r, excludes), includes));
          } else {
            return pick(omit(result, excludes), includes);
          }
        } else {
          return result;
        }
      })
    );

    queryResult.subscribe(result => {
      q.state.next(result);
    });

    if (selector) {
      queryResult.next(JsonQ.get(state, selector));
    } else {
      queryResult.next(state);
    }

    return {
      id: q.id,
      result: q.state.asObservable(),
      close() {
        return queryResult.close();
      }
    };
  };
};
