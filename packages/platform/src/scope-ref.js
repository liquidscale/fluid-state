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

module.exports = function (engine) {
  return function (scopeKey, spec = {}) {
    console.log("creating a scope reference", scopeKey, spec);
    return {
      async buildForContext({ data = {}, meta = {}, locale = "en", height = 0, user = {} }) {
        console.log("rebuilding scope %s from ref at height %d", scopeKey, height, { meta, locale, user, data, spec });
        const { key, version, unit: targetScope } = await engine.resolveScope(scopeKey);
        if (targetScope) {
          return targetScope({ key, version, height, locale, meta, user, data }, spec);
        } else {
          throw new Error("unknown scope");
        }
      }
    };
  };
};
