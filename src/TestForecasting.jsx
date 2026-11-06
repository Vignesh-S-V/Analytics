import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, BrainCircuit, CalendarRange, Gauge, Info, Layers3,
  ShieldCheck, Sparkles, TrendingUp
} from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { aggregateMonthlySeries, forecastGroupedSeries } from "./forecasting.js";
import "./test-forecast.css";

const HORIZONS = [3, 6, 9, 12];
const MEASURES = [
  { key: "revenue_inr", label: "Revenue", unit: "₹" },
  { key: "shipped_qty", label: "Shipped quantity", unit: "qty" },
  { key: "order_qty", label: "Order quantity", unit: "qty" },
  { key: "order_count", label: "Order count", unit: "orders" }
];

const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);
const monthName = key => {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", {
    month: "short", year: "numeric", timeZone: "UTC"
  });
};
const nextMonth = key => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
};
const displayValue = (value, measure) => {
  const numeric = Number(value || 0);
  return measure.key === "revenue_inr"
    ? "₹" + numeric.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : numeric.toLocaleString("en-IN", { maximumFractionDigits: 1 });
};
const percentage = value => Number.isFinite(value) ? value.toFixed(1) + "%" : "—";
const modelDescription = model => {
  if (!model) return "Not enough demand history";
  if (model.includes("Top-down")) return "Forecast the parent category/country, then allocate to this group using its trailing 12-month share.";
  if (model === "Trend + Seasonality") return "Trend regression with a shrinkage-adjusted annual month profile.";
  if (model === "Seasonal Naive") return "Repeats the same month from the latest complete annual cycle.";
  if (model === "Damped Trend") return "Recent level and trend, with the trend gradually damped.";
  if (model === "Croston SBA") return "Intermittent-demand model that separates demand size from the gap between non-zero months.";
  return "Uses the latest observed monthly value as a conservative baseline.";
};

