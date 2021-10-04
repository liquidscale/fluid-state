/**
   MIT License

   Copyright (c) 2021 Joel Grenon

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
 */
const { Subject, Observable } = require("rxjs");
const { filter } = require("rxjs/operators");
const configFactory = require("./config");
const engineFactory = require("@liquidscale/engine");
const fos = require("filter-objects");
const { reduce } = require("lodash");

module.exports = function ({ cwd } = {}) {
  const events = new Subject();
  const actions = new Subject();
  const config = configFactory(cwd, events);

  const state = {
    availableComponents: {},
    engines: [],
    gateways: {}
  };

  const spi = {
    actions: actions.asObservable(),
    on(pattern = {}, observer) {
      return events.pipe(filter(event => fos.matches(pattern, event))).subscribe(observer);
    },
    emit(event) {
      process.nextTick(function () {
        events.next(event);
      });
    },
    execute(event, opts = {}) {
      return new Observable(function subscribe(observer) {
        actions.next({ ...event, $result: observer });
      });
    },
    getConfigValue(key, defaultValue, transform) {
      return config.get(key, defaultValue, transform);
    },
    getConfig() {
      return config;
    }
  };

  config.keyChanged("engines").subscribe(cfg => {
    console.log("received engine config", cfg);
    try {
      events.next({ type: "config", message: "received updated config", ...cfg });
      const engineCount = config.get("size", 1, val => Number(val));
      if (engineCount !== state.engines.length) {
        console.log("adjusting engine size from %d to %d", state.engines.length, engineCount);
        // FIXME: handle increase or decrease. right now, single engine is used
        state.engines.push(engineFactory(spi));
      }
      spi.emit({ type: "component-ready", ready: true, componentKey: "engine" });
    } catch (err) {
      console.error("engines", err);
    }
  });

  config.keyChanged("frontend").subscribe(cfg => {
    console.log("frontend configuration changed detected", cfg.frontend);
    if (cfg) {
      try {
        if (state.frontendServer) {
          state.frontendServer.reload(cfg);
        } else {
          state.frontendServer = require("./frontend-server")(spi)(cfg);
        }
        spi.emit({ type: "component-ready", ready: true, componentKey: "frontend" });
      } catch (err) {
        console.error("frontend", err);
      }
    }
  });

  config.keyChanged("gateways").subscribe(cfg => {
    console.log("gateways configuration changed detected", cfg);
    try {
      if (cfg) {
        state.gateways = Object.keys(cfg).reduce((gateways, key) => {
          if (gateways[key]) {
            gateways[key].reload(cfg[key]);
          } else {
            gateways[key] = require(`./gateways/${key}`)(spi, cfg[key]);
          }
          return gateways;
        }, state.gateways);
      }
      spi.emit({ type: "component-ready", ready: true, componentKey: "gateways" });
    } catch (err) {
      console.error("gateways", err);
    }
  });

  events.pipe(filter(event => event.type === "component-ready")).subscribe(event => {
    try {
      state.availableComponents[event.componentKey] = event.ready;
      console.log("received readiness event", event, state.availableComponents);
      if (Object.keys(state.availableComponents).length >= 2) {
        const systemReady = reduce(state.availableComponents, (ready, val) => ready && val, true);
        if (systemReady) {
          console.log("system is ready");
          spi.emit({ type: "ready" });
        } else {
          console.log("system is not ready");
        }
      } else {
        console.log("not enough component ready");
      }
    } catch (err) {
      console.error("readiness", err);
    }
  });

  return {
    events,
    ready: () => events.pipe(filter(evt => evt.type === "ready")),
    dispatch(action) {
      return new Observable(function (observer) {
        action.$result = observer;
        actions.next(action);
      });
    },
    async terminate() {
      console.log("terminating cluster...");
      return new Promise(function (resolve) {
        events.next({ type: "terminating" });
        setTimeout(function () {
          // TODO: Terminate any outstandard cluster process before existing
          console.log("terminated");
          resolve();
        }, 500);
      });
    }
  };
};
