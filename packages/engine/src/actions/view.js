module.exports = function (engine) {
  engine.action("view", function ({ name, params, $result }) {
    console.log("rendering data view", name);
    async function renderView($result) {
      try {
        const view = await engine.resolveView(name, params);
        if (view) {
          console.log("view render function found", view);
          try {
            const viewResult = await view(params);
            $result.next(viewResult);
            $result.complete();
          } catch (err) {
            console.error("view", err);
            $result.error(err);
          }
        } else {
          $result.error({ code: 404, message: "not-found" });
        }
      } catch (err) {
        console.error("render view", err);
        $result.error({ code: 500, message: err.message });
      }
    }
    renderView($result);
  });
};
