const rp = require("request-promise");
const jsdom = require("jsdom");
const jquery = require("jquery");
const fs = require("fs");
const path = require("path")
const itemDetail = require("./item-detail");

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

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

module.exports = {
  collectSeriesList: collectSeriesList,
  collectSeriesListFromWeb: collectSeriesListFromWeb,
  collectItemGroups: collectItemGroups,
  collectGroupSpecs: collectGroupSpecs,
  toItemsTemplate: toItemsTemplate,
  makeItemsTemplate: makeItemsTemplate,
  makeItemsTemplateFromWeb: makeItemsTemplateFromWeb,
}
