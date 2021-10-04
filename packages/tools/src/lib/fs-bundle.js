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
const Path = require("path");
const { Subject } = require("rxjs");
const chokidar = require("chokidar");
const fs = require("fs-extra");

module.exports = function (root, { name, version, description, watch } = {}) {
  const id = uniqid("bndl");
  const events = new Subject();

  const bundle = {
    id,
    name: name || Path.basename(root),
    version: version || "1.0.0",
    description,
    type: "fs",
    root: Path.resolve(root),
    observe(observer) {
      return events.subscribe(observer);
    }
  };

  // list the content of this path
  const watcher = chokidar.watch("**/*.*", {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    cwd: root
  });

  watcher
    .on("add", path => events.next({ key: "bundle:changed", op: "add", bundle, entries: [{ path, content: fs.readFile(Path.join(bundle.root, path), "utf8") }] }))
    .on("change", path => events.next({ key: "bundle:changed", op: "change", bundle, entries: [{ path, content: fs.readFile(Path.join(bundle.root, path), "utf8") }] }))
    .on("unlink", path => events.next({ key: "bundle:changed", op: "remove", bundle, entries: [{ path }] }))
    .on("error", error => events.next({ key: "bundle:error", error }))
    .on("ready", () => {
      if (!watch) {
        console.log("all components are loaded. we don't want anything.");
        watcher.close();
      }
    });

  return bundle;
};
