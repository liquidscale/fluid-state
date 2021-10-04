module.exports = function (engine) {
  engine.action("exec", function ({ fn, data, meta, $result }) {
    console.log("resolving function", fn);
    async function resolve($result) {
      try {
        const func = await engine.resolveFunction(fn, data, { meta });
        if (func) {
          console.log("executing function", fn);
          try {
            const result = await func();
            if (result) {
              console.log("producing fn %s result", fn, result);
              $result.next(result);
            }
            $result.complete();
          } catch (err) {
            console.error("exec", err);
            $result.error(err);
          }
        } else {
          $result.error({ code: 404, message: "Function not found" });
        }
      } catch (err) {
        console.log("execution", err);
        $result.error({ code: 500, message: err.message });
      }
    }
    resolve($result);
  });
};
