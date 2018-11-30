const rp = require("request-promise");
const jsdom = require("jsdom");
const jquery = require("jquery");
const fs = require("fs");
const path = require("path");

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const categoryFromJP = s => {
  switch (s) {
    case "トップス":
      return "tops";
    case "ワンピース":
      return "one_piece";
    case "スカート":
      return "skirt";
    case "ボトムス":
      return "bottoms";
    case "シューズ":
      return "shoes";
    case "アクセサリー":
      return "accessory";
    case "ヘアアクセ":
      return "hair_accessory";
    case "パシャッとアイテム":
      return "pashatto_item";
    default:
      return s;
  }
};

const colorFromJP = s => {
  switch (s) {
    case "黄":
      return "yellow";
    case "黒":
      return "black";
    case "茶":
      return "brown";
    case "白":
      return "white";
    case "赤":
      return "red";
    case "紫":
      return "purple";
    case "青":
      return "blue";
    case "水色":
      return "light_blue";
    case "ピンク":
      return "pink";
    case "オレンジ":
      return "orange";
    default:
      return s;
  }
};

const brandFromURIPath = s => {
  switch (path.basename(s)) {
    case "logo-preciousmuse.png":
      return "PreciousMuse";
    case "logo-sweethoney.png":
      return "SweetHoney";
    case "logo-girlsyell.png":
      return "GirlsYell";
    case "logo-dollywaltz.png":
      return "DollyWaltz";
    case "logo-romancebeat.png":
      return "RomanceBeat";
    case "logo-secretalice.png":
      return "SecretAlice";
    case "logo-universequeen.png":
      return "UniverseQueen";
    case "%brand%":
      return "";
    default:
      return s;
  }
};

const typeFromURIPath = s => {
  switch (path.basename(s)) {
    case "icon-cool.png":
      return "cool";
    case "icon-premium.png":
      return "premium";
    case "icon-love.png":
      return "love";
    case "icon-pop.png":
      return "pop";
    default:
      return s;
  }
};

const doRequest = async itemID => {
  const options = {
    uri: `https://prichan.jp/items/details/${itemID}.html`
  };
  return await rp(options);
};

const getBasicInfo = async (itemNO, series, limited) => {
  const htmlString = await doRequest(itemNO);

  const dom = new jsdom.JSDOM(htmlString);
  const $ = jquery(dom.window);

  const id = $("div.the-item .-inner .-thumb .-id").text();
  const nameHTML = $("div.the-item .-title").html();

  const imageURIPath = $("div.the-item .-inner .-thumb img").attr("data-src");
  const categoryJP = $(
    "div.the-item .-inner .-right .-details .-detail:eq(0) .-value"
  ).text();
  const colorJP = $(
    "div.the-item .-inner .-right .-details .-detail:eq(1) .-value"
  ).text();
  const brandURIPath = $(
    "div.the-item .-inner .-right .-details .-detail:eq(2) .-value img"
  ).attr("data-src");
  const typeURIPath = $(
    "div.the-item .-inner .-right .-details .-detail:eq(3) .-value img"
  ).attr("data-src");
  const rarity = $(
    "div.the-item .-inner .-right .-details .-detail:eq(4) .-rarity"
  ).text();
  const likeString = $(
    "div.the-item .-inner .-right .-details .-detail:eq(4) .-like"
  ).text();

  return {
    id: id,
    no: itemNO,
    series: series,
    limited: limited,
    name: nameHTML
      .replace("<br>", " ")
      .replace("&amp; ", "&")
      .replace("&amp;", "&"),
    imageURI: `https://prichan.jp${imageURIPath}`,
    category: categoryFromJP(categoryJP),
    color: colorFromJP(colorJP),
    brand: brandFromURIPath(brandURIPath),
    type: typeFromURIPath(typeURIPath),
    rarity: rarity,
    like: parseInt(likeString)
  };
};

const crawlItemOrder = async itemOrder => {
  let items = [];
  for (let i = 0; i < itemOrder.itemNOs.length; i++) {
    const itemNO = itemOrder.itemNOs[i];
    const item = await getBasicInfo(
      itemNO,
      itemOrder.series,
      itemOrder.limited
    );
    items.push(item);

    await sleep(500);
  }

  return items;
};

(async () => {
  if (process.argv.length != 3) {
    console.error("Usage: node get.js <filename.json>");
    process.exit(1);
  }

  const filePath = process.argv[2];

  const itemOrder = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const items = await crawlItemOrder(itemOrder);

  console.log(JSON.stringify(items, null, "  "));
})();
