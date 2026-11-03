/**
 * Query intent helpers shared by Ask AI routing and regression tests.
 *
 * These helpers deliberately use conservative intent detection. An explicit
 * primary metric (for example "rank by profit") must win over metrics mentioned
 * later in the question as validation context. Unsupported/ambiguous questions
 * should fall through to the SQL agent instead of being forced into a KPI route.
 */

const ENGLISH_RANKING_WORDS = /\b(rank|ranking|ranked|top|highest|lowest|sort|list|most profitable|generated|generates|makes)\b/;
const PRODUCT_WORDS = /\b(product|products|product group|product groups|style|styles|fabric|category|categories)\b/;

function normalizeQuery(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0B80-\u0BFF ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Split a user prompt without losing a sentence that contains abbreviations or
 * a decimal. Question marks, newlines, and explicit numbered sub-questions are
 * strong separators; sentence periods split only before a new capitalized
 * sentence. The caller should still let the full prompt go to the LLM when
 * splitting produces only one useful part.
 */
export function splitQuestions(input) {
  const source = String(input ?? "").replace(/\r\n?/g, "\n").trim();
  if (!source) return [];

  const parts = source
    .split(/\n+|\?+\s*|(?<=[.!])\s+(?=(?:[A-Z]|Which\b|What\b|Why\b|How\b|Show\b|Compare\b|Calculate\b|Rank\b|Identify\b|Explain\b|தமிழில்\b))/)
    .map((part) => part.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim())
    .filter((part) => part.length > 5);

  return parts.map((part) => part.replace(/[.!?]+$/g, "").trim() + "?");
}

export function isMultiQuestionPrompt(input) {
  const source = String(input ?? "").trim();
  if (!source) return false;
  return (source.match(/\?/g) ?? []).length > 1
    || source.split(/[\n\r]+/).filter((part) => part.trim().length > 5).length > 1
    || splitQuestions(source).length > 2;
}

export function detectProductRankingIntent(input) {
  const normalizedQ = normalizeQuery(input);
  const asksProduct = PRODUCT_WORDS.test(normalizedQ);
  const asksRanking = ENGLISH_RANKING_WORDS.test(normalizedQ);
  const asksMetric = /\b(profit|revenue|sales|margin)\b/.test(normalizedQ);
  if (!asksProduct || !asksRanking || !asksMetric) return null;

  // Match explicit metric-selection phrases, not any metric anywhere in the
  // prompt. This prevents validation clauses from overriding the user's intent.
  const profitRankPattern = /\b(?:by\s+(?:total\s+)?(?:recorded\s+)?(?:profit|net profit|np)|most profitable|highest (?:recorded )?profit|maximum profit|top profit|profit highest|generated the highest recorded profit|generated highest profit)\b/;
  const revenueRankPattern = /\b(?:by\s+(?:total\s+)?(?:revenue|sales)|highest (?:total )?(?:revenue|sales)|top (?:revenue|sales))\b/;
  const profitRankMatch = profitRankPattern.exec(normalizedQ);
  const revenueRankMatch = revenueRankPattern.exec(normalizedQ);
  const explicitProfitRank = Boolean(profitRankMatch);
  const explicitRevenueRank = Boolean(revenueRankMatch);
  const rankByProfit = explicitProfitRank
    && (!explicitRevenueRank || profitRankMatch.index <= revenueRankMatch.index);

  const asksGroupTotal = /\b(product group|product groups|by group|group level|across (?:all )?styles|category|categories)\b/.test(normalizedQ)
    || /\bwhich product group\b/.test(normalizedQ);

  return { metric: rankByProfit ? "profit_inr" : "revenue_inr", asksGroupTotal };
}

export function aggregateProductGroups(rows, metric) {
  if (metric !== "profit_inr" && metric !== "revenue_inr") {
    throw new TypeError("metric must be profit_inr or revenue_inr");
  }
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
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

export function isCountryComparisonQuestion(input, requestedCountryCount) {
  const normalizedQ = normalizeQuery(input);
  const comparisonIntent = /\b(compare|comparison|versus|vs|difference|between|and)\b/.test(normalizedQ)
    || /ஒப்பிட|ஒப்பீடு|வித்தியாசம்|மற்றும்/.test(normalizedQ);
  const metricIntent = /\b(revenue|sales|profit|margin|orders)\b/.test(normalizedQ)
    || /வருவாய்|விற்பனை|லாபம்|ஆர்டர்|ஆர்டர்கள்|மார்ஜின்/.test(normalizedQ);
  return requestedCountryCount >= 2 && comparisonIntent && metricIntent;
}

export function rankBuyerRows(rows, metric = "revenue_inr", limit = Infinity) {
  if (metric !== "revenue_inr" && metric !== "profit_inr") {
    throw new TypeError("metric must be revenue_inr or profit_inr");
  }
  const normalized = (Array.isArray(rows) ? rows : []).map((row) => {
    const revenue = finiteNumber(row?.revenue_inr);
    const profit = finiteNumber(row?.profit_inr);
    return {
      buyer_id: String(row?.buyer_id ?? ""),
      buyer_name: String(row?.buyer_name ?? "Unknown").trim() || "Unknown",
      country: String(row?.country ?? "Unknown").trim() || "Unknown",
      revenue_inr: revenue,
      profit_inr: profit,
      order_count: finiteNumber(row?.order_count ?? row?.orders),
      profit_margin_pct: revenue !== 0 ? profit / revenue * 100 : 0,
    };
  });
  normalized.sort((a, b) => b[metric] - a[metric] || a.buyer_name.localeCompare(b.buyer_name));
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : normalized.length;
  return normalized.slice(0, safeLimit).map((row, index) => ({ rank: index + 1, ...row }));
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) previous[j] = current[j];
  }
  return previous[b.length];
}

