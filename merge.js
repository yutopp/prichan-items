const glob = require("glob-fs")({ gitignore: false });
const fs = require("fs");

const jsonFiles = glob.readdirSync("./_items/*.json");
const jsons = jsonFiles.map(jsonFile => {
  console.error(`Loading: ${jsonFile}`);
  const json = fs.readFileSync(jsonFile, "utf8");
  return JSON.parse(json);
});
const items = jsons.flat();

console.log(JSON.stringify({ items: items }, null, "  "));
