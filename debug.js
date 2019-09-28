const op = require("./operations");

(async () => {
  let seriesList = await op.collectSeriesListFromWeb();
  console.log(JSON.stringify(seriesList, null, 2));
})();
