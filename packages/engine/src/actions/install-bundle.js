module.exports = function (engine) {
  engine.action("install-bundle", async function ({ bundle, $result }) {
    $result.next("tracking bundle", bundle.id);
    bundle.observe({
      next(event) {
        if (event.key === "bundle:changed") {
          switch (event.op) {
            case "add": {
              const codeUnits = event.entries.map(entry => engine.createCodeUnit({ key: entry.path, content: entry.content }));
              codeUnits.map(unit => engine.installUnit(unit));
              break;
            }
            case "change": {
              const codeUnits = event.entries.map(entry => engine.createCodeUnit({ key: entry.path, content: entry.content }));
              codeUnits.map(unit => engine.updateUnit(unit));
              break;
            }
            case "remove": {
              const codeUnits = event.entries.map(entry => engine.createCodeUnit({ key: entry.path, content: entry.content }));
              codeUnits.map(unit => engine.removeUnit(unit));
              break;
            }
          }
        }
      },
      error(err) {
        console.error(err);
      },
      complete() {
        console.log("bundle is closed");
      },
    });
    $result.complete();
  });
};
