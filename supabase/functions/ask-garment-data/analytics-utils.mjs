export function detectProductRankingIntent(normalizedQ) {
  const asksProduct = /\b(product|products|product group|style|styles|fabric|category|categories)\b/.test(normalizedQ);
  const asksRanking = /\b(rank|ranking|ranked|top|highest|lowest|sort|list|most profitable|generated|generates|makes)\b/.test(normalizedQ);
  const asksMetric = /\b(profit|revenue|sales|margin)\b/.test(normalizedQ);
  if (!asksProduct || !asksRanking || !asksMetric) return null;

  const profitRankPattern = /\b(?:by\s+(?:total\s+)?(?:recorded\s+)?(?:profit|net profit|np)|most profitable|highest (?:recorded )?profit|maximum profit|top profit|profit highest|generated the highest recorded profit|generated highest profit)\b/;
  const revenueRankPattern = /\b(?:by\s+(?:total\s+)?(?:revenue|sales)|highest (?:total )?(?:revenue|sales)|top (?:revenue|sales))\b/;
  const profitRankMatch = profitRankPattern.exec(normalizedQ);
  const revenueRankMatch = revenueRankPattern.exec(normalizedQ);
  const explicitProfitRank = !!profitRankMatch;
  const explicitRevenueRank = !!revenueRankMatch;

  // The primary ranking metric is the one the user asks to rank first.
  // Later validation text may mention another metric and must not override it.
  const rankByProfit = explicitProfitRank && (!explicitRevenueRank || profitRankMatch.index <= revenueRankMatch.index);

  // Category/group questions aggregate all styles before ranking.
  const asksGroupTotal = /\b(product group|product groups|by group|group level|across (?:all )?styles|category|categories)\b/.test(normalizedQ)
    || /\bwhich product group\b/.test(normalizedQ);

  return {
    metric: rankByProfit ? "profit_inr" : "revenue_inr",
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
  const comparisonIntent = /\b(compare|comparison|versus|vs|difference|between|and)\b/.test(normalizedQ)
    || /ஒப்பிட|ஒப்பீடு|வித்தியாசம்|மற்றும்/.test(normalizedQ);
  const metricIntent = /\b(revenue|sales|profit|margin|orders)\b/.test(normalizedQ)
    || /வருவாய்|விற்பனை|லாபம்|ஆர்டர்|ஆர்டர்கள்|மார்ஜின்/.test(normalizedQ);
  return requestedCountryCount >= 2 && comparisonIntent && metricIntent;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Normalize and rank buyer aggregates from vw_sales_by_buyer.
 * Margin is always recomputed from aggregate profit / aggregate revenue.
 */
export function rankBuyerRows(rows, metric = "revenue_inr", limit = Infinity) {
  if (metric !== "revenue_inr" && metric !== "profit_inr") {
    throw new TypeError("metric must be revenue_inr or profit_inr");
  }
  const normalized = (Array.isArray(rows) ? rows : []).map((row) => {
    const revenue = finiteNumber(row?.revenue_inr);
    const profit = finiteNumber(row?.profit_inr);
    const orders = finiteNumber(row?.order_count ?? row?.orders);
    return {
      buyer_id: String(row?.buyer_id ?? ""),
      buyer_name: String(row?.buyer_name ?? "Unknown").trim() || "Unknown",
      country: String(row?.country ?? "Unknown").trim() || "Unknown",
      revenue_inr: revenue,
      profit_inr: profit,
      order_count: orders,
      profit_margin_pct: revenue !== 0 ? profit / revenue * 100 : 0,
    };
  });
  normalized.sort((a, b) => b[metric] - a[metric] || a.buyer_name.localeCompare(b.buyer_name));
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : normalized.length;
  return normalized.slice(0, safeLimit).map((row, index) => ({ rank: index + 1, ...row }));
}
