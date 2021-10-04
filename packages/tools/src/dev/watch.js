const clusterFactory = require("@liquidscale/dev-cluster");
const fsBundle = require("../lib/fs-bundle");

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
      }
    });
  });

  // subscribe to cluster events and output them to the console
  if (args.debug) {
    cluster.events.subscribe(event => console.log(event));
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
