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
const Path = require("path");
const mime = require("mime");
const {camelCase} = require("change-case");

const SUPPORTED_FILE_EXTENSIONS = /[^.]+(.*)$/i;

module.exports = function(){

    return function(key) {
        const normalizedKey = {
            type: null,
            key: null,
            stereotype: null,
            categories: []
        };
        if (key.indexOf(SUPPORTED_FILE_EXTENSIONS) !== 0) {
            const extension = Path.extname(key);
            const shortName = Path.basename(key, extension);
            const categories = Path.dirname(key).split("/");
            normalizedKey.type = mime.getType(extension);
            normalizedKey.key = camelCase(shortName);
            if (categories.indexOf("client") !== -1 || categories.indexOf("react") !== -1 || categories.indexOf("frontend") !== -1 || shortName.indexOf(".ui.") !== -1) {
                normalizedKey.stereotype = "ui";
            } else if (categories.indexOf("functions") !== -1 || categories.indexOf("function") !== -1 || shortName.indexOf(".fn.") !== -1) {
                normalizedKey.stereotype = "fn";
            } else if (categories.indexOf("scopes") !== -1 || categories.indexOf("scope") !== -1 || shortName.indexOf(".scope.") !== -1) {
                normalizedKey.stereotype = "scope";
            } else if (categories.indexOf("config") !== -1 || shortName.indexOf(".config.") !== -1) {
                normalizedKey.stereotype = "config";
            } else if (categories.indexOf("doc") !== -1 || categories.indexOf("docs") !== -1 || extension === ".md") {
                normalizedKey.stereotype = "doc";
            } else if ([".json", ".yaml", ".yml", ".xml"].indexOf(extension) !== -1) {
                normalizedKey.stereotype = "data";
            } else if (categories.indexOf("test") !== -1 || categories.indexOf("tests") !== -1 || shortName.indexOf(".test.") !== -1) {
                normalizedKey.stereotype = "test";
            }
            normalizedKey.categories = categories;
            return normalizedKey;
        } else {
            return { key, type: null, categories: [], stereotype: null };
        }
    }

}