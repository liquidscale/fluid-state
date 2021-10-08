const { merge } = require("lodash");
const JsonQ = require("json-q");
const mm = require("micromongo");
const uniqid = require("uniqid");
const { BehaviorSubject } = require("rxjs");
const { filter, map } = require("rxjs/operators");
const { createHash } = require("crypto");
const { isUndefined } = require("lodash");

module.exports = function (engine) {
  return async function scopeFactory({ instanceKey, data, meta, user = {}, locale = "en", height = 0 } = {}, spec) {
    const store = spec.store || require("./memory-store")();

    const scope = {
      getState(selector, query) {
        let result = store.getState();
        if (selector) {
          result = JsonQ.get(result, selector);
        }
        if (query) {
          result = mm.find(result, query);
        }
        return Object.freeze(result);
      },
      getMutator(factory, platform) {
        console.log("get mutator for scope", instanceKey);
        return store.buildMutator(factory, platform);
      },
      mutate(mutator, ctx) {
        console.log("mutate scope", instanceKey);
        return store.mutate(mutator, ctx);
      },
      query({ selector, query, projection, sort, limit, skip } = {}) {
        console.log("query scope", instanceKey, selector, query);

        const q = {
          id: uniqid(),
          height,
          state: new BehaviorSubject(),
          hash: null
        };

        // Connect query result to our query state
        const queryResult = store
          .loadState({
            height: q.height,
            locale,
            selector: selector || spec.selector
          })
          .pipe(
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

        return {
          id: q.id,
          result: q.state.asObservable(),
          close() {
            return queryResult.close();
          }
        };
      },
      async spawn(scopeKey, refSelector, childId, childSpec, { height, data } = {}) {
        console.log("spawn child scope", scopeKey, refSelector, childId);
        const childScopeKey = createHash("md5").update(`${instanceKey}_${childId}`).digest("hex");

        // quick reuse of existing child scope
        const existingChildScopeRef = await state.children.get(childScopeKey);
        if (existingChildScopeRef) {
          console.log("reusing existing child scope", childScopeKey);
          return existingChildScopeRef.scope;
        }

        // Create our child join state observable to produce initialvalue and refresh the child scope if things changes in the parent collection
        const upstreamValue = new BehaviorSubject();
        childSpec.upstream = upstreamValue.pipe(
          filter(state => {
            if (Array.isArray(state)) {
              return state.length > 0;
            } else {
              return true;
            }
          }),
          map(state => {
            if (Array.isArray(state)) {
              return state[0];
            } else {
              return state;
            }
          })
        );

        // Connect our child state to constantly update our child scope if the join inline data changes
        this.query({ selector: refSelector, query: { id: childId } }).result.subscribe(upstreamValue);

        const childScope = await scope(childScopeKey, childSpec, { height, parent: this.spi, data }, engine.getPlatform());

        const scopeRef = {
          key: childScopeKey,
          scope: childScope
        };

        // subscribe to childscope state to update our join if required (update logic override?)
        scopeRef.childSubscription = childScope.query().result.subscribe(childState => {
          // FIXME: Make sure we don't get an infinite loop with child - parent - child -parent state updates in parent scope collection
          triggerReducers(
            {
              type: "sync-child-state",
              key: scopeKey,
              id: childId,
              selector: refSelector,
              childScope
            },
            childState
          );
        });

        await state.children.register(childScopeKey, scopeRef);

        return childScope;
      }
    };

    // Apply any available initial value to our scope state (if not already initialized)
    await store.initState(spec.initialValue, { id: instanceKey, data, meta, user, locale, height });

    if (spec.upstream) {
      console.log("connecting to our upstream parent config source");
      // we will receive state updates from our parent scope (analog to config, inline join fields)
      //FIXME: this subscription should be unsubscribed if scope is closed
      state.upstreamSubscription = spec.upstream.subscribe(subscriptionState => {
        console.log("receive upstream state changes", subscriptionState);
        if (subscriptionState) {
          // apply updated join state from our parent. This will trigger all effects, hooks and queries
          store.mutate(function (draft) {
            if (!draft) {
              return { init: subscriptionState };
            } else {
              merge(draft, subscriptionState);
            }
          });
        }
      });
    }

    function triggerReducers(context, nextState) {
      console.log("looking for registered reducers on this scope able to process the incoming context", context);
      const platform = engine.getPlatform();
      return store.mutate(function (draft) {
        // mutate our store with the result of all reducers. no new frame will be produced if nothing is changed
        reducers.map(reducer => reducer(context, draft, nextState, platform));
      });
    }

    return scope;
  };
};
