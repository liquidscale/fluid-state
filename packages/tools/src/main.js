#!/usr/bin/env node
global.Promise = require("bluebird");
const args = require("minimist")(process.argv.slice(2), {});
try {
  if (!args.silent) {
    console.log("LiquidScale.Cloud Tools. Licensed under MIT");
    console.log();
  }
  require(`./${args._.shift()}`)(args);
} catch (err) {
  console.error("invalid syntax", err);
}
