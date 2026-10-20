export function detectProductRankingIntent(normalizedQ) {
  const asksProduct = /\b(product|products|product group|style|styles|fabric|category|categories)\b/.test(normalizedQ);
  const asksRanking = /\b(rank|ranking|ranked|top|highest|lowest|sort|list|most profitable|generated|generates|makes)\b/.test(normalizedQ);
  const asksMetric = /\b(profit|revenue|sales|margin)\b/.test(normalizedQ);
  if (!asksProduct || !asksRanking || !asksMetric) return null;

  const explicitProfitRank = /\b(by\s+(?:total\s+)?(?:recorded\s+)?(?:profit|net profit|np)|most profitable|highest (?:recorded )?profit|maximum profit|top profit|profit highest|generated the highest recorded profit|generated highest profit)\b/.test(normalizedQ);
  const explicitRevenueRank = /\b(by\s+(?:total\s+)?(?:revenue|sales)|highest (?:total )?(?:revenue|sales)|top (?:revenue|sales))\b/.test(normalizedQ);
  const asksGroupTotal = /\b(product group|product groups|by group|group level|across (?:all )?styles)\b/.test(normalizedQ)
    || /\bwhich product group\b/.test(normalizedQ);

  return {
    metric: explicitProfitRank && !explicitRevenueRank ? "profit_inr" : "revenue_inr",
    asksGroupTotal,
  };
}

export function aggregateProductGroups(rows, metric) {
  if (metric !== "profit_inr" && metric !== "revenue_inr") {
    throw new TypeError("metric must be profit_inr or revenue_inr");
  }
  const groups = new Map();
  for (const row of rows) {
    const productCategory = String(row?.product_category ?? "").trim() || "Unknown";
    const group = groups.get(productCategory) ?? {
      product_category: productCategory,
      revenue_inr: 0,
      profit_inr: 0,
      styles: new Set(),
    };
    group.revenue_inr += finiteNumber(row?.revenue_inr);
    group.profit_inr += finiteNumber(row?.profit_inr);
    const style = String(row?.style_id ?? "").trim();
    if (style && style !== "Unknown") group.styles.add(style);
    groups.set(productCategory, group);
  }
  return [...groups.values()]
    .map((group) => ({
      product_category: group.product_category,
      revenue_inr: group.revenue_inr,
      profit_inr: group.profit_inr,
      profit_margin_pct: group.revenue_inr !== 0 ? group.profit_inr / group.revenue_inr * 100 : 0,
      style_count: group.styles.size,
    }))
    .sort((a, b) => metric === "profit_inr"
      ? b.profit_inr - a.profit_inr
      : b.revenue_inr - a.revenue_inr);
}

export function isCountryComparisonQuestion(normalizedQ, requestedCountryCount) {
  return requestedCountryCount >= 2
    && /\b(compare|comparison|versus|vs|difference|between|and)\b/.test(normalizedQ)
    && /\b(revenue|sales|profit|margin|orders)\b/.test(normalizedQ);
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
