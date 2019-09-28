const rp = require("request-promise");
const jsdom = require("jsdom");
const jquery = require("jquery");
const fs = require("fs");
const path = require("path")
const itemDetail = require("./item-detail");
const op = require("./operations");

const getAndSaveTemplate = async (title, name, filter) => {
  let template = await op.makeItemsTemplateFromWeb(title, name, filter);
  let text = JSON.stringify(template, null, 2);
  console.log(text);
  let filePath = path.join('_build', '_templates', `${name}.json`);
  fs.writeFileSync(filePath, text);

  return filePath;
}

const getAndSaveAllTemplates = async (titleFilter) => {
  let templatePaths = [];

  const seriesList = (await op.collectSeriesListFromWeb()).filter(l => {
    if (titleFilter) {
      return titleFilter.includes(l.title);
    } else {
      return true;
    }
  });

  for(let series of seriesList) {
    if (series.sub.length > 0) {
      for(let sub of series.sub) {
        console.log(`=> ${series.title}: ${sub.name}`);
        let p = await getAndSaveTemplate(series.title, sub.name, [sub.title]);
        templatePaths.push(p);
      }
    } else {
      console.log(`=> ${series.title}: ${series.name}`);
      let p = await getAndSaveTemplate(series.title, series.name, []);
      templatePaths.push(p);
    }
  };

  return templatePaths;
}

const getAndSaveItems = async (templatePath, revision) => {
  const b = path.basename(templatePath);
  const filePath = path.join('_build', '_items', b);

  const template = JSON.parse(fs.readFileSync(templatePath));
  let items = (() => {
    try {
      return JSON.parse(fs.readFileSync(filePath));
    } catch {
      return {};
    }
  })();

  for(const itemSpec of template) {
    for(const i of itemSpec.itemNOs.keys()) {
      const itemNO = itemSpec.itemNOs[i];

      let item = items[itemNO];
      if (item === undefined) {
        console.log(`Downloading[${itemSpec.title}]... (${i + 1}/${itemSpec.itemNOs.length})`);

        let detail = await itemDetail.getDetailFromWeb(itemNO);
        item = Object.assign({
          series: itemSpec.title,
          filter: itemSpec.filter,
          range: itemSpec.range,
          _revision: revision,
        }, detail);
        items[itemNO] = item;

        await sleep(500);
      } else {
        console.log(`Passed[${itemSpec.title}]! (${i + 1}/${itemSpec.itemNOs.length})`);

        item._revision = revision;
      }
    }
  };

  let text = JSON.stringify(items, null, 2);
  fs.writeFileSync(filePath, text);
};

const getAndSaveAllItems = async (revision) => {
  const baseDir = path.join('_build', '_templates');
  const jsonPaths = fs.readdirSync(baseDir).filter(p => p.match(/\.json$/) != null);
  for(const p of jsonPaths) {
    const jsonPath = path.join(baseDir, p);
    await getAndSaveItems(jsonPath, revision);
  }
};

const mergeAndSaveAllItems = () => {
  const baseDir = path.join('_build', '_items');
  const jsonPaths = fs.readdirSync(baseDir).filter(p => p.match(/\.json$/) != null);
  const jsons = jsonPaths.map(p => {
    const jsonPath = path.join(baseDir, p);
    console.log(`Loading: ${jsonPath}`);

    const json = fs.readFileSync(jsonPath);
    return JSON.parse(json);
  });
  let items = new Map();

  let latestRevision = 0;
  jsons.forEach(json => {
    for(const itemNO of Object.keys(json)) {
      const item = json[itemNO];
      items.set(itemNO, Object.assign({
        no: itemNO,
      }, item));
      if (item._revision > latestRevision) {
        latestRevision = item._revision;
      }
    }
  });

  let itemsList =
      Array
      .from(items)
      .map(assoc => assoc[1])
      .filter(item => item._revision >= latestRevision);
  itemsList.forEach(item => {
    delete item._revision;
  });

  const filePath = path.join('_build', 'items.json');
  const text = JSON.stringify({
    items: itemsList,
  }, null, 2);
  fs.writeFileSync(filePath, text);
};

(async () => {
  /*const seriesList = await collectSeriesListFromWeb(["ブランド限定"]);
  console.log(seriesList);
  const f = fs.readFileSync("b.html", "utf8");
  const g = fs.readFileSync("b.js", "utf8");
  console.log(makeItemsTemplate("第5弾", f, g));
  */
  await getAndSaveAllTemplates();

  const revision = Math.round((new Date()).getTime() / 1000);
  await getAndSaveAllItems(revision);

  mergeAndSaveAllItems();
})();
