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
const fos = require("filter-objects");
const { merge, remove, matches, find } = require("lodash");

module.exports = function (engine) {
  return function (target) {
    return {
      upsert(selector, changes) {
        const exists = fos.filter(selector, target);
        if (exists.length > 0) {
          merge(exists[0], changes.$set || changes);
        } else {
          target.push(merge(selector, changes.$set || changes));
        }
      },
      update(selector, changes) {
        const exists = fos.filter(selector, target);
        if (exists.length > 0) {
          merge(exists[0], changes.$set || changes);
        } else {
          throw new Error("cannot-update-undefined");
        }
      },
      delete(selector) {
        console.log("deleting", selector);
        remove(target, matches(selector));
      },
      updateMany(selector, updater) {
        return fos.filter(selector, target).map(updater);
      },
      updateOne(selector, updater) {
        const obj = find(target, matches(selector));
        if (obj) {
          return updater(obj);
        } else {
          throw new Error("cannot-update-undefined");
        }
      }
    };
  };
};
