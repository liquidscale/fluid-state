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
const https = require("https");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const fs = require("fs-extra");
const Path = require("path");
const { camelCase } = require("change-case");

module.exports = function (cluster, config) {
  console.log("configuring websocket gateway", config);

  let app = null;
  let server = null;

  function createWebSocketServer(cfg) {
    console.log("creating a websocket gateway", cfg);
    if (server) {
      server.close();
    }

    app = express();

    const options = {
      key: fs.readFileSync(Path.resolve(__dirname, "../../etc/localhost+2-key.pem"), "utf8"),
      cert: fs.readFileSync(Path.resolve(__dirname, "../../etc/localhost+2.pem"), "utf8")
    };

    server = https.createServer(options, app);
    const io = new Server(server);

    app.use(cors());

    app.use("/health", function (req, res) {
      res.json({ ok: 1 });
    });
    io.on("connection", socket => {
      socket.on("disconnect", function () {
        console.log("socket has been disconnected", socket.id);
      });

      socket.on("call-fn", function (msg, reply) {
        console.log("call-fn", msg, reply);
        const fnCall = cluster.execute({ action: "exec", fn: camelCase(msg.fn), data: msg.payload, meta: { connId: socket.id } });
        fnCall.subscribe({
          next(result) {
            if (reply) {
              reply({ success: true, result });
            }
          },
          error(err) {
            console.error("call-fn-error", err);
            if (reply) {
              reply({ success: false, error: err });
            }
          },
          complete() {
            if (reply) {
              reply({ success: true });
            }
          }
        });
      });

      socket.on("view", function (msg, reply) {
        console.log("executing view", msg.name);
        // execute the view and return the channel id to sync results
        cluster.execute({ action: "view", name: camelCase(msg.name), params: msg.params }).subscribe({
          next(viewResult) {
            if (reply) {
              reply(viewResult.id);
            }

            socket.once(`channel:${viewResult.id}:close`, function () {
              console.log("closing view channel", viewResult.id);
              if (subscription) {
                subscription.unsubscribe();
              }
            });

            const subscription = viewResult.result.subscribe({
              next(result) {
                console.log("emiting new query result", `channel:${viewResult.id}`, result);
                socket.emit(`channel:${viewResult.id}`, { type: "sync", result });
              },
              error(err) {
                console.error("received an error", err);
                socket.emit(`channel:${viewResult.id}`, { type: "error", error: err });
              },
              complete() {
                console.log("query complete");
                socket.emit(`channel:${viewResult.id}`, { type: "close" });
              }
            });
          },
          error(err) {
            console.error("unable to initiate view", err);
            socket.emit(`error`, { type: "error", error: err });
          }
        });
      });

      socket.on("query", function (msg, reply) {
        // execute the query and return the channel id to sync results
        //FIXME: Send error to the right device + user if we're not able to produce a valid queryResult;
        cluster.execute({ action: "query", ...msg }).subscribe({
          next(queryResult) {
            if (reply) {
              reply(queryResult.id);
            }

            socket.once(`channel:${queryResult.id}:close`, function () {
              console.log("received request to close view", queryResult.id);
              if (subscription) {
                subscription.unsubscribe();
              } else {
                console.log("unable to close view has it is not available");
              }
            });

            const subscription = queryResult.result.subscribe({
              next(result) {
                console.log("syncing result to the client", `channel:${queryResult.id}`, result);
                socket.emit(`channel:${queryResult.id}`, { type: "sync", result });
              },
              error(err) {
                console.error("received an error", err);
                socket.emit(`channel:${queryResult.id}`, { type: "error", error: err });
              },
              complete() {
                console.log("query complete");
                socket.emit(`channel:${queryResult.id}`, { type: "close" });
              }
            });
          },
          error(err) {
            // happens when query cannot be performed for any reason
            console.error("unable to initiate query", err);
            socket.emit(`error`, { type: "error", error: err });
          }
        });
      });
    });

    server.listen(cfg.port, function (err) {
      if (err) {
        return console.error(err);
      }

      console.log("listening for websocket connections on ", cfg.port);
    });
  }

  createWebSocketServer(config);

  return {
    reload(updatedConfig) {
      console.log("applying new config to websocket gateway", updatedConfig);
      createWebSocketServer(updatedConfig);
    }
  };
};
