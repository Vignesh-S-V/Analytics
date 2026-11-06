const SEASONAL_PERIOD = 12;
const MIN_TRAIN_POINTS = 12;
const MODEL_ORDER = ["Naive", "Seasonal Naive", "Damped Trend", "Trend + Seasonality", "Croston SBA"];

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function linearFit(values) {
  const n = values.length;
  if (!n) return { intercept: 0, slope: 0 };
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  return { intercept: yMean - slope * xMean, slope };
}

export function describeSeries(series = []) {
  const values = series.map(value => Math.max(0, finite(value)));
  const positive = values.filter(value => value > 0);
  const activeMonths = positive.length;
  const adi = activeMonths ? values.length / activeMonths : Infinity;
  const positiveMean = mean(positive);
  const variance = positive.length > 1
    ? positive.reduce((sum, value) => sum + (value - positiveMean) ** 2, 0) / (positive.length - 1)
    : 0;
  const cv2 = positiveMean ? variance / (positiveMean ** 2) : 0;
  const intermittent = adi >= 1.32;
  let demandType = "Smooth";
  if (!activeMonths) demandType = "No activity";
  else if (intermittent && cv2 >= 0.49) demandType = "Lumpy";
  else if (intermittent) demandType = "Intermittent";
  else if (cv2 >= 0.49) demandType = "Erratic";
  return { points: values.length, activeMonths, adi, cv2, intermittent, demandType };
}

function seasonalNaive(series, horizon) {
  const n = series.length;
  return Array.from({ length: horizon }, (_, index) => Math.max(0, finite(series[n - 12 + index % 12])));
}

function dampedTrend(series, horizon) {
  const values = series.slice(-Math.min(18, series.length)).map(value => Math.max(0, finite(value)));
  if (!values.length) return Array(horizon).fill(0);
  const fit = linearFit(values);
  const phi = 0.85;
  const level = values[values.length - 1];
  const slope = clamp(fit.slope, -Math.max(1, mean(values) * 0.10), Math.max(1, mean(values) * 0.10));
  return Array.from({ length: horizon }, (_, index) =>
    Math.max(0, level + slope * phi * (1 - phi ** (index + 1)) / (1 - phi))
  );
}

function trendSeasonality(series, horizon) {
  const n = series.length;
  const start = Math.max(0, n - 24);
  const values = series.slice(start).map(value => Math.max(0, finite(value)));
  if (!values.length) return Array(horizon).fill(0);
  const fit = linearFit(values);
  const average = Math.max(1, mean(values));
  const slope = clamp(fit.slope, -average * 0.08, average * 0.08);
  const base = values.map((_, index) => Math.max(1, fit.intercept + slope * index));
  const factors = Array(12).fill(1);
  for (let month = 0; month < 12; month += 1) {
    const ratios = [];
    values.forEach((value, index) => {
      if ((start + index) % 12 === month) ratios.push(value / base[index]);
    });
    if (ratios.length) {
      // Shrink one/two-observation monthly effects toward 1 to reduce overfit.
      const raw = mean(ratios);
      factors[month] = clamp(1 + 0.5 * (raw - 1), 0.65, 1.35);
    }
  }
  const factorMean = mean(factors) || 1;
  return Array.from({ length: horizon }, (_, index) => {
    const trend = Math.max(0, fit.intercept + slope * (values.length + index));
    const season = factors[(n + index) % 12] / factorMean;
    return Math.max(0, trend * season);
  });
}

function crostonSBA(series, horizon, alpha = 0.2) {
  let size = 0;
  let interval = 0;
  let sinceLastDemand = 0;
  let initialized = false;
  series.forEach(raw => {
    const value = Math.max(0, finite(raw));
    sinceLastDemand += 1;
    if (value <= 0) return;
    if (!initialized) {
      size = value;
      interval = sinceLastDemand;
      initialized = true;
    } else {
      size += alpha * (value - size);
      interval += alpha * (sinceLastDemand - interval);
    }
    sinceLastDemand = 0;
  });
  const level = initialized && interval > 0 ? Math.max(0, (size / interval) * (1 - alpha / 2)) : 0;
  return Array(horizon).fill(level);
}

