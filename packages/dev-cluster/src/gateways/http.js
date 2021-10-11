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
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

module.exports = function (cluster, config) {
  console.log("configuring http gateway", config);

  let app, server;

  function createHttpServer(cfg) {
    if (server) {
      server.close();
    }

    app = express();

    app.use(cors());

    // trigger an exposed function execution
    app.post("/fns/:fn", bodyParser.json(), function (req, res) {
      const fnCall = cluster.execute({ action: "exec", fn: req.params.fn, data: req.body, meta: { connId: null } });

      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");

      const subscription = fnCall.subscribe({
        next(chunk) {
          console.log("received chunk", chunk);
          res.write(JSON.stringify(chunk));
        },
        error(err) {
          console.log("received an error", err.message);
          res.status(err.code || 500).end(err.message);
        },
        complete() {
          res.end();
        }
      });
    });

    app.post("/queries/:scope/:id?", bodyParser.json(), function (req, res) {
      console.log("executing query", req.params, req.body);
      cluster.execute({ action: "query", scope: { key: req.params.scope, id: req.params.id }, query: req.body }).subscribe({
        next(queryResult) {
          const subscription = queryResult.result.subscribe({
            next(result) {
              console.log("syncing result to the client", `channel:${queryResult.id}`, result);
              res.json(result);
              process.nextTick(function () {
                subscription.unsubscribe();
              });
            },
            error(err) {
              console.error("received an error", err);
              res.status(err.code || 500).end(err.message);
            },
            complete() {
              res.end();
            }
          });
        },
        error(err) {
          // happens when query cannot be performed for any reason
          console.error("unable to initiate query", err);
          res.status(err.code || 400).end(err.message);
        }
      });
    });

    app.get("/views/:name?", function (req, res) {
      console.log("rendering data view", req.params, req.body);
      cluster.execute({ action: "view", name: req.params.name, params: req.query }).subscribe({
        next(viewResult) {
          const subscription = viewResult.result.subscribe({
            next(result) {
              console.log("syncing result to the client", `channel:${viewResult.id}`, result);
              res.json(result);
              process.nextTick(function () {
                subscription.unsubscribe();
              });
            },
            error(err) {
              console.error("received an error", err);
              res.status(err.code || 500).end(err.message);
            },
            complete() {
              res.end();
            }
          });
        },
        error(err) {
          // happens when query cannot be performed for any reason
          console.error("unable to initiate view", err);
          res.status(err.code || 400).end(err.message);
        }
      });
    });

    server = app.listen(cfg.port);
  }

  createHttpServer(config);

  return {
    reload(updatedConfig) {
      console.log("applying new config to http gateway", updatedConfig);
      createHttpServer(updatedConfig);
    }
  };
};
