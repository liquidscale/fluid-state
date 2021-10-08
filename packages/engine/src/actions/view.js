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
module.exports = function (engine) {
  engine.action("view", function ({ name, params, height = 0, locale = "en", $result }) {
    async function renderView($result) {
      try {
        console.log("rendering data view", name);
        const view = await engine.resolveView(name);
        if (view) {
          console.log("view render function found", view);
          try {
            console.log("rendering view %s with params", name, params);
            const viewResult = await view(params, { height, locale });
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