function Stat({ label, value, detail, icon: Icon, tone = "blue" }) {
  return (
    <div className={"tf-stat tf-stat-" + tone}>
      <div className="tf-stat-top"><span>{label}</span>{Icon && <Icon size={15} />}</div>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export default function TestForecasting({ orders = [], rowFields = [], dimensions = [] }) {
  const [product, setProduct] = useState("All products");
  const [horizon, setHorizon] = useState(3);
  const [measureKey, setMeasureKey] = useState("revenue_inr");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [manualGrowth, setManualGrowth] = useState("");
  const [groupSearch, setGroupSearch] = useState("");

  const measure = MEASURES.find(item => item.key === measureKey) || MEASURES[0];
  const dimensionLabels = rowFields.map(key =>
    dimensions.find(item => item.key === key)?.label || key
  );
  const productOptions = useMemo(
    () => [...new Set(orders.map(row => String(row.product_category || "Unspecified")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b)),
    [orders]
  );
  const invalidDimension = rowFields.includes("order_id");
  const aggregation = useMemo(
    () => aggregateMonthlySeries(orders, rowFields, measureKey, product),
    [orders, rowFields, measureKey, product]
  );
  const tooManyGroups = aggregation.groups.length > 250;
  const modelRows = useMemo(() => {
    if (invalidDimension || tooManyGroups || !aggregation.groups.length) return [];
    return forecastGroupedSeries(aggregation, rowFields, horizon);
  }, [aggregation, rowFields, horizon, invalidDimension, tooManyGroups]);

  useEffect(() => {
    if (!modelRows.length) {
      setSelectedGroup("");
      return;
    }
    if (!modelRows.some(row => row.key === selectedGroup)) setSelectedGroup(modelRows[0].key);
  }, [modelRows, selectedGroup]);

  const growthNumber = manualGrowth.trim() === "" ? null : Number(manualGrowth);
  const validGrowth = growthNumber === null || (
    Number.isFinite(growthNumber) && growthNumber >= -100 && growthNumber <= 1000
  );
  const scenarioRows = useMemo(() => modelRows.map(row => {
    const applyOverride = row.key === selectedGroup && growthNumber !== null && validGrowth;
    const factor = applyOverride ? 1 + growthNumber / 100 : 1;
    return {
      ...row,
      scenarioForecast: row.forecast.map(value => Math.max(0, value * factor)),
      scenarioLower: row.lower.map(value => Math.max(0, value * factor)),
      scenarioUpper: row.upper.map(value => Math.max(0, value * factor)),
      overrideApplied: applyOverride
    };
  }), [modelRows, selectedGroup, growthNumber, validGrowth]);

  const selected = scenarioRows.find(row => row.key === selectedGroup) || scenarioRows[0] || null;
  const latestMonth = aggregation.months.at(-1) || "";
  const firstMonth = aggregation.months[0] || "";
  const totalBaseForecast = sum(modelRows.map(row => sum(row.forecast)));
  const totalScenarioForecast = sum(scenarioRows.map(row => sum(row.scenarioForecast)));
  const totalLower = sum(scenarioRows.map(row => sum(row.scenarioLower)));
  const totalUpper = sum(scenarioRows.map(row => sum(row.scenarioUpper)));
  const selectedForecastTotal = selected ? sum(selected.scenarioForecast) : 0;
  const selectedBaseTotal = selected ? sum(selected.forecast) : 0;
  const upliftAmount = selected?.overrideApplied ? selectedForecastTotal - selectedBaseTotal : 0;
  const activeDimensionCount = rowFields.length;
  const monthGap = useMemo(() => {
    if (!latestMonth) return 0;
    const [year, month] = latestMonth.split("-").map(Number);
    const now = new Date();
    const currentCompletedMonth = now.getFullYear() * 12 + now.getMonth() - 1;
    return Math.max(0, currentCompletedMonth - (year * 12 + month - 1));
  }, [latestMonth]);

  const filteredTableRows = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return [...scenarioRows]
      .filter(row => !query || row.label.toLowerCase().includes(query))
      .sort((a, b) => sum(b.scenarioForecast) - sum(a.scenarioForecast));
  }, [scenarioRows, groupSearch]);

  const chartData = useMemo(() => {
    if (!selected || !aggregation.months.length) return [];
    const history = aggregation.months.map((month, index) => ({
      period: monthName(month),
      actual: selected.series[index] || 0,
      forecast: null,
      lower: null,
      upper: null
    }));
    const last = history.length - 1;
    if (last >= 0) history[last].forecast = history[last].actual;
    const future = selected.scenarioForecast.map((value, index) => {
      const month = nextMonth(index === 0 ? latestMonth : nextMonth(latestMonth));
      const [year, monthNumber] = latestMonth.split("-").map(Number);
      const date = new Date(Date.UTC(year, monthNumber - 1 + index + 1, 1));
      const key = date.toISOString().slice(0, 7);
      return {
        period: monthName(key),
        actual: null,
        forecast: value,
        lower: selected.scenarioLower[index],
        upper: selected.scenarioUpper[index],
        _month: month
      };
    });
    return history.concat(future);
  }, [selected, aggregation.months, latestMonth]);

  const modelScores = selected?.candidateScores || [];
  const confidenceClass = selected?.confidence?.toLowerCase() || "low";
  const horizonLabel = horizon + " months";
  const startForecast = latestMonth ? monthName(nextMonth(latestMonth)) : "—";
  const endForecast = chartData.length > aggregation.months.length
    ? chartData[chartData.length - 1].period
    : "—";

  return (
    <section className="tf-section">
      <div className="tf-section-heading">
        <div>
          <span className="tp-kicker">FORECASTING ENGINE · TEST WORKSPACE</span>
          <h2><BrainCircuit size={21} /> Demand & Revenue Forecast</h2>
          <p>Forecast each selected row group independently. The engine tests candidate methods using chronological rolling-origin backtests before choosing a model.</p>
        </div>
        <div className="tf-engine-pill"><Sparkles size={14} /> Auto model selection</div>
      </div>

      <div className="tf-filter-card">
        <label><span>Product</span>
          <select value={product} onChange={event => setProduct(event.target.value)}>
            <option>All products</option>
            {productOptions.map(value => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        <label><span>Forecast period</span>
          <select value={horizon} onChange={event => setHorizon(Number(event.target.value))}>
            {HORIZONS.map(value => <option value={value} key={value}>{value} months</option>)}
          </select>
        </label>
        <label><span>Forecast measure</span>
          <select value={measureKey} onChange={event => setMeasureKey(event.target.value)}>
            {MEASURES.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}
          </select>
        </label>
        <div className="tf-filter-help"><CalendarRange size={15} /> Monthly frequency · History: {firstMonth ? monthName(firstMonth) + " – " + monthName(latestMonth) : "—"}</div>
      </div>

      {latestMonth && (
        <div className={"tf-data-warning" + (monthGap > 2 ? " tf-data-warning-stale" : "")}>
          <Info size={17} />
          <div>
            <strong>{monthGap > 2 ? "Historical data is stale — do not treat this as a current 2026 forecast." : "Forecast source coverage"}</strong>
            <p>
              {aggregation.months.length} monthly points are available, from {monthName(firstMonth)} through {monthName(latestMonth)}.
              {monthGap > 0
                ? " The latest complete source month is " + monthName(latestMonth) + "; " + monthGap + " completed months are missing before the current planning period. This scenario starts in " + startForecast + ". Load the missing actuals before using it for live buying or production decisions."
                : " The forecast begins after the latest month in the source."}
            </p>
          </div>
        </div>
      )}

      <div className="tf-row-config">
        <div className="tf-row-config-main">
          <Layers3 size={16} />
          <div><b>Forecast groups use your current Rows layout</b><span>{dimensionLabels.length ? dimensionLabels.join(" → ") : "No row fields selected"} · {aggregation.groups.length.toLocaleString("en-IN")} groups</span></div>
        </div>
        <div className="tf-row-config-note">
          {activeDimensionCount > 1
            ? "Multiple fields: parent-level forecast is allocated to each child using its trailing 12-month share."
            : "One field: each group is fitted and backtested as its own monthly series."}
        </div>
      </div>

      {invalidDimension ? (
        <div className="tf-empty"><Info size={20} /><b>Order ID cannot be used as a demand-forecast dimension.</b><span>Each order ID is a one-time transaction, not a repeat demand series. Remove Order ID from Rows and use a repeatable attribute such as category, country, fabric, style, buyer or production line.</span></div>
      ) : tooManyGroups ? (
        <div className="tf-empty"><Info size={20} /><b>Too many groups to forecast reliably in one view.</b><span>{aggregation.groups.length.toLocaleString("en-IN")} groups were created. Filter the product or remove a high-cardinality field before training; the engine caps one run at 250 groups to protect browser performance.</span></div>
      ) : !scenarioRows.length ? (
        <div className="tf-empty"><Activity size={20} /><b>Forecast history is not available.</b><span>Load monthly order history to train and compare the candidate models.</span></div>
      ) : (
        <>
          <div className="tf-stats">
            <Stat label={"Total forecast · next " + horizonLabel} value={displayValue(totalScenarioForecast, measure)} detail={startForecast + " to " + endForecast} icon={TrendingUp} tone="blue" />
            <Stat label="Approx. 80% planning range" value={displayValue(totalLower, measure) + " – " + displayValue(totalUpper, measure)} detail="Empirical error envelope; not a guarantee" icon={Gauge} tone="violet" />
            <Stat label="Forecast groups" value={scenarioRows.length.toLocaleString("en-IN")} detail="Created from selected row fields" icon={Layers3} tone="blue" />
            <Stat label="Selected group · backtest WAPE" value={percentage(selected?.wape)} detail={(selected?.folds || 0) + " rolling validation windows"} icon={Activity} tone={confidenceClass === "high" ? "green" : confidenceClass === "medium" ? "blue" : "amber"} />
          </div>

          <div className="tf-override-panel">
            <div className="tf-override-title"><TrendingUp size={16} /><div><b>Manual growth override · selected group only</b><span>Use this only when the base forecast is below your business target. Other groups remain unchanged.</span></div></div>
            <label><span>Selected product / group</span>
              <select value={selectedGroup} onChange={event => setSelectedGroup(event.target.value)}>
                {scenarioRows.map(row => <option value={row.key} key={row.key}>{row.label}</option>)}
              </select>
            </label>
            <label><span>Manual uplift (%)</span>
              <input type="number" min="-100" max="1000" step="0.1" value={manualGrowth} onChange={event => setManualGrowth(event.target.value)} placeholder="Leave blank to use model output" />
            </label>
            <button type="button" className="tf-clear-override" onClick={() => setManualGrowth("")}>Clear override</button>
            {!validGrowth && <small className="tf-validation">Enter a value between -100% and 1,000%.</small>}
            {selected?.overrideApplied && validGrowth && <div className="tf-override-impact">Only this group changes: {displayValue(upliftAmount, measure)} uplift ({percentage(growthNumber)}). New group forecast: {displayValue(selectedForecastTotal, measure)}.</div>}
          </div>

          <div className="tf-analysis-grid">
            <div className="tf-chart-card">
              <div className="tf-card-heading">
                <div><span className="tp-kicker">SELECTED GROUP</span><h3>{selected?.label || "Forecast trend"}</h3><p>{selected?.model || "Model not available"} · next {horizonLabel}</p></div>
                <span className={"tf-confidence tf-confidence-" + confidenceClass}>{selected?.confidence || "Low"} confidence</span>
              </div>
              <div className="tf-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 10, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke="#e9eef5" strokeDasharray="3 4" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={value => measure.key === "revenue_inr" ? "₹" + (value / 100000).toFixed(0) + "L" : Number(value).toLocaleString("en-IN")} width={58} />
                    <Tooltip formatter={(value, name) => [displayValue(value, measure), name]} />
                    <Line type="monotone" dataKey="actual" name="Actual" stroke="#315d91" strokeWidth={2.2} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#0e9b76" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 2 }} connectNulls />
                    <Line type="monotone" dataKey="lower" name="80% lower range" stroke="#b4a5d9" strokeWidth={1} strokeDasharray="2 4" dot={false} connectNulls />
                    <Line type="monotone" dataKey="upper" name="80% upper range" stroke="#b4a5d9" strokeWidth={1} strokeDasharray="2 4" dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="tf-chart-foot">
                <span>Actual history ends {monthName(latestMonth)}.</span>
                <span>Forecast starts {startForecast}.</span>
              </div>
            </div>

            <div className="tf-model-card">
              <div className="tf-card-heading"><div><span className="tp-kicker">MODEL TRAINING & VALIDATION</span><h3>{selected?.model || "Model selection"}</h3><p>{modelDescription(selected?.model)}</p></div><BrainCircuit size={19} /></div>
              <div className="tf-model-metrics">
                <div><span>WAPE</span><b>{percentage(selected?.wape)}</b></div>
                <div><span>sMAPE</span><b>{percentage(selected?.smape)}</b></div>
                <div><span>Training points</span><b>{selected?.profile?.points || 0}</b></div>
                <div><span>Active months</span><b>{selected?.profile?.activeMonths || 0}</b></div>
                <div><span>Demand pattern</span><b>{selected?.profile?.demandType || "—"}</b></div>
                <div><span>Validation windows</span><b>{selected?.folds || 0}</b></div>
              </div>
              <p className="tf-model-note">
                {horizon === 12 && (selected?.folds || 0) < 2
                  ? "Only one 12-month holdout window is possible with the available history. Treat the 12-month forecast as low-confidence."
                  : selected?.confidence === "Low"
                    ? "Backtest error or history depth is weak for this group. Use this output as a planning scenario, not a firm commitment."
                    : "The selected model had the lowest horizon-specific WAPE among the tested candidates for this series."}
              </p>
              <div className="tf-candidate-list">
                <b>Candidate comparison</b>
                {(modelScores.length ? modelScores : []).map(item => (
                  <div className="tf-candidate-row" key={item.model}>
                    <span>{item.model}</span><strong>{percentage(item.wape)}</strong><small>{item.folds} folds</small>
                  </div>
                ))}
                {!modelScores.length && <small>Not enough validation history for a reliable model ranking.</small>}
              </div>
            </div>
          </div>

          <div className="tf-table-card">
            <div className="tf-table-heading">
              <div><span className="tp-kicker">GROUP-LEVEL FORECAST OUTPUT</span><h3>Forecast by {dimensionLabels.join(" → ") || "selected dimension"}</h3><p>Click any row to inspect its trend, validation result and manual override target.</p></div>
              <input value={groupSearch} onChange={event => setGroupSearch(event.target.value)} placeholder="Search forecast groups..." />
            </div>
            <div className="tf-table-scroll">
              <table className="tf-table">
                <thead><tr><th>Forecast group</th><th>Model</th><th>History activity</th><th>Backtest WAPE</th><th>Confidence</th><th>Forecast · {horizonLabel}</th></tr></thead>
                <tbody>
                  {filteredTableRows.map(row => (
                    <tr key={row.key} className={row.key === selectedGroup ? "tf-selected-row" : ""} onClick={() => setSelectedGroup(row.key)}>
                      <td><button type="button" className="tf-group-link" onClick={event => { event.stopPropagation(); setSelectedGroup(row.key); }}>{row.label}</button>{row.overrideApplied && <small className="tf-override-tag">Manual +{growthNumber}%</small>}</td>
                      <td><span className="tf-model-name">{row.model || "Not available"}</span></td>
                      <td>{row.profile?.activeMonths || 0} / {row.profile?.points || 0} months</td>
                      <td>{percentage(row.wape)}</td>
                      <td><span className={"tf-confidence tf-confidence-" + (row.confidence || "low").toLowerCase()}>{row.confidence || "Low"}</span></td>
                      <td className="tf-money">{displayValue(sum(row.scenarioForecast), measure)}</td>
                    </tr>
                  ))}
                  {!filteredTableRows.length && <tr><td colSpan={6}>No forecast groups match this search.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="tf-table-foot">
              <span>WAPE = total absolute forecast error ÷ total actual value. Lower is better.</span>
              <span>Rows with limited history are marked Low confidence rather than hiding the uncertainty.</span>
            </div>
          </div>
        </>
      )}

      <div className="tf-method-note">
        <ShieldCheck size={16} />
        <span>All forecasts use monthly history only. The current source has no price-promotion, inventory-stockout or holiday-event regressors, so the engine does not invent them. Forecasts are re-trained in the browser from the latest rows available in the workspace.</span>
      </div>
    </section>
  );
}
