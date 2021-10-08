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
 */ module.exports = function (engine) {
  engine.action("query", function ({ query, scope, locale, height, user, meta, $result }) {
    console.log("executing query", query, scope);
    async function performQuery($result) {
      try {
        const { unit: scopeRef, key } = await engine.resolveScope(scope.key);
        if (scopeRef) {
          const targetScope = await scopeRef({ key, height, locale, user, meta, data: { id: scope.id } });
          if (targetScope) {
            const queryResult = targetScope.query(query);
            $result.next(queryResult);
            $result.complete();
          } else {
            $result.error({ code: 403, message: "invalid scope" });
          }
        } else {
          $result.error({ code: 404, message: "scope not found" });
        }
      } catch (err) {
        console.error("execute query", err);
        $result.error({ code: 500, message: err.message });
      }
    }
    performQuery($result);
  });
};