function tokenSimilarity(a, b) {
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return 0;
  return 1 - levenshteinDistance(a, b) / Math.max(a.length, b.length);
}

/**
 * Match a user-entered fabric/style name against the complete list of known
 * fabric values. Numeric specification tokens (e.g. 150 GSM) must match exactly.
 * Ambiguous near-ties are rejected instead of silently selecting the wrong item.
 */
export function matchFabricFromQuestion(question, fabricNames) {
  const queryTokens = normalizeQuery(question).split(" ").filter(Boolean);
  const candidates = [...new Set((Array.isArray(fabricNames) ? fabricNames : [])
    .map((value) => String(value ?? "").trim()).filter(Boolean))];
  const ranked = candidates.map((fabric) => {
    const tokens = normalizeQuery(fabric).split(" ").filter(Boolean);
    const numericTokens = tokens.filter((token) => /^\d+$/.test(token));
    const numericMatch = numericTokens.every((token) => queryTokens.includes(token));
    const tokenScores = tokens.map((target) => Math.max(0, ...queryTokens.map((token) => tokenSimilarity(token, target))));
    const score = tokenScores.length ? tokenScores.reduce((total, value) => total + value, 0) / tokenScores.length : 0;
    return { fabric, score, numericMatch, tokenScores };
  }).filter((item) => item.numericMatch && item.score >= 0.78 && item.tokenScores.every((value) => value >= 0.60))
    .sort((a, b) => b.score - a.score || a.fabric.localeCompare(b.fabric));
  if (!ranked.length) return { fabric: null, ambiguous: false, score: 0 };
  if (ranked[1] && ranked[0].fabric !== ranked[1].fabric && ranked[0].score - ranked[1].score < 0.05) {
    return { fabric: null, ambiguous: true, score: ranked[0].score, candidates: ranked.slice(0, 5).map((item) => item.fabric) };
  }
  return { fabric: ranked[0].fabric, ambiguous: false, score: ranked[0].score };
}

/**
 * Resolve the period used by a product-specific query.
 * UI filter values are fiscal-year start years (e.g. "2023" => FY 2023-24).
 * Explicit periods in the question override the UI selection.
 */
export function resolveFiscalPeriod(question, selectedPeriod = "", now = new Date()) {
  const source = String(question ?? "");
  const normalized = normalizeQuery(source);
  const explicitFy = source.match(/\bfy\s*(20\d{2})\s*[-–/]\s*(\d{2}|20\d{2})\b/i);
  const explicitCalendarYear = !explicitFy ? normalized.match(/\b(20\d{2})\b/) : null;
  const selected = String(selectedPeriod ?? "").trim();
  const selectedFy = selected.match(/^FY\s*(20\d{2})\s*[-–/]\s*(\d{2}|20\d{2})$/i);
  const selectedStart = selectedFy ? Number(selectedFy[1]) : (/^20\d{2}$/.test(selected) ? Number(selected) : null);
  let startYear = null;
  let endYear = null;
  let kind = "all";
  if (explicitFy) {
    startYear = Number(explicitFy[1]);
    endYear = Number(explicitFy[2]) < 100 ? Math.floor(startYear / 100) * 100 + Number(explicitFy[2]) : Number(explicitFy[2]);
    kind = "fiscal";
  } else if (explicitCalendarYear) {
    startYear = Number(explicitCalendarYear[1]);
    endYear = startYear;
    kind = "calendar";
  } else if (selectedStart !== null) {
    startYear = selectedStart;
    endYear = selectedFy
      ? (Number(selectedFy[2]) < 100 ? Math.floor(startYear / 100) * 100 + Number(selectedFy[2]) : Number(selectedFy[2]))
      : startYear + 1;
    kind = "fiscal";
  } else if (/\b(this year|current year|year to date|ytd)\b/.test(normalized)) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    startYear = month >= 4 ? year : year - 1;
    endYear = startYear + 1;
    kind = "fiscal";
  }
  if (kind === "all") return { kind, startDate: null, endDateExclusive: null, label: "All available years" };
  if (kind === "calendar") return {
    kind, startDate: startYear + "-01-01", endDateExclusive: (endYear + 1) + "-01-01", label: String(startYear),
  };
  return {
    kind, startDate: startYear + "-04-01", endDateExclusive: endYear + "-04-01",
    label: "FY " + startYear + "–" + String(endYear).slice(-2),
  };
}

