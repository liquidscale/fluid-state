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
      const fnCall = cluster.execute({ action: "exec", fn: req.params.fn, data: req.body });

      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");

      const subscription = fnCall.subscribe({
        next(chunk) {
          console.log("received a value", chunk);
          res.write(JSON.stringify(chunk));
        },
        error(err) {
          console.log("received an error", err.message);
          res.status(err.code || 500).end(err.message);
        },
        complete() {
          console.log("complete");
          res.end();
        }
      });

      req.on("close", function () {
        //subscription.unsubscribe();
      });
    });

    app.post("/queries/:scope/:id?", bodyParser.json(), function (req, res) {
      console.log("executing query", req.params, req.body);
      const queryExec = cluster.execute({ action: "query", scope: req.params.scope, id: req.params.id, query: req.body });
      const subscription = queryExec.subscribe({
        next(result) {
          res.json(result);
          subscription.unsubscribe();
        },
        error(err) {
          console.error("received an error", err);
          res.status(err.code || 500).end(err.message);
        },
        complete() {
          console.log("query complete");
          res.end();
        }
      });

      req.on("close", function () {
        //subscription.unsubscribe();
      });
    });

    app.get("/channels/:id", function (req, res) {
      const dataChannel = cluster.execute({ action: "open-channel", id });
      const subscription = dataChannel.subscribe({
        next(chunk) {
          res.write(JSON.stringify(chunk));
        },
        error(err) {
          console.log("received an error", err);
          next(err);
        },
        complete() {
          res.end();
        }
      });

      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Connection", "keep-alive");

      req.on("close", function () {
        // subscription.unsubscribe();
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
