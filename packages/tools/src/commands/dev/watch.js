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
const clusterFactory = require("@liquidscale/dev-cluster");
const fsBundle = require("../../lib/fs-bundle");

module.exports = function (args) {
  const devRoot = args.root || process.cwd();
  console.log("starting dev cluster in development mode", devRoot);

  // start or connect to the development cluster
  const cluster = clusterFactory({ cwd: devRoot });

  // deploy a fs bundle so that changes are automatically applied
  cluster.ready().subscribe(() => {
    console.log("installing our development bundle");
    // create our local development bundle
    const bundle = fsBundle(devRoot, { watch: true });

    // deploy our bundle to the cluster
    cluster.dispatch({ action: "install-bundle", bundle }).subscribe({
      next(installStatus) {
        console.log(installStatus);
      },
      error(err) {
        console.error(err);
      },
      complete() {
        console.log("development bundle was successfully deployed");
      },
    });
  });

  // subscribe to cluster events and output them to the console
  if (args.debug) {
    cluster.events.subscribe((event) => console.log(event));
  }

  process.on("beforeExit", async () => {
    await cluster.terminate();
    process.exit(0);
  });

  process.on("uncaughtException", async function (err) {
    console.error("uncaught!", err);
    await cluster.terminate();
    process.exit(1);
  });

  process.on("SIGINT", async function () {
    await cluster.terminate();
    process.exit(1);
  });
};
