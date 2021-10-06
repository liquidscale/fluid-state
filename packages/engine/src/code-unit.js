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
const compiler = require("./compiler");
const vm = require("vm");
const Yaml = require("js-yaml");
const scopeFactory = require("./scope");

function functionFactory(id, impl, scope, engine) {
  console.log("installing function", id);
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
      case "asset":
        return async function (content) {
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
