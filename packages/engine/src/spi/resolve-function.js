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
const { camelCase } = require("change-case");

module.exports = function ({ findUnit, engine }) {
  return async function resolveFunction(key, data, opts = { height: 0 }) {
    key = camelCase(key);
    const targetFn = await findUnit(key, { stereotype: "fn" });
    if (targetFn) {
      return async function () {
        try {
          const platform = require("@liquidscale/platform")({ engine });
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
  };
};