function predictWithModel(name, series, horizon) {
  if (!series.length) return Array(horizon).fill(0);
  if (name === "Naive") return Array(horizon).fill(Math.max(0, finite(series[series.length - 1])));
  if (name === "Seasonal Naive") return seasonalNaive(series, horizon);
  if (name === "Damped Trend") return dampedTrend(series, horizon);
  if (name === "Trend + Seasonality") return trendSeasonality(series, horizon);
  if (name === "Croston SBA") return crostonSBA(series, horizon);
  return Array(horizon).fill(0);
}

function quantile(values, probability) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(probability, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

function summarizeErrors(actual, predicted) {
  const errors = actual.map((value, index) => Math.abs(value - predicted[index]));
  const denominator = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  const wape = denominator > 0 ? errors.reduce((sum, value) => sum + value, 0) / denominator * 100 : null;
  const smapeValues = actual.map((value, index) => {
    const total = Math.abs(value) + Math.abs(predicted[index]);
    return total > 0 ? 200 * Math.abs(value - predicted[index]) / total : 0;
  });
  const smape = smapeValues.length ? mean(smapeValues) : null;
  return {
    wape,
    smape,
    mae: errors.length ? mean(errors) : null,
    absErrors: errors,
    actualCount: actual.length
  };
}

function candidateNames(series) {
  const profile = describeSeries(series);
  const names = ["Naive", "Damped Trend"];
  if (series.length >= 12) names.push("Seasonal Naive");
  if (series.length >= 18) names.push("Trend + Seasonality");
  if (profile.intermittent && profile.activeMonths >= 4) names.push("Croston SBA");
  return names;
}

function backtestCandidate(series, horizon, modelName, startOrigin = MIN_TRAIN_POINTS) {
  const actual = [];
  const predicted = [];
  const errorsByLead = Array.from({ length: horizon }, () => []);
  let folds = 0;
  for (let origin = startOrigin; origin <= series.length - horizon; origin += 1) {
    const train = series.slice(0, origin);
    const truth = series.slice(origin, origin + horizon).map(value => Math.max(0, finite(value)));
    const forecast = predictWithModel(modelName, train, horizon);
    truth.forEach((value, index) => {
      actual.push(value);
      predicted.push(forecast[index]);
      errorsByLead[index].push(Math.abs(value - forecast[index]));
    });
    folds += 1;
  }
  return { ...summarizeErrors(actual, predicted), folds, errorsByLead };
}

export function selectForecastModel(seriesInput = [], horizon = 3) {
  const series = seriesInput.map(value => Math.max(0, finite(value)));
  const safeHorizon = clamp(Math.floor(finite(horizon) || 3), 1, 12);
  const profile = describeSeries(series);
  if (!profile.activeMonths) {
    return {
      model: null, forecast: Array(safeHorizon).fill(0), lower: Array(safeHorizon).fill(0),
      upper: Array(safeHorizon).fill(0), wape: null, smape: null, mae: null,
      folds: 0, confidence: "Insufficient", candidateScores: [], profile
    };
  }

  const candidates = candidateNames(series).map(name => ({
    name,
    metrics: backtestCandidate(series, safeHorizon, name)
  })).filter(item => Number.isFinite(item.metrics.wape));

  let selected = null;
  if (candidates.length) {
    candidates.sort((a, b) => {
      const delta = a.metrics.wape - b.metrics.wape;
      if (Math.abs(delta) > 1) return delta;
      return MODEL_ORDER.indexOf(a.name) - MODEL_ORDER.indexOf(b.name);
    });
    selected = candidates[0];
  } else {
    // No full rolling-origin fold is possible for short histories. Use a conservative
    // level forecast and explicitly mark it as unvalidated.
    const fallback = series.length >= 12 ? "Seasonal Naive" : "Naive";
    selected = {
      name: fallback,
      metrics: { wape: null, smape: null, mae: null, folds: 0, errorsByLead: Array.from({ length: safeHorizon }, () => []) }
    };
  }

  const forecast = predictWithModel(selected.name, series, safeHorizon);
  const errorsByLead = selected.metrics.errorsByLead || Array.from({ length: safeHorizon }, () => []);
  const lower = [];
  const upper = [];
  for (let index = 0; index < safeHorizon; index += 1) {
    const fallbackRadius = selected.metrics.mae || Math.max(0, mean(series.slice(-6)) * 0.15);
    const radius = quantile(errorsByLead[index], 0.8) || fallbackRadius * Math.sqrt(index + 1);
    lower.push(Math.max(0, forecast[index] - radius));
    upper.push(Math.max(0, forecast[index] + radius));
  }
  const wape = selected.metrics.wape;
  const folds = selected.metrics.folds || 0;
  const confidence = folds >= 6 && profile.activeMonths >= 18 && wape !== null && wape <= 20
    ? "High"
    : folds >= 4 && profile.activeMonths >= 12 && wape !== null && wape <= 35
      ? "Medium"
      : "Low";
  return {
    model: selected.name,
    forecast,
    lower,
    upper,
    wape,
    smape: selected.metrics.smape,
    mae: selected.metrics.mae,
    folds,
    confidence,
    candidateScores: candidates.map(item => ({
      model: item.name, wape: item.metrics.wape, smape: item.metrics.smape,
      folds: item.metrics.folds
    })),
    profile
  };
}

function sum(values) {
  return values.reduce((total, value) => total + finite(value), 0);
}

function topDownShare(child, parent, lookback = 12) {
  const window = Math.min(lookback, child.length, parent.length);
  const childTotal = sum(child.slice(-window));
  const parentTotal = sum(parent.slice(-window));
  if (parentTotal <= 0) return null;
  return clamp(childTotal / parentTotal, 0, 1);
}

function evaluateTopDown(child, parent, horizon) {
  const actual = [];
  const predicted = [];
  const errorsByLead = Array.from({ length: horizon }, () => []);
  let folds = 0;
  for (let origin = MIN_TRAIN_POINTS; origin <= child.length - horizon; origin += 1) {
    const childTrain = child.slice(0, origin);
    const parentTrain = parent.slice(0, origin);
    const share = topDownShare(childTrain, parentTrain, 12);
    if (share === null) continue;
    const parentFit = selectForecastModel(parentTrain, horizon);
    if (!parentFit.model) continue;
    const parentForecast = predictWithModel(parentFit.model, parentTrain, horizon);
    const childForecast = parentForecast.map(value => value * share);
    const truth = child.slice(origin, origin + horizon);
    truth.forEach((value, index) => {
      actual.push(Math.max(0, finite(value)));
      predicted.push(childForecast[index]);
      errorsByLead[index].push(Math.abs(Math.max(0, finite(value)) - childForecast[index]));
    });
    folds += 1;
  }
  return { ...summarizeErrors(actual, predicted), folds, errorsByLead };
}

export function forecastTopDownChild(childInput = [], parentInput = [], horizon = 3) {
  const child = childInput.map(value => Math.max(0, finite(value)));
  const parent = parentInput.map(value => Math.max(0, finite(value)));
  const safeHorizon = clamp(Math.floor(finite(horizon) || 3), 1, 12);
  const share = topDownShare(child, parent, 12);
  if (share === null || !child.some(value => value > 0)) {
    return {
      model: null, forecast: Array(safeHorizon).fill(0), lower: Array(safeHorizon).fill(0),
      upper: Array(safeHorizon).fill(0), wape: null, smape: null, folds: 0,
      confidence: "Insufficient", share, candidateScores: [], profile: describeSeries(child)
    };
  }
  const parentFit = selectForecastModel(parent, safeHorizon);
  if (!parentFit.model) {
    return {
      model: null, forecast: Array(safeHorizon).fill(0), lower: Array(safeHorizon).fill(0),
      upper: Array(safeHorizon).fill(0), wape: null, smape: null, folds: 0,
      confidence: "Insufficient", share, candidateScores: [], profile: describeSeries(child)
    };
  }
  const forecast = parentFit.forecast.map(value => value * share);
  const validation = evaluateTopDown(child, parent, safeHorizon);
  const lower = [];
  const upper = [];
  for (let index = 0; index < safeHorizon; index += 1) {
    const radius = quantile(validation.errorsByLead[index], 0.8)
      || (parentFit.mae || mean(parent.slice(-6)) * 0.15) * share * Math.sqrt(index + 1);
    lower.push(Math.max(0, forecast[index] - radius));
    upper.push(Math.max(0, forecast[index] + radius));
  }
  const confidence = validation.folds >= 6 && validation.wape !== null && validation.wape <= 20
    ? "High"
    : validation.folds >= 4 && validation.wape !== null && validation.wape <= 35
      ? "Medium"
      : "Low";
  return {
    model: "Top-down · " + parentFit.model,
    parentModel: parentFit.model,
    forecast, lower, upper,
    wape: validation.wape,
    smape: validation.smape,
    mae: validation.mae,
    folds: validation.folds,
    confidence,
    share,
    candidateScores: parentFit.candidateScores,
    profile: describeSeries(child)
  };
}

export function buildMonthKeys(startMonth, endMonth) {
  if (!startMonth || !endMonth) return [];
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  let cursor = startYear * 12 + startMonthNumber - 1;
  const end = endYear * 12 + endMonthNumber - 1;
  const keys = [];
  while (cursor <= end && keys.length < 240) {
    const year = Math.floor(cursor / 12);
    const month = cursor % 12 + 1;
    keys.push(String(year) + "-" + String(month).padStart(2, "0"));
    cursor += 1;
  }
  return keys;
}

export function aggregateMonthlySeries(rows = [], dimensions = [], metricKey = "revenue_inr", productFilter = "All products") {
  const source = rows.filter(row =>
    productFilter === "All products" || String(row.product_category || "Unspecified") === productFilter
  );
  const validMonths = source.map(row => String(row.order_date || "").slice(0, 7)).filter(value => /^\d{4}-\d{2}$/.test(value));
  if (!validMonths.length) return { months: [], groups: [], parents: new Map(), filteredRows: source };
  const minMonth = validMonths.reduce((a, b) => a < b ? a : b);
  const maxMonth = validMonths.reduce((a, b) => a > b ? a : b);
  const months = buildMonthKeys(minMonth, maxMonth);
  const monthIndex = new Map(months.map((month, index) => [month, index]));
  const groups = new Map();
  const parents = new Map();
  const dimensionKeys = dimensions.length ? dimensions : ["product_category"];

  const metricValue = row => {
    if (metricKey === "order_count") return 1;
    return finite(row[metricKey]);
  };
  source.forEach(row => {
    const month = String(row.order_date || "").slice(0, 7);
    const index = monthIndex.get(month);
    if (index === undefined) return;
    const values = dimensionKeys.map(key => String(row[key] ?? "Unspecified").trim() || "Unspecified");
    const groupKey = JSON.stringify(values);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey, label: values.join(" / "), values,
        series: Array(months.length).fill(0), orderRows: 0
      });
    }
    const amount = metricValue(row);
    const group = groups.get(groupKey);
    group.series[index] += amount;
    group.orderRows += 1;

    const parentKey = JSON.stringify(values[0]);
    if (!parents.has(parentKey)) {
      parents.set(parentKey, {
        key: parentKey, label: values[0], series: Array(months.length).fill(0)
      });
    }
    parents.get(parentKey).series[index] += amount;
  });

  const orderedGroups = [...groups.values()].sort((a, b) =>
    a.values.join(" / ").localeCompare(b.values.join(" / "), undefined, { numeric: true, sensitivity: "base" })
  );
  return { months, groups: orderedGroups, parents, filteredRows: source };
}

export function forecastGroupedSeries(aggregation, dimensions = [], horizon = 3) {
  const { groups, parents } = aggregation;
  return groups.map(group => {
    const fit = dimensions.length > 1
      ? forecastTopDownChild(group.series, parents.get(JSON.stringify(group.values[0]))?.series || [], horizon)
      : selectForecastModel(group.series, horizon);
    return {
      ...group,
      ...fit,
      actualTotal: sum(group.series),
      latestActual: group.series[group.series.length - 1] || 0
    };
  });
}
