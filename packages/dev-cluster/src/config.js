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
const { BehaviorSubject } = require("rxjs");
const { get, merge, identity } = require("lodash");
const { filter, map } = require("rxjs/operators");
const Yaml = require("js-yaml");
const oh = require("object-hash");
const { createHash } = require("crypto");
const fs = require("fs-extra");
const Path = require("path");

module.exports = function config(root, events) {
  let baseConfig = {};
  if (fs.existsSync(Path.resolve(root, "lqs.yaml"))) {
    baseConfig = Yaml.load(fs.readFileSync(Path.resolve(root, "lqs.yaml"), "utf8"));
    console.log("loaded based config", baseConfig);
  }

  console.log("basic config", baseConfig);
  const cfg = new BehaviorSubject(baseConfig);

  events.pipe(filter(event => event.type && ["install-unit", "update-unit", "remove-unit"].indexOf(event.type) !== -1 && event.unit.stereotype === "config")).subscribe(event => {
    // apply content any modified config
    if (event.component.type === "text/yaml") {
      const content = Yaml.load(event.component.content);
      cfg.next(merge(cfg.getValue(), content));
    } else if (event.component.type === "application/json") {
      const content = JSON.parse(event.component.content);
      cfg.next(merge(cfg.getValue(), content));
    } else {
      console.log("skipping unrecognized support file", event.component.file);
    }
  });

  events
    .pipe(
      filter(event => ["install-unit", "update-unit", "remove-unit"].indexOf(event.type) !== -1),
      filter(event => event.unit.stereotype === "data" && event.unit.key === "lqs")
    )
    .subscribe(event => {
      console.log("detected data file change", event);
      async function updateConfig() {
        const data = await event.unit.content;
        console.log("merging new data", data);
        cfg.next(merge(cfg.getValue(), data));
      }
      updateConfig();
    });

  const watchedKeys = {};

  return {
    keyChanged(key) {
      return cfg.asObservable().pipe(
        map(config => {
          const target = get(config, key);
          if (target) {
            const hashKey = createHash("md5").update(key).digest("hex");
            const newHash = oh(target);
            const prevHash = watchedKeys[hashKey];
            if (newHash !== prevHash) {
              watchedKeys[hashKey] = newHash;
              return target;
            }
          }
        }),
        filter(identity)
      );
    },
    changes: cfg.asObservable().pipe(filter(identity)),
    get(key, devaultValue, transform) {
      const val = get(cfg.getValue(), key) || devaultValue;
      if (transform) {
        return transform(val);
      } else {
        return val;
      }
    }
  };
};
