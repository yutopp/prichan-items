const rp = require("request-promise");
const jsdom = require("jsdom");
const jquery = require("jquery");
const fs = require("fs");
const path = require("path")

const collectSeriesList = htmlString => {
  var seriesList = [];

  const dom = new jsdom.JSDOM(htmlString);
  const $ = jquery(dom.window);

  const itemsNav = $(".items-nav");
  itemsNav.children("ul").children("li").each((_, val) => {
    const elem = $(val);

    const content = elem.children("a");
    const a = content.children("span");
    a.find("rt").remove();
    const title = a.text();
    const addr = content.attr("href");

    if (title == "フォロチケ") {
      return;
    }

    let series = {
      title: title,
      addr: addr,
      name: addr.match(/(.+)\.html/)[1],
      sub: [],
    };

    const inner = elem.children("div");
    if (inner.length > 0) {
      inner.children("ul").children("li").each((_, val) => {
        const elem = $(val);

        const content = elem.children("a");
        const a = content.children("span");
        a.find("rt").remove();
        const title = a.text();
        const addr = content.attr("href");

        series.sub.push({
          title: title,
          addr: addr,
          name: addr.match(/(.+)\.html/)[1],
        });
      });
    }

    seriesList.push(series);
  });

  return seriesList;
};

const collectSeriesListFromWeb = async () => {
  const htmlString = await rp({
    uri: `https://prichan.jp/items/index.html`
  });
  return collectSeriesList(htmlString);
}

const collectItemGroups = htmlString => {
  var seriesList = [];

  const dom = new jsdom.JSDOM(htmlString);
  const $ = jquery(dom.window);

  coordinateLists = $("div.coordinate-lists");

  let groups = new Map();
  let lastId = "";

  coordinateLists.children(".coordinate-list").each((_, val) => {
    const elem = $(val);

    const id = elem.attr("id");
    if (id != "" && id != lastId) {
      lastId = id;
    }

    itemGroup = groups.get(lastId) || [];

    elem.find("li.-detail").children("a").each((_, val) => {
      const elem = $(val);
      itemGroup.push(elem.attr("href").match(/[0-9]+/)[0]);
    });

    groups.set(lastId, itemGroup);
  });

  return groups;
}

const collectGroupSpecs = (jsString, filterBase) => {
  return jsString.split(/\r|\n/).map(s => {
    return s.match(/'\#([0-9a-zA-Z-]+)'\)\.before\('(.*)'\)/);
  }).filter(r => {
    return r != null;
  }).map(r => {
    const groupID = r[1];
    const groupTitle = r[2];

    const dom = new jsdom.JSDOM(groupTitle);
    const $ = jquery(dom.window);

    const titleText = $("span").html();
    //filter.push(titleText); // TODO: remove

    let filter = (filterBase || []).slice();
    let range = null;

    const titleTexts = titleText.split(/ |　/);
    titleTexts.forEach(text => {
      let rangeR = text.match(/(([0-9]+)年([0-9]+)月([0-9]+)日)～((([0-9]+)年)?([0-9]+)月([0-9]+)日)?/);
      if (rangeR != null) {
        //console.error(rangeR);

        range = {
          begin: null,
          end: null,
        };

        if (rangeR[1] != undefined) {
          range.begin = `${rangeR[2]}/${rangeR[3]}/${rangeR[4]}`
        }
        if (rangeR[5] != undefined) {
          let year = rangeR[7] || rangeR[2];
          range.end = `${year}/${rangeR[8]}/${rangeR[9]}`
        }
        return;
      }

      if (text.match(/.*弾$/) != null) {
        return;
      }

      let monthR = text.match(/([0-9]+)月チャンネル・([0-9]+)月チャンネル$/)
      if (monthR != null) {
        filter.push(`${monthR[1]}月チャンネル`);
        filter.push(`${monthR[2]}月チャンネル`);
        return;
      }

      if (text.match(/チャンネル$/) != null) {
        let prev = filter[0] || "";
        if (prev.match(/^[a-z']+$/i) != null) {
          filter.shift();
          filter.push(`${prev} ${text}`);
          return;
        }
      }

      let specialR = text.match(/^(.+)(コラボ|キャンペーン)/)
      if (specialR != null) {
        filter.push(`${specialR[1]}${specialR[2]}`);
        return;
      }

      text = text.replace(/^第([0-9]+)弾/, "");
      text = text.replace(/限定$/, "");
      if (text != "") {
        filter.push(text);
      }
    });

    return {
      id: groupID,
      filter: filter,
      range: range,
    };
  });
};

const toItemsTemplate = (title, itemGroups, groupSpecs) => {
  let itemGroupsList = Array.from(itemGroups).map(assoc => {
    return {
      groupID: assoc[0],
      items: assoc[1],
      tag: null,
    }
  });
  groupSpecs.forEach(spec => {
    let matched = false;
    itemGroupsList.forEach(itemGroups => {
      if (!matched) {
        matched = itemGroups.groupID == spec.id;
      }
      if (matched) {
        itemGroups.tag = spec.id;
      }
    })
  });
  //console.log(itemGroupsList);

  if (groupSpecs.length > 0) {
    return groupSpecs.map(spec => {
      let items = itemGroupsList
          .filter(itemGroups => itemGroups.tag == spec.id)
          .map(itemGroups => itemGroups.items)
          .flat();

      return {
        title: title,
        filter: spec.filter,
        range: spec.range,
        itemNOs: items,
      };
    });
  } else {
    let items = itemGroupsList
        .map(itemGroups => itemGroups.items)
        .flat();
    return [
      {
        title: title,
        filter: [],
        range: null,
        itemNOs: items,
      }
    ];
  }
};

const makeItemsTemplate = (title, htmlString, jsString, filter) => {
  const itemGroups = collectItemGroups(htmlString);
  //console.log(itemGroups);
  const groupSpecs = collectGroupSpecs(jsString, filter);
  //console.log(groupSpecs);

  return toItemsTemplate(title, itemGroups, groupSpecs);
};

const makeItemsTemplateFromWeb = async (title, path, filter) => {
  const htmlString = await rp({
    uri: `https://prichan.jp/items/${path}.html`
  });
  const jsString = await rp({
    uri: `https://prichan.jp/items/js/${path}.js`
  });
  return makeItemsTemplate(title, htmlString, jsString, filter);
};

const getAndSaveTemplate = async (title, name, filter) => {
  let template = await makeItemsTemplateFromWeb(title, name, filter);
  let text = JSON.stringify(template, null, 2);
  console.log(text);
  let filePath = path.join('_build', '_templates', `${name}.json`);
  fs.writeFileSync(filePath, text);

  return filePath;
}

const getAndSaveAllTemplates = async (titleFilter) => {
  let templatePaths = [];

  const seriesList = (await collectSeriesListFromWeb()).filter(l => {
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

(async () => {
  /*const seriesList = await collectSeriesListFromWeb(["ブランド限定"]);
  console.log(seriesList);
  const f = fs.readFileSync("b.html", "utf8");
  const g = fs.readFileSync("b.js", "utf8");
  console.log(makeItemsTemplate("第5弾", f, g));
*/
  await getAndSaveAllTemplates();
})();
