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
const { createServer } = require("vite");
const fs = require("fs-extra");
const Path = require("path");

module.exports = function (cluster) {
  return function (config) {
    console.log("starting frontend server", config);
    const state = {};

    async function copyUnit(unit, targetFilePath) {
      try {
        const unitContent = await unit.content;
        await fs.ensureDir(Path.dirname(targetFilePath));
        await fs.writeFile(targetFilePath, unitContent, "utf8");
      } catch (err) {
        console.error("unable to update unit", unit, err);
      }
    }

    cluster.on({ type: "install-unit", unit: { stereotype: "ui" } }, function ({ unit }) {
      const targetFilePath = Path.join(state.tmpWebRoot, "src", unit.categories.slice(1).join("/"), `${unit.key}.jsx`);
      console.log("installing ui component %s to target path", unit.key, targetFilePath);
      copyUnit(unit, targetFilePath);
    });

    cluster.on({ type: "update-unit", unit: { stereotype: "ui" } }, function ({ unit }) {
      const targetFilePath = Path.join(state.tmpWebRoot, "src", unit.categories.slice(1).join("/"), `${unit.key}.jsx`);
      console.log("copying unit %s to target path", unit.key, targetFilePath);
      copyUnit(unit, targetFilePath);
    });

    cluster.on({ type: "remove-unit", unit: { stereotype: "ui" } }, function ({ unit }) {
      console.log("removing ui unit to web app", unit);
      const targetFilePath = Path.join(state.tmpWebRoot, "src", unit.categories.slice(1).join("/"), `${unit.key}.jsx`);
      console.log("removing unit %s to target path", unit.key, targetFilePath);
      async function deleteFile() {
        await fs.remove(targetFilePath);
      }
      deleteFile();
    });

    (async function () {
      state.tmpWebRoot = await fs.mkdtemp("/tmp/");
      console.log("serving files from ", state.tmpWebRoot);

      // copy our base app to the temp folder
      await fs.copy(Path.resolve(__dirname, "..", "frontend", "base-app"), state.tmpWebRoot, { recursive: true, overwrite: true });

      state.server = await createServer({
        root: state.tmpWebRoot,
        server: {
          port: config.port || 5000
        }
      });

      console.log("frontend server is listening at http://localhost:5000/");
      await state.server.listen();
    })();

    return {};
  };
};
