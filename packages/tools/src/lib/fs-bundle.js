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
