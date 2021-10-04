const { BehaviorSubject, Subject, ReplaySubject } = require("rxjs");
const { map } = require("rxjs/operators");
const { applyPatches, enablePatches, produceWithPatches } = require("immer");
const JsonQ = require("json-q");
const { isFunction, isUndefined } = require("lodash");
const uniqid = require("uniqid");

enablePatches();

module.exports = function () {
  const storeId = uniqid("store-");
  console.log("creating new memory store", storeId);
  const frames = new ReplaySubject();
  const changes = new Subject();
  const _state = new BehaviorSubject();
  let _height = 0;

  // Apply mutation changes to our state
  changes.subscribe(frame => {
    if (frame.patches) {
      _state.next(applyPatches(_state.getValue(), frame.patches));
    } else {
      _state.next(frame.nextState);
    }
  });

  return {
    id: storeId,
    async initState(initialValue, context) {
      console.log("initialize state", storeId);
      if (!initialValue) {
        return;
      }
      // Only apply if we don't have a current value
      if (isUndefined(_state.getValue())) {
        if (isFunction(initialValue)) {
          _state.next(await initialValue(context));
          _height = 1;
        } else {
          _state.next(initialValue);
          _height = 1;
        }
      }
    },
    getState() {
      console.log("retrieving state", storeId, _state.getValue());
      return _state.getValue();
    },
    mutate(mutator, context = {}) {
      const state = _state.getValue();

      const frame = {
        height: ++_height,
        patches: [],
        inverses: []
      };

      const [nextState, patches, inverses] = produceWithPatches(state, draft => {
        const result = mutator(draft, context);
        if (result && result.init) {
          return result.init;
        }
      });

      frame.patches = patches;
      frame.inverses = inverses;
      if (!patches) {
        frame.nextState = nextState;
      }

      if ((patches && patches.length > 0) || frame.nextState) {
        frames.next(frame);
        changes.next(frame);
      }

      return nextState;
    },
    buildMutator(factory, platform) {
      return function (data, context) {
        const state = _state.getValue();

        const frame = {
          height: ++_height,
          patches: [],
          inverses: []
        };

        const [nextState, patches, inverses] = produceWithPatches(state, draft => {
          const result = factory(draft, platform)(data, context);
          if (result && result.init) {
            return result.init;
          }
        });

        frame.patches = patches;
        frame.inverses = inverses;
        if (!patches) {
          frame.nextState = nextState;
        }

        if (patches.length > 0 || frame.nextState) {
          frames.next(frame);
          changes.next(frame);
        }
      };
    },
    loadState({ height = 0, selector } = {}) {
      console.log("loading state", storeId, selector, height);
      if (height === 0) {
        return _state
          .pipe(
            map(state => {
              if (selector) {
                state = JsonQ.get(state, selector);
              }
              console.log("producing state", storeId, state);
              return state;
            })
          )
          .asObservable();
      } else {
        console.warn("past or future queries not supported yet!");
      }
    }
  };
};
