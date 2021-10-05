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
const { filter } = require("rxjs/operators");
const { camelCase } = require("change-case");
const codeUnitFactory = require("./code-unit");
const platformFactory = require("@liquidscale/platform");
const uniqid = require('uniqid');
const { matches } = require('lodash');

module.exports = function (cluster) {
  const registeredUnits = [];

  const engineId = uniqid();

  async function findUnit(key, criteria) {
    return Promise.reduce(
        filter(registeredUnits, matches(criteria)),
        async (target, unit) => {
          const exposedApi = await unit.content;
          if (exposedApi[key]) {
            return { scope: exposedApi.scope, fn: exposedApi[key] };
          } else {
            return target;
          }
        },
        null
    );
  }

  const spi = {
    getId() {
      return engineId;
    },
    getConfig() {
      return cluster.getConfig();
    },
    normalizeKey: require('./spi/normalize-key')(),
    action(type, handler) {
      return cluster.actions.pipe(filter(action => action.action === type)).subscribe(action => handler(action));
    },
    createCodeUnit({ key, content }) {
      const infos = spi.normalizeKey(key);
      return codeUnitFactory(spi)({ ...infos, content });
    },
    getPlatform(version = "v1") {
      return platformFactory({ version, engine: spi });
    },
    getSandbox: require('./spi/get-sandbox')(),
    installUnit(unit) {
      registeredUnits.push(unit);
      cluster.emit({ type: "install-unit", unit });
    },
    updateUnit(unit) {
      const existing = registeredUnits.findIndex(u => u.stereotype === unit.stereotype && u.key === unit.key);
      if (existing) {
        console.log("updating unit", unit);
        registeredUnits.splice(existing, 1, unit);
        cluster.emit({ type: "update-unit", unit });
      }
    },
    removeUnit(unit) {
      const existing = registeredUnits.findIndex(u => u.stereotype === unit.stereotype && u.key === unit.key);
      if (existing) {
        registeredUnits.splice(existing, 1);
        cluster.emit({ type: "remove-unit", unit });
      }
    },
    resolveFunction: require('./spi/resolve-function')({ findUnit, engine: spi }),
    resolveView: require('./spi/resolve-view')({ findUnit, engine: spi }),
    async resolveScope(key) {
      key = camelCase(key);
      return Promise.reduce(registeredUnits, (target, unit) => {
        if (unit.stereotype === "scope" && key === unit.key) {
          return unit.content;
        } else {
          return target;
        }
      });
    },
    async getRegistry(key) {
      return cluster.getRegistry(key, engineId);
    },
  };

  // register all built-in actions
  require("./actions/install-bundle")(spi);
  require("./actions/exec")(spi);
  require("./actions/query")(spi);
  require("./actions/view")(spi);

  return {
    getId() {
      return engineId;
    }
  };
};
