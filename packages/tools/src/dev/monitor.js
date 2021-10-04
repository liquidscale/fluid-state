const io = require("socket.io-client");

module.exports = function (args) {
  console.log("connecting to ws and query all events");
  const socket = io("https://localhost");

  socket.on("connect", function () {
    console.log("connected!");
  });

  socket.on("error", function (err) {
    console.error(err);
    process.exit(1);
  });
};
