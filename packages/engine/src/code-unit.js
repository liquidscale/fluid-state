const compiler = require("./compiler");
const vm = require("vm");
const Yaml = require("js-yaml");
const scopeFactory = require("./scope");

function functionFactory(id, impl, scope, engine) {
  console.log("creating functions", id, impl, scope);
  return {
    id,
    impl,
    scope
  };
}

module.exports = function (engine) {
  function contentFactory(stereotype, type) {
    switch (stereotype) {
      case "scope":
      case "config":
      case "fn":
        return async function (content) {
          // compile using babel
          const code = compiler.compileScript(await content);
          const script = new vm.Script(code);
          try {
            const sandbox = engine.getSandbox();
            const context = vm.createContext(sandbox);
            script.runInContext(context);
            let exposedApi = null;
            if (sandbox.exports.default) {
              exposedApi = sandbox.exports.default;
            } else {
              exposedApi = sandbox.exports;
            }

            if (stereotype === "scope") {
              return scopeFactory(exposedApi, engine);
            } else if (stereotype === "fn") {
              return Object.keys(exposedApi).reduce((api, name) => {
                if (name !== "scope") {
                  api[name] = functionFactory(name, exposedApi[name], exposedApi.scope, engine);
                }
                return api;
              }, {});
            } else if (stereotype === "config") {
              console.log("unsupported config component righ now");
            } else {
              console.log("unknown stereotype ", steteotype);
            }
          } catch (err) {
            console.error("runtime error", err);
          }
        };
      case "ui":
        return async function (content) {
          // content of the JSX is pushed as-is to the frontend server
          return content;
        };
      case "doc":
        return async function (content) {
          // FIXME: parse markdown + frontmatter
          return content;
        };
      case "data":
        return async function (content) {
          if (type === "text/yaml") {
            return Yaml.load(await content);
          } else if (type === "application/json") {
            return JSON.parse(await content);
          } else {
            return content;
          }
        };
    }
  }

  return function ({ key, stereotype, type, categories, content }) {
    return {
      key,
      stereotype,
      type,
      categories,
      content: contentFactory(stereotype, type)(content)
    };
  };
};
