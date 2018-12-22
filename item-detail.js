const rp = require("request-promise");
const jsdom = require("jsdom");
const jquery = require("jquery");
const fs = require("fs");
const path = require("path");

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
    case "緑":
      return "green";
    case "黄色":
      return "yellow";
    case "水色":
      return "light_blue";
    case "ピンク":
      return "pink";
    case "オレンジ":
      return "orange";
    case "シルバー":
      return "silver";
    case "ゴールド":
      return "gold";
    default:
      return s;
  }
};

const brandFromURIPath = s => {
  switch (path.basename(s)) {
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
    case "logo-preciousmuse.png":
      return "PreciousMuse";
    case "logo-prismstone.png":
      return "PrismStone";
    case "logo-twinkleribbon.png":
      return "TwinkleRibbon";
    case "logo-lovedevi.png":
      return "LOVEDEVI";
    case "logo-babymonster.png":
      return "BabyMonster";
    case "logo-brilliantprince.png":
      return "BrilliantPrince";
    case "logo-holictrick.png":
      return "HolicTrick";
    case "logo-q.png":
      return "?";
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
    case "icon-q.png":
      return "?";
    case "%genre%":
      return "";
    default:
      return s;
  }
};

const normalizeRarity = s => {
  switch (s) {
    case "KR":
    case "ＫＲ":
      return "KR";
    case "PR":
    case "ＰＲ":
      return "PR";
    case "SR":
    case "ＳＲ":
      return "SR";
    case "R":
    case "Ｒ":
      return "R";
    case "N":
    case "Ｎ":
      return "N";
    default:
      return s;
  }
};

const getDetailFromWeb = async (itemNO) => {
  const htmlString = await rp({
    uri: `https://prichan.jp/items/details/${itemNO}.html`
  });

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
    name: nameHTML
      .replace("<br>", " ")
      .replace("&amp; ", "&")
      .replace("&amp;", "&"),
    imageURI: `https://prichan.jp${imageURIPath}`,
    category: categoryFromJP(categoryJP),
    color: colorFromJP(colorJP),
    brand: brandFromURIPath(brandURIPath),
    type: typeFromURIPath(typeURIPath),
    rarity: normalizeRarity(rarity),
    like: parseInt(likeString)
  };
};

module.exports.getDetailFromWeb = getDetailFromWeb;
