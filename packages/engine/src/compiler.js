const babel = require("@babel/core");
const babelPresetEnv = require("@babel/preset-env");

module.exports = {
  compileScript(script) {
    return babel.transform(script, {
      presets: [[babelPresetEnv, { modules: "auto", targets: { node: "current" } }]]
    }).code;
  },
  compileMarkdown(markdown) {
    return markdown;
  },
  compileUI(uiComp) {
    return uiComp;
  }
};
