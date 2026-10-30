import test from "node:test";
import assert from "node:assert/strict";
import { rankBuyerRows } from "./analytics-utils.mjs";

// Snapshot reconciled against public.fact_orders and public.vw_sales_by_buyer on 2026-10-20.
// Each record: buyer name, order count, exact revenue INR, exact recorded profit INR.
const sourceSnapshot = [
  ["Metro Tees",831,566086731,81923887],
  ["Harbor & Co",559,370046224,48595433],
  ["Redwood Retail",456,330021317,43642860],
  ["Nimbus Basics",446,326801571,47464305],
  ["Nordic Basics",417,292413126,40223467],
  ["GreenLeaf Organics",415,289188802,36896239],
  ["Vista Retail",395,274017498,36941446],
  ["Orchid Kids",392,266499724,36031912],
  ["BlueHarbor Kids",326,241139096,35975077],
  ["Sunrise Innerwear",314,226264862,35343612],
  ["Northwind Apparel",302,200107137,28084499],
  ["Crown Tees",294,197055760,26210150],
  ["Summit Activewear",287,196835285,28710405],
  ["Coastline Apparel",275,194968343,24526992],
  ["Thames Casuals",256,193653876,26552367],
  ["EuroWear GmbH",255,193336326,27334475],
  ["Milano Basics",270,191127511,25370310],
  ["UrbanThread Co",273,188083690,26945707],
  ["PureCotton Brands",264,182334558,26311623],
  ["Polar Wear",261,181123451,23778637],
  ["Bright Cubs",226,162453533,23013454],
  ["Zenith Garments",209,152532096,23042098],
  ["Ember Fashion",190,133969720,19890474],
  ["Lotus Innerwear",175,132763778,18873695],
  ["Aurora Garments",177,128313179,19748156],
  ["Tulip Textiles",157,118391032,16069805],
  ["Sahara Fashion Hub",141,116348422,17662245],
  ["Fjord Fashion",166,109882556,16948119],
  ["Oakley Street Fashion",165,108534811,15172004],
  ["Seine Mode",168,106972893,13545405],
  ["Atlas Retail Group",149,89309802,12615696],
  ["Maple Kidswear",126,86069680,10568659],
  ["Kangaroo Kids",111,80764690,9817765],
  ["Lumen Sportswear",115,72367610,9843232],
  ["Iberia Moda",98,64048913,8513479],
  ["Rhine Wear",89,61947594,9756608],
  ["Alpine Basics",85,61410691,8604662],
  ["Pioneer Apparel",72,50345402,7844646],
  ["Starlight Kids",47,32781581,4403457],
  ["Cedar Lane",46,28198460,4175435],
];

test("all 40 live-source buyer rows match revenue rank, profit, orders, and weighted margin", () => {
  const input = sourceSnapshot.slice().reverse().map(([buyer_name, order_count, revenue_inr, profit_inr]) => ({
    buyer_name, order_count, revenue_inr, profit_inr, profit_margin_pct: -999,
  }));
  const ranked = rankBuyerRows(input, "revenue_inr");
  assert.equal(ranked.length, 40);
  assert.deepEqual(ranked.map((row) => row.buyer_name), sourceSnapshot.map(([name]) => name));
  let revenueTotal = 0, profitTotal = 0, orderTotal = 0;
  for (let i = 0; i < sourceSnapshot.length; i++) {
    const [name, orders, revenue, profit] = sourceSnapshot[i];
    const actual = ranked[i];
    assert.equal(actual.rank, i + 1, `rank for ${name}`);
    assert.equal(actual.buyer_name, name);
    assert.equal(actual.order_count, orders, `orders for ${name}`);
    assert.equal(actual.revenue_inr, revenue, `revenue for ${name}`);
    assert.equal(actual.profit_inr, profit, `profit for ${name}`);
    assert.ok(Math.abs(actual.profit_margin_pct - profit / revenue * 100) < 1e-10, `margin for ${name}`);
    if (i) assert.ok(ranked[i - 1].revenue_inr >= actual.revenue_inr, "revenue must be descending");
    revenueTotal += actual.revenue_inr;
    profitTotal += actual.profit_inr;
    orderTotal += actual.order_count;
  }
  assert.equal(revenueTotal, 6998511331);
  assert.equal(profitTotal, 976972497);
  assert.equal(orderTotal, 10000);
});

test("buyer ranking can sort by recorded profit instead of revenue", () => {
  const ranked = rankBuyerRows(sourceSnapshot.map(([buyer_name, order_count, revenue_inr, profit_inr]) => ({ buyer_name, order_count, revenue_inr, profit_inr })), "profit_inr");
  assert.equal(ranked.length, 40);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].profit_inr >= ranked[i].profit_inr);
});

test("unsupported buyer ranking metrics fail explicitly", () => {
  assert.throws(() => rankBuyerRows([], "order_count"), /metric must be/);
});
