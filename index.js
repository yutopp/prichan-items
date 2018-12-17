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

(async () => {
  const f = fs.readFileSync("a.html", "utf8");
  console.log(collectSeriesList(f));
})()
