const rp = require("request-promise");

const doRequest = async seriesName => {
  const options = {
    uri: `https://prichan.jp/items/${seriesName}.html`
  };
  return await rp(options);
};

const getIdList = async seriesName => {
  const htmlString = await doRequest(seriesName);
  return htmlString
    .match(/details\/([0-9]+).html/g)
    .map(s => s.match(/[0-9]+/)[0]);
};

(async () => {
  if (process.argv.length != 3) {
    console.error("Usage: node collect_id_list <series>");
    process.exit(1);
  }

  const seriesName = process.argv[2];

  const idList = await getIdList(seriesName);

  console.log(JSON.stringify(idList, null, "  "));
})();
