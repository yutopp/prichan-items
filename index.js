const rp = require("request-promise");
const jsdom = require("jsdom");
const jquery = require("jquery");
const fs = require("fs");
const path = require("path")

const doRequest = async () => {
  const options = {
    uri: 'https://prichan.jp/items/'
  };
  return await rp(options);
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

    let series = {
      title: title,
      addr: addr,
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
        });
      });
    }

    seriesList.push(series);
  });

  return seriesList;
};

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

const collectGroupSpecs = jsString => {
  return jsString.split(/\r|\n/).map(s => {
    return s.match(/'\#([0-9a-zA-Z-]+)'\)\.before\('(.*)'\)/);
  }).filter(r => {
    return r != null;
  }).map(r => {
    const groupID = r[1];
    const groupTitle = r[2];

    const dom = new jsdom.JSDOM(groupTitle);
    const $ = jquery(dom.window);

    let filter = [];
    let range = {
      begin: null,
      end: null,
    };

    const titleText = $("span").html();
    const titleTexts = titleText.split(/ |　/);
    titleTexts.forEach(text => {
      filter.push(text);

      let rangeR = text.match(/期間限定(([0-9]+)年([0-9]+)月([0-9]+)日)～(([0-9]+)年([0-9]+)月([0-9]+)日)?/);
      if (rangeR != null) {
        console.log(rangeR);
        if (rangeR[1] != undefined) {
          range.begin = `${rangeR[2]}/${rangeR[3]}/${rangeR[4]}`
        }
        if (rangeR[5] != undefined) {
          range.end = `${rangeR[6]}/${rangeR[7]}/${rangeR[8]}`
        }
        return;
      }

      //filter.push(text);
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
};

const makeItemsTemplate = (title, htmlString, jsString) => {
  const itemGroups = collectItemGroups(htmlString);
  //console.error(itemGroups);
  const groupSpecs = collectGroupSpecs(jsString);
  //console.error(groupSpecs);

  return toItemsTemplate(title, itemGroups, groupSpecs);
};

const makeItemsTemplateFromWeb = async (title, path) => {
  const htmlString = await rp({
    uri: `https://prichan.jp/items/${path}.html`
  });
  const jsString = await rp({
    uri: `https://prichan.jp/items/js/${path}.js`
  });
  return makeItemsTemplate(title, htmlString, jsString);
};

/*
  const ;
return await rp(options);
*/

(async () => {
  const f = fs.readFileSync("a.html", "utf8");
  const seriesList = collectSeriesList(f);
  seriesList.forEach(series => {
    console.log(series);
  });
})();

(async () => {
  const f = fs.readFileSync("b.html", "utf8");
  const g = fs.readFileSync("b.js", "utf8");
  console.log(makeItemsTemplate("第5弾", f, g));
})();

/*
(async () => {
  console.log(await makeItemsTemplateFromWeb("第5弾", "5th_12"));
})();
*/
