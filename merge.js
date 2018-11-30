const glob = require("glob-fs")({ gitignore: false });
const fs = require("fs");

const jsonFiles = glob.readdirSync("./_items/*.json");
const jsons = jsonFiles.map(jsonFile =>
  JSON.parse(fs.readFileSync(jsonFile, "utf8"))
);
const items = jsons.flat();

console.log(JSON.stringify({ items: items }, null, "  "));
