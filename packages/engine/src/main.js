const { filter } = require("rxjs/operators");
const mime = require("mime");
const { camelCase } = require("change-case");
const Path = require("path");
const codeUnitFactory = require("./code-unit");
const platformFactory = require("@liquidscale/platform");
const clientFactory = require("./client");

module.exports = function (cluster) {
  console.log("instantiating engine");
  const SUPPORTED_FILE_EXTENSIONS = /[^.]+(.*)$/i;

  const registeredUnits = [];

  const spi = {
    getConfig() {
      return cluster.getConfig();
    },
    normalizeKey(key) {
      const normalizedKey = {
        type: null,
        key: null,
        stereotype: null,
        categories: []
      };
      if (key.indexOf(SUPPORTED_FILE_EXTENSIONS) !== 0) {
        const extension = Path.extname(key);
        const shortName = Path.basename(key, extension);
        const categories = Path.dirname(key).split("/");
        normalizedKey.type = mime.getType(extension);
        normalizedKey.key = camelCase(shortName);
        if (categories.indexOf("client") !== -1 || categories.indexOf("react") !== -1 || categories.indexOf("frontend") !== -1 || shortName.indexOf(".ui.") !== -1) {
          normalizedKey.stereotype = "ui";
        } else if (categories.indexOf("functions") !== -1 || categories.indexOf("function") !== -1 || shortName.indexOf(".fn.") != -1) {
          normalizedKey.stereotype = "fn";
        } else if (categories.indexOf("scopes") !== -1 || categories.indexOf("scope") !== -1 || shortName.indexOf(".scope.") != -1) {
          normalizedKey.stereotype = "scope";
        } else if (categories.indexOf("config") !== -1 || shortName.indexOf(".config.") != -1) {
          normalizedKey.stereotype = "config";
        } else if (categories.indexOf("doc") !== -1 || categories.indexOf("docs") !== -1 || extension === ".md") {
          normalizedKey.stereotype = "doc";
        } else if ([".json", ".yaml", ".yml", ".xml"].indexOf(extension) !== -1) {
          normalizedKey.stereotype = "data";
        } else if (categories.indexOf("test") !== -1 || categories.indexOf("tests") !== -1 || shortName.indexOf(".test.") != -1) {
          normalizedKey.stereotype = "test";
        }
        normalizedKey.categories = categories;
        return normalizedKey;
      } else {
        return { key, type: null, categories: [], stereotype: null };
      }
    },
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
    getSandbox(version = "v1") {
      const platform = platformFactory({ version, engine: spi });
      const client = clientFactory({ framework: "react", engine: spi });
      return {
        version,
        exports: {},
        require(name) {
          switch (name) {
            case "@liquidscale/platform":
              return platform;
            case "@liquidscale/client":
              return client;
          }
        }
      };
    },
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
    async resolveFunction(key, data, opts = { height: 0 }) {
      key = camelCase(key);
      const targetFn = await Promise.reduce(
        registeredUnits.filter(u => u.stereotype === "fn"),
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

      if (targetFn) {
        const platform = require("./platform")({ engine: spi });
        return async function () {
          try {
            console.log("executing function", targetFn);
            if (targetFn.fn.scope) {
              const scope = await targetFn.fn.scope.build(data, { height: opts.height });
              const mutator = scope.getMutator(targetFn.fn.impl, platform);
              return mutator(data, { meta: opts.meta, user: { anonymous: true } /* FIXME */ });
            } else {
              return targetFn.fn.impl(data, { meta: opts.meta, user: { anonymous: true } /* FIXME */ }, platform);
            }
          } catch (err) {
            console.error("engine:resolveFunction:", err);
            throw err;
          }
        };
      }
    },
    async resolveView(name, data, opts = { height: 0 }) {
      name = camelCase(name);
      const targetFn = await Promise.reduce(
        registeredUnits.filter(u => u.stereotype === "fn"),
        async (target, unit) => {
          const exposedApi = await unit.content;
          if (exposedApi[name]) {
            return { scope: exposedApi.scope, fn: exposedApi[name] };
          } else {
            return target;
          }
        },
        null
      );
      if (targetFn) {
        const platform = require("./platform")({ engine: spi });
        return async function () {
          try {
            console.log("executing function", targetFn);
            if (targetFn.fn.scope) {
              const scope = await targetFn.fn.scope.build(data, { height: opts.height });
              const renderer = targetFn.fn.impl(scope, platform);
              return renderer(data, { user: { anonymous: true } /* FIXME */ });
            }
          } catch (err) {
            console.error("engine:resolveFunction:", err);
            throw err;
          }
        };
      }
    },
    async resolveScope(key) {
      console.log("resolveScope:", key);
      key = camelCase(key);
      return Promise.reduce(registeredUnits, (target, unit) => {
        if (unit.stereotype === "scope" && key === unit.key) {
          return unit.content;
        } else {
          return target;
        }
      });
    }
  };

  // register all built-in actions
  require("./actions/install-bundle")(spi);
  require("./actions/exec")(spi);
  require("./actions/query")(spi);
  require("./actions/view")(spi);

  return {};
};
