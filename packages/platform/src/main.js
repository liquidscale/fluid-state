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
const uniqid = require("uniqid");
const lodash = require("lodash");

module.exports = function ({ version = 1, engine } = {}) {
  const spi = {
    resolveFunction(...args) {
      return engine.resolveFunction(...args);
    },
    resolveScope(...args) {
      return engine.resolveScope(...args);
    },
    getConfig() {
      return engine.getConfig();
    },
    getRegistry(...args) {
      return engine.getRegistry(...args);
    },
    createScope(...args) {
      return engine.createScope(...args);
    },
    query: require("./query")(engine)
  };

  const api = {
    version,
    idgen: () => uniqid(),
    console,
    ...lodash,
    scopeRef: require("./scope-ref")(spi),
    morph: require("./morph")(spi),
    mutate: require("./morph")(spi),
    view: require("./view")(spi),
    config: require("./config")(spi),
    timer: require("./timer")(spi)
  };

  api.forContext = function ({ meta, locale, height, user }) {
    return { meta, locale, height, user, ...api };
  };

  api.scopeInstance = require("./scope-instance")(spi);

  return api;
};
