import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3,
  Boxes, Calculator, CircleDollarSign, Factory, Gauge, Globe2,
  Layers, Lightbulb, Package, RefreshCw, ShieldAlert, Target,
  TrendingUp, Truck, Wallet
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart,
  Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Scatter,
  ScatterChart, Tooltip, XAxis, YAxis, ZAxis
} from 'recharts';
import './product-economics.css';

const COLORS = ['#E07842', '#243B53', '#2A9D8F', '#8A5A83', '#E9C46A', '#577590'];
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const fmt = value => num(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const compact = value => {
  const n = num(value), a = Math.abs(n);
  const f = x => Number(x.toFixed(2)).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (a >= 1e7) return f(n / 1e7) + ' Cr';
  if (a >= 1e5) return f(n / 1e5) + ' Lakh';
  if (a >= 1e3) return f(n / 1e3) + ' K';
  return fmt(n);
};
const money = value => '₹' + compact(value);
const pct = value => Number.isFinite(value) ? value.toFixed(2) + '%' : '—';
const efficiencyPct = value => Number.isFinite(value) ? pct(Math.abs(value) <= 1 ? value * 100 : value) : '—';
const quantityOf = row => num(row.shipped_qty) > 0 ? num(row.shipped_qty) : num(row.order_qty);
const keyOf = row => [row.product_category || 'Unclassified', row.fabric || 'Unknown fabric', row.style_id || 'No style'].join(' | ');
const dateMonth = value => value ? new Date(String(value).slice(0, 7) + '-01T00:00:00Z').toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const sum = (rows, key) => rows.reduce((total, row) => total + num(row[key]), 0);
const directCostOf = row => (num(row.fabric_cost_per_pc_inr) + num(row.trims_cost_per_pc_inr) + num(row.cmt_cost_per_pc_inr)) * quantityOf(row);
const lateRow = row => !!(row.ship_due_date && row.actual_ship_date && String(row.actual_ship_date).slice(0, 10) > String(row.ship_due_date).slice(0, 10));

function Section({ number, title, subtitle, icon: Icon, children, className = '' }) {
  return <section className={'pe-section ' + className}>
    <header className="pe-section-head">
      <div className="pe-section-icon">{Icon ? <Icon size={18} /> : <BarChart3 size={18} />}</div>
      <div><span className="pe-kicker">{number}</span><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
    </header>
    {children}
  </section>;
}
function Panel({ title, subtitle, right, children, className = '' }) {
  return <article className={'panel pe-panel ' + className}>
    <div className="pe-panel-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{right}</div>
    {children}
  </article>;
}
function Metric({ label, value, note, tone = 'navy', icon: Icon }) {
  return <article className={'pe-metric ' + tone}>
    <div className="pe-metric-top"><span>{label}</span>{Icon && <Icon size={17} />}</div>
    <strong>{value}</strong>
    {note && <small>{note}</small>}
  </article>;
}
function SliderField({ label, value, onChange, min = -30, max = 30, suffix = '%' }) {
  return <label className="pe-slider-field">
    <span><b>{label}</b><strong>{value > 0 ? '+' : ''}{value}{suffix}</strong></span>
    <input type="range" min={min} max={max} step="1" value={value} onChange={event => onChange(Number(event.target.value))} />
    <small>{min}{suffix} to +{max}{suffix}</small>
  </label>;
}
function EmptyState({ children }) {
  return <div className="pe-empty"><Lightbulb size={17} /><span>{children}</span></div>;
}

export default function ProductEconomics({
  orders = [], live = false, productKey, setProductKey, taxRate, setTaxRate,
  supplierRows = [], marketRows = []
}) {
  const [groupBy, setGroupBy] = useState('product');
  const [priceDelta, setPriceDelta] = useState(0);
  const [fabricDelta, setFabricDelta] = useState(0);
  const [trimsDelta, setTrimsDelta] = useState(0);
  const [cmtDelta, setCmtDelta] = useState(0);
  const [otherDelta, setOtherDelta] = useState(0);
  const [fxDelta, setFxDelta] = useState(0);
  const [targetGp, setTargetGp] = useState(15);
  const [targetNp, setTargetNp] = useState(10);
  const [marginAlert, setMarginAlert] = useState(15);
  const [rejectionAlert, setRejectionAlert] = useState(3);
  const [reworkAlert, setReworkAlert] = useState(2);
  const [indirectAlert, setIndirectAlert] = useState(30);
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  const options = useMemo(() => [...new Set(orders.map(keyOf))].sort(), [orders]);
  const data = useMemo(() => {
    const rows = orders.filter(row => productKey === 'All products' || keyOf(row) === productKey);
    const revenue = sum(rows, 'revenue_inr');
    const netProfit = sum(rows, 'profit_inr');
    const totalCost = sum(rows, 'total_cost_inr');
    const orderedQty = sum(rows, 'order_qty');
    const shippedQty = sum(rows, 'shipped_qty');
    const unitQty = shippedQty || orderedQty;
    const fabricCost = rows.reduce((v, row) => v + num(row.fabric_cost_per_pc_inr) * quantityOf(row), 0);
    const trimsCost = rows.reduce((v, row) => v + num(row.trims_cost_per_pc_inr) * quantityOf(row), 0);
    const cmtCost = rows.reduce((v, row) => v + num(row.cmt_cost_per_pc_inr) * quantityOf(row), 0);
    const directCost = fabricCost + trimsCost + cmtCost;
    const otherCost = totalCost - directCost;
    const grossProfit = revenue - directCost;
    const grossMargin = revenue ? grossProfit / revenue * 100 : 0;
    const netMargin = revenue ? netProfit / revenue * 100 : 0;
    const unitPrice = unitQty ? revenue / unitQty : 0;
    const unitCost = unitQty ? totalCost / unitQty : 0;
    const unitDirectCost = unitQty ? directCost / unitQty : 0;
    const unitGp = unitQty ? grossProfit / unitQty : 0;
    const unitNp = unitQty ? netProfit / unitQty : 0;
    const rejectionQty = sum(rows, 'rejection_qty');
    const rejectionPct = orderedQty ? rejectionQty / orderedQty * 100 : 0;
    const reworkCost = sum(rows, 'rework_cost_inr');
    const reworkShare = revenue ? reworkCost / revenue * 100 : 0;
    const indirectShare = totalCost ? otherCost / totalCost * 100 : 0;
    const orderCount = new Set(rows.map(row => row.order_id).filter(Boolean)).size;
    const groupsMap = new Map();
    rows.forEach(row => {
      let label = '';
      if (groupBy === 'category') label = row.product_category || 'Unclassified';
      else if (groupBy === 'fabric') label = row.fabric || 'Unknown fabric';
      else if (groupBy === 'style') label = row.style_id || 'No style';
      else if (groupBy === 'season') label = row.season || 'Unspecified season';
      else label = [row.product_category || 'Unclassified', row.fabric || 'Unknown fabric', row.style_id || 'No style'].join(' · ');
      const group = groupsMap.get(label) || {
        label, revenue: 0, profit: 0, totalCost: 0, directCost: 0, units: 0,
        orders: new Set(), rejection: 0, rework: 0, rows: 0
      };
      group.revenue += num(row.revenue_inr);
      group.profit += num(row.profit_inr);
      group.totalCost += num(row.total_cost_inr);
      group.directCost += directCostOf(row);
      group.units += quantityOf(row);
      group.rejection += num(row.rejection_qty);
      group.rework += num(row.rework_cost_inr);
      group.rows += 1;
      if (row.order_id) group.orders.add(row.order_id);
      groupsMap.set(label, group);
    });
    const portfolio = [...groupsMap.values()].map(group => ({
      ...group, orders: group.orders.size,
      gp: group.revenue - group.directCost,
      gpPct: group.revenue ? (group.revenue - group.directCost) / group.revenue * 100 : null,
      npPct: group.revenue ? group.profit / group.revenue * 100 : null,
      revenueCr: group.revenue / 1e7,
      rejectionPct: group.units ? group.rejection / group.units * 100 : 0,
      reworkShare: group.revenue ? group.rework / group.revenue * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);
    const medianRevenue = median(portfolio.map(group => group.revenue));
    const medianMargin = median(portfolio.map(group => group.gpPct).filter(Number.isFinite));
    const portfolioClassified = portfolio.map(group => {
      const highRevenue = group.revenue >= medianRevenue;
      const highMargin = group.gpPct !== null && group.gpPct >= medianMargin;
      const quadrant = highRevenue && highMargin ? 'Star product' :
        !highRevenue && highMargin ? 'Growth opportunity' :
        highRevenue && !highMargin ? 'Pricing review' : 'Turnaround review';
      return { ...group, quadrant };
    });
    const linesMap = new Map();
    rows.forEach(row => {
      const id = row.line_id || 'Unassigned line';
      const line = linesMap.get(id) || { id, revenue: 0, profit: 0, directCost: 0, totalCost: 0, orderQty: 0, smv: 0, rejection: 0, rework: 0, actualWeighted: 0, targetWeighted: 0, efficiencyWeight: 0, orders: new Set() };
      const q = num(row.order_qty);
      line.revenue += num(row.revenue_inr);
      line.profit += num(row.profit_inr);
      line.directCost += directCostOf(row);
      line.totalCost += num(row.total_cost_inr);
      line.orderQty += q;
      line.smv += num(row.smv_minutes) * q;
      line.rejection += num(row.rejection_qty);
      line.rework += num(row.rework_cost_inr);
      if (row.actual_efficiency !== null && row.actual_efficiency !== undefined) {
        line.actualWeighted += num(row.actual_efficiency) * q;
        line.efficiencyWeight += q;
      }
      if (row.target_efficiency !== null && row.target_efficiency !== undefined) line.targetWeighted += num(row.target_efficiency) * q;
      if (row.order_id) line.orders.add(row.order_id);
      linesMap.set(id, line);
    });
    const lines = [...linesMap.values()].map(line => ({
      ...line, orders: line.orders.size,
      gp: line.revenue - line.directCost,
      actualEfficiency: line.efficiencyWeight ? line.actualWeighted / line.efficiencyWeight : null,
      gpPerSmv: line.smv ? (line.revenue - line.directCost) / line.smv : null,
      rejectionPct: line.orderQty ? line.rejection / line.orderQty * 100 : 0
    })).sort((a, b) => b.gp - a.gp);
    const supplierMaster = new Map(supplierRows.map(row => [String(row.supplier_id), row]));
    const suppliersMap = new Map();
    rows.forEach(row => {
      if (!row.supplier_id) return;
      const id = String(row.supplier_id);
      const supplier = suppliersMap.get(id) || {
        id, revenue: 0, profit: 0, totalCost: 0, directCost: 0,
        orders: new Set(), rework: 0, latePenalty: 0, late: 0, dated: 0,
        rejection: 0, units: 0
      };
      supplier.revenue += num(row.revenue_inr);
      supplier.profit += num(row.profit_inr);
      supplier.totalCost += num(row.total_cost_inr);
      supplier.directCost += directCostOf(row);
      supplier.rework += num(row.rework_cost_inr);
      supplier.latePenalty += num(row.late_penalty_inr);
      supplier.rejection += num(row.rejection_qty);
      supplier.units += num(row.order_qty);
      if (row.order_id) supplier.orders.add(row.order_id);
      if (row.ship_due_date && row.actual_ship_date) {
        supplier.dated += 1;
        if (lateRow(row)) supplier.late += 1;
      }
      suppliersMap.set(id, supplier);
    });
    const linkedSuppliers = [...suppliersMap.values()].map(item => {
      const master = supplierMaster.get(item.id) || {};
      return {
        ...item, name: master.supplier_name || item.id,
        supplyType: master.supply_type || '—',
        quality: master.quality_rating == null ? null : num(master.quality_rating),
        avgDelay: master.avg_delay_days == null ? null : num(master.avg_delay_days),
        creditDays: master.credit_days == null ? null : num(master.credit_days),
        orders: item.orders.size,
        margin: item.revenue ? item.profit / item.revenue * 100 : null,
        latePct: item.dated ? item.late / item.dated * 100 : null
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
    const fxRows = rows.filter(row => num(row.fob_price_usd) > 0 && num(row.exchange_rate) > 0 && quantityOf(row) > 0);
    const usdExposure = fxRows.reduce((total, row) => total + num(row.fob_price_usd) * quantityOf(row), 0);
    const fxExposure = fxRows.reduce((total, row) => total + num(row.fob_price_usd) * quantityOf(row) * num(row.exchange_rate), 0);
    const weightedFx = usdExposure ? fxExposure / usdExposure : null;
    const marketSorted = [...marketRows].filter(row => row.usd_inr != null && row.month).sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const latestMarket = marketSorted.at(-1) || null;
    const previousMarket = marketSorted.at(-2) || null;
    const smvMinutes = rows.reduce((total, row) => total + num(row.smv_minutes) * num(row.order_qty), 0);
    const weightedEfficiencyRows = rows.filter(row => row.actual_efficiency != null && num(row.order_qty) > 0);
    const actualEfficiency = weightedEfficiencyRows.length
      ? weightedEfficiencyRows.reduce((total, row) => total + num(row.actual_efficiency) * num(row.order_qty), 0) /
        weightedEfficiencyRows.reduce((total, row) => total + num(row.order_qty), 0)
      : null;
    const targetEfficiencyRows = rows.filter(row => row.target_efficiency != null && num(row.order_qty) > 0);
    const targetEfficiency = targetEfficiencyRows.length
      ? targetEfficiencyRows.reduce((total, row) => total + num(row.target_efficiency) * num(row.order_qty), 0) /
        targetEfficiencyRows.reduce((total, row) => total + num(row.order_qty), 0)
      : null;
    const rejectionCostProxy = orderedQty ? rejectionQty * (totalCost / orderedQty) : 0;
    const topFiveRevenue = portfolio.slice(0, 5).reduce((total, group) => total + group.revenue, 0);
    return {
      rows, revenue, netProfit, totalCost, orderedQty, shippedQty, unitQty,
      fabricCost, trimsCost, cmtCost, directCost, otherCost, grossProfit,
      grossMargin, netMargin, unitPrice, unitCost, unitDirectCost, unitGp,
      unitNp, rejectionQty, rejectionPct, reworkCost, reworkShare,
      indirectShare, orderCount, portfolio: portfolioClassified,
      medianRevenue, medianMargin, lines, linkedSuppliers, usdExposure,
      fxExposure, weightedFx, latestMarket, previousMarket, smvMinutes,
      actualEfficiency, targetEfficiency, rejectionCostProxy, topFiveRevenue
    };
  }, [orders, productKey, groupBy, supplierRows, marketRows]);

  const d = data;
  const sourceAvailable = live && d.rows.length > 0;
  const unitCount = d.unitQty;
  const unitTax = String(taxRate).trim() !== '' ? d.unitPrice * num(taxRate) / 100 : null;
  const afterTaxPrice = unitTax === null ? null : d.unitPrice + unitTax;
  const waterfallData = [
    { name: 'Revenue', range: [0, d.revenue], amount: d.revenue, color: '#243B53' },
    { name: 'Fabric', range: [d.revenue - d.fabricCost, d.revenue], amount: -d.fabricCost, color: '#E07842' },
    { name: 'Trims', range: [d.revenue - d.fabricCost - d.trimsCost, d.revenue - d.fabricCost], amount: -d.trimsCost, color: '#E9A36C' },
    { name: 'CMT', range: [d.revenue - d.directCost, d.revenue - d.fabricCost - d.trimsCost], amount: -d.cmtCost, color: '#D18A45' },
    { name: 'Gross profit', range: [0, d.grossProfit], amount: d.grossProfit, color: '#2A9D8F' },
    { name: 'Other / indirect', range: [Math.min(d.netProfit, d.grossProfit), Math.max(d.netProfit, d.grossProfit)], amount: d.netProfit - d.grossProfit, color: '#8A5A83' },
    { name: 'Net profit', range: [Math.min(0, d.netProfit), Math.max(0, d.netProfit)], amount: d.netProfit, color: d.netProfit >= 0 ? '#2A9D8F' : '#D95D5D' }
  ];
  const marginMatrixRows = d.portfolio.filter(row => (row.label + ' ' + row.quadrant).toLowerCase().includes(portfolioSearch.toLowerCase())).slice(0, 25);
  const topFiveShare = d.revenue ? d.topFiveRevenue / d.revenue * 100 : 0;
  const simulatedRevenue = d.revenue * (1 + priceDelta / 100);
  const simFabric = d.fabricCost * (1 + fabricDelta / 100);
  const simTrims = d.trimsCost * (1 + trimsDelta / 100);
  const simCmt = d.cmtCost * (1 + cmtDelta / 100);
  const simOther = d.otherCost * (1 + otherDelta / 100);
  const simulatedDirect = simFabric + simTrims + simCmt;
  const simulatedCost = simFabric + simTrims + simCmt + simOther;
  const simulatedGp = d.grossProfit + (simulatedRevenue - d.revenue) - (simulatedDirect - d.directCost);
  const simulatedNp = d.netProfit + (simulatedRevenue - d.revenue) - (simulatedCost - d.totalCost);
  const simulatedGpPct = simulatedRevenue ? simulatedGp / simulatedRevenue * 100 : 0;
  const simulatedNpPct = simulatedRevenue ? simulatedNp / simulatedRevenue * 100 : 0;
  const safeTargetGp = Math.min(95, Math.max(0, num(targetGp)));
  const safeTargetNp = Math.min(95, Math.max(0, num(targetNp)));
  const costRecoveryPrice = unitCount ? d.totalCost / unitCount : null;
  const targetGpPrice = unitCount && safeTargetGp < 100 ? d.unitDirectCost / (1 - safeTargetGp / 100) : null;
  const targetNpPrice = unitCount && safeTargetNp < 100 ? d.unitCost / (1 - safeTargetNp / 100) : null;
  const priceCushion = costRecoveryPrice == null ? null : d.unitPrice - costRecoveryPrice;
  const priceCushionPct = d.unitPrice ? priceCushion / d.unitPrice * 100 : 0;
  const fxScenarios = [-5, -2, 0, 2, 5].map(delta => ({
    delta, impact: d.fxExposure * delta / 100,
    np: d.netProfit + d.fxExposure * delta / 100
  }));
  const fxScenarioNp = d.netProfit + d.fxExposure * fxDelta / 100;
  const productionRows = d.lines.slice(0, 10);
  const supplierRowsForView = d.linkedSuppliers.filter(row => (row.name + ' ' + row.id + ' ' + row.supplyType).toLowerCase().includes(supplierSearch.toLowerCase())).slice(0, 12);

  const alerts = [];
  const lowMarginProducts = d.portfolio.filter(row => row.gpPct != null && row.gpPct < num(marginAlert));
  const lossProducts = d.portfolio.filter(row => row.profit < 0);
  if (lossProducts.length) alerts.push({ level: 'critical', title: 'Negative-profit product groups', detail: lossProducts.length + ' product groups have negative net profit.', action: 'Review selling price, total cost and order mix.', count: lossProducts.length });
  if (lowMarginProducts.length) alerts.push({ level: 'warning', title: 'Gross margin below target', detail: lowMarginProducts.length + ' groups are below the ' + num(marginAlert) + '% GP threshold.', action: 'Review direct material cost and selling price.', count: lowMarginProducts.length });
  if (d.rejectionPct > num(rejectionAlert)) alerts.push({ level: 'warning', title: 'Rejection rate above threshold', detail: pct(d.rejectionPct) + ' of ordered quantity is classified as rejection.', action: 'Review style complexity, line efficiency and quality controls.', count: fmt(d.rejectionQty) + ' units' });
  if (d.reworkShare > num(reworkAlert)) alerts.push({ level: 'warning', title: 'Rework cost share is elevated', detail: pct(d.reworkShare) + ' of revenue is represented by rework cost.', action: 'Investigate repeat defects and rework drivers.', count: money(d.reworkCost) });
  if (d.indirectShare > num(indirectAlert)) alerts.push({ level: 'warning', title: 'Indirect expense concentration', detail: pct(d.indirectShare) + ' of total expenses sits outside fabric, trims and CMT direct cost.', action: 'Review overhead, freight, penalties and other cost allocations.', count: money(d.otherCost) });
  if (topFiveShare > 60) alerts.push({ level: 'info', title: 'Product revenue concentration', detail: 'Top five selected product groups contribute ' + pct(topFiveShare) + ' of revenue.', action: 'Monitor dependency and diversify profitable product mix.', count: money(d.topFiveRevenue) });
  if (!alerts.length && sourceAvailable) alerts.push({ level: 'good', title: 'No threshold breaches detected', detail: 'Current data is within the configured review thresholds.', action: 'Continue monitoring as new orders are loaded.', count: 'Clear' });

  const tipStyle = { background: '#fff', border: '1px solid #dfe7f1', borderRadius: 10, color: '#334963', fontSize: 12, boxShadow: '0 8px 24px rgba(30,55,85,.10)' };
  const moneyTip = value => money(value);
  const resetScenario = () => {
    setPriceDelta(0); setFabricDelta(0); setTrimsDelta(0); setCmtDelta(0); setOtherDelta(0);
  };

  return <section className="module-page pe-page">
    {!sourceAvailable ? <div className="panel pe-empty-large"><Package size={24}/><div><h3>Product economics data unavailable</h3><p>Open this page after order details load, or broaden the period and country filters.</p></div></div> : <>
      <div className="panel pe-controls">
        <label><span>Product / category / fabric / style filter</span><select value={productKey} onChange={event => setProductKey(event.target.value)}><option value="All products">All products</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
        <label><span>Portfolio grouping</span><select value={groupBy} onChange={event => setGroupBy(event.target.value)}><option value="product">Product combination</option><option value="category">Product category</option><option value="fabric">Fabric</option><option value="style">Style</option><option value="season">Season</option></select></label>
        <label><span>Tax / GST assumption (%)</span><input type="number" min="0" max="100" step="0.1" value={taxRate} onChange={event => setTaxRate(event.target.value === '' ? '' : Math.max(0, Math.min(100, Number(event.target.value))))}/></label>
        <p>Tax is an assumption only; it is not a verified GST calculation.</p>
      </div>

      <div className="pe-kpi-grid">
        <Metric label="Revenue / sales value" value={money(d.revenue)} note="Selected orders" tone="orange" icon={Wallet}/>
        <Metric label="Total cost / expenses" value={money(d.totalCost)} note="Order-level total_cost_inr" tone="blue" icon={Boxes}/>
        <Metric label="Gross profit" value={money(d.grossProfit)} note={'GP margin ' + pct(d.grossMargin)} tone="green" icon={TrendingUp}/>
        <Metric label="Net profit" value={money(d.netProfit)} note={'NP margin ' + pct(d.netMargin)} tone="violet" icon={CircleDollarSign}/>
      </div>
      <div className="pe-unit-strip">
        <div><span>Before-tax selling price / unit</span><strong>{money(d.unitPrice)}</strong></div>
        <div><span>After assumed tax / unit</span><strong>{afterTaxPrice == null ? '—' : money(afterTaxPrice)}</strong><small>{taxRate === '' ? 'Enter an assumption above' : 'Tax amount / unit ' + money(unitTax)}</small></div>
        <div><span>Gross profit / unit</span><strong>{money(d.unitGp)}</strong></div>
        <div><span>Net profit / unit</span><strong>{money(d.unitNp)}</strong></div>
        <div><span>Selected quantity basis</span><strong>{compact(unitCount)}</strong><small>{d.shippedQty > 0 ? 'Shipped quantity' : 'Ordered quantity fallback'}</small></div>
      </div>

      <Section number="01 · PRODUCT PROFITABILITY" title="Profitability matrix & product ranking" subtitle="Compare product revenue and gross margin; median lines mark the four portfolio groups." icon={Target}>
        <div className="pe-two-col">
          <Panel title="Revenue vs gross margin matrix" subtitle="Bubble size = distinct orders · X = revenue · Y = GP margin" className="pe-chart-panel">
            {d.portfolio.length ? <div className="pe-chart pe-tall-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:16,right:18,bottom:18,left:6}}>
              <CartesianGrid stroke="#edf1f6" strokeDasharray="3 3"/>
              <XAxis type="number" dataKey="revenueCr" name="Revenue" unit=" Cr" tick={{fontSize:11,fill:'#718198'}}/>
              <YAxis type="number" dataKey="gpPct" name="GP margin" unit="%" tick={{fontSize:11,fill:'#718198'}}/>
              <ZAxis type="number" dataKey="orders" range={[55,340]} name="Orders"/>
              <Tooltip contentStyle={tipStyle} formatter={(value, name) => [name === 'Revenue' ? Number(value).toFixed(2) + ' Cr' : name === 'GP margin' ? pct(Number(value)) : fmt(value), name]}/>
              <ReferenceLine x={d.medianRevenue / 1e7} stroke="#9aaabd" strokeDasharray="5 4"/>
              <ReferenceLine y={d.medianMargin} stroke="#9aaabd" strokeDasharray="5 4"/>
              <Scatter data={d.portfolio.filter(row => row.gpPct != null)} fill="#E07842"/>
            </ScatterChart></ResponsiveContainer></div> : <EmptyState>No product groups are available for this selection.</EmptyState>}
            <div className="pe-quadrant-legend"><span><i className="star"/> Star product</span><span><i className="growth"/> Growth opportunity</span><span><i className="review"/> Pricing review</span><span><i className="turnaround"/> Turnaround review</span></div>
          </Panel>
          <Panel title="Portfolio ranking" subtitle={"Top 12 of " + fmt(d.portfolio.length) + " groups by revenue"}>
            <div className="pe-table-tools"><input value={portfolioSearch} onChange={event => setPortfolioSearch(event.target.value)} placeholder="Search product / category / quadrant..."/></div>
            <div className="pe-table-wrap pe-matrix-table-wrap"><table className="pe-table"><thead><tr><th>Product group</th><th>Revenue</th><th>GP%</th><th>NP%</th><th>Portfolio</th></tr></thead><tbody>
              {marginMatrixRows.slice(0, 12).map(row => <tr key={row.label}><td><b>{row.label}</b><small>{fmt(row.orders)} orders · {compact(row.units)} units</small></td><td>{money(row.revenue)}</td><td>{pct(row.gpPct)}</td><td>{pct(row.npPct)}</td><td><span className={'pe-pill ' + (row.quadrant === 'Star product' ? 'good' : row.quadrant === 'Pricing review' ? 'warn' : row.quadrant === 'Turnaround review' ? 'bad' : 'info')}>{row.quadrant}</span></td></tr>)}
              {!marginMatrixRows.length && <tr><td colSpan="5">No products match this search.</td></tr>}
            </tbody></table></div>
            <div className="pe-portfolio-summary">
              {['Star product','Growth opportunity','Pricing review','Turnaround review'].map((label, index) => <div key={label}><i className={'pe-dot q' + index}/><span>{label}</span><b>{d.portfolio.filter(row => row.quadrant === label).length}</b></div>)}
            </div>
          </Panel>
        </div>
      </Section>

      <Section number="02 · COST STRUCTURE" title="Cost waterfall & margin bridge" subtitle="Revenue less direct costs, then indirect expenses to reported net profit." icon={Layers}>
        <div className="pe-two-col">
          <Panel title="Revenue to profit waterfall" subtitle="INR · actual selected-order totals" className="pe-chart-panel">
            <div className="pe-chart pe-waterfall-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={waterfallData} margin={{top:16,right:16,left:12,bottom:18}}>
              <CartesianGrid stroke="#edf1f6" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="name" interval={0} angle={-14} textAnchor="end" height={62} tick={{fontSize:10,fill:'#718198'}}/>
              <YAxis tickFormatter={value => compact(value)} width={66} tick={{fontSize:10,fill:'#718198'}}/>
              <Tooltip contentStyle={tipStyle} formatter={(value, name, props) => [money(props.payload.amount), 'Contribution']}/>
              <Bar dataKey="range" radius={[4,4,0,0]} maxBarSize={46}>{waterfallData.map((item, index) => <Cell key={item.name} fill={item.color}/>)}</Bar>
            </BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Cost component breakdown" subtitle="Selected-order total and share of total expenses">
            <div className="pe-cost-lines">
              {[
                { label: 'Fabric cost', amount: d.fabricCost, color: COLORS[0] },
                { label: 'Trims cost', amount: d.trimsCost, color: COLORS[4] },
                { label: 'CMT cost', amount: d.cmtCost, color: COLORS[2] },
                { label: 'Other / indirect expense proxy', amount: d.otherCost, color: COLORS[3] }
              ].map(item => <div className="pe-cost-line" key={item.label}><div><span>{item.label}</span><b>{money(item.amount)}</b></div><div className="pe-cost-track"><i style={{width: (d.totalCost ? Math.min(100, Math.abs(item.amount / d.totalCost * 100)) : 0) + '%', background: item.color}}/></div><small>{d.totalCost ? pct(item.amount / d.totalCost * 100) : '—'} of total cost</small></div>)}
              <div className="pe-reconcile"><span>Direct manufacturing cost</span><b>{money(d.directCost)}</b></div>
              <div className="pe-reconcile"><span>Total expenses</span><b>{money(d.totalCost)}</b></div>
              <div className="pe-reconcile emphasis"><span>Actual net profit field</span><b>{money(d.netProfit)}</b></div>
            </div>
            <p className="pe-note">Other / indirect = total cost less fabric, trims and CMT. Net profit uses profit_inr.</p>
          </Panel>
        </div>
      </Section>

      <Section number="03 · WHAT-IF PRICING" title="Pricing & cost scenario simulator" subtitle="Model price and cost changes without changing actual records." icon={Calculator}>
        <div className="pe-simulator">
          <div className="pe-simulator-controls">
            <div className="pe-sim-head"><b>Scenario assumptions</b><button type="button" onClick={resetScenario}>Reset scenario</button></div>
            <SliderField label="Selling price" value={priceDelta} onChange={setPriceDelta} min={-20} max={30}/>
            <SliderField label="Fabric cost" value={fabricDelta} onChange={setFabricDelta}/>
            <SliderField label="Trims cost" value={trimsDelta} onChange={setTrimsDelta}/>
            <SliderField label="CMT cost" value={cmtDelta} onChange={setCmtDelta}/>
            <SliderField label="Other / indirect expense" value={otherDelta} onChange={setOtherDelta}/>
          </div>
          <div className="pe-sim-results">
            <div className="pe-sim-banner"><span>Scenario net profit</span><strong className={simulatedNp >= 0 ? 'positive' : 'negative'}>{money(simulatedNp)}</strong><small>{pct(simulatedNpPct)} net margin</small></div>
            <div className="pe-sim-result-grid">
              <div><span>Scenario revenue</span><b>{money(simulatedRevenue)}</b></div>
              <div><span>Scenario total cost</span><b>{money(simulatedCost)}</b></div>
              <div><span>Scenario gross profit</span><b>{money(simulatedGp)}</b></div>
              <div><span>Scenario GP margin</span><b>{pct(simulatedGpPct)}</b></div>
              <div><span>Net profit change</span><b className={simulatedNp - d.netProfit >= 0 ? 'positive' : 'negative'}>{money(simulatedNp - d.netProfit)}</b></div>
              <div><span>Compared with actual</span><b>{simulatedNp > d.netProfit ? 'Improved' : simulatedNp < d.netProfit ? 'Lower' : 'Unchanged'}</b></div>
            </div>
            <p className="pe-note">Baseline is anchored to actual profit_inr. Cost changes are applied to each expense component independently. No budget, price or source data is saved.</p>
          </div>
        </div>
      </Section>

      <Section number="04 · BREAK-EVEN & TARGET PRICE" title="Cost recovery & target pricing" subtitle="Calculate cost recovery and target-margin selling prices." icon={Target}>
        <div className="pe-target-grid">
          <Panel title="Target margins" subtitle="Change margin goals to see required selling prices">
            <div className="pe-target-inputs">
              <label><span>Target gross margin (%)</span><input type="number" min="0" max="95" step="0.5" value={targetGp} onChange={event => setTargetGp(event.target.value === '' ? 0 : Number(event.target.value))}/></label>
              <label><span>Target net margin (%)</span><input type="number" min="0" max="95" step="0.5" value={targetNp} onChange={event => setTargetNp(event.target.value === '' ? 0 : Number(event.target.value))}/></label>
            </div>
            <div className="pe-price-list">
              <div><span>Current selling price / unit</span><b>{money(d.unitPrice)}</b></div>
              <div><span>Full-cost recovery price / unit</span><b>{costRecoveryPrice == null ? '—' : money(costRecoveryPrice)}</b></div>
              <div><span>Price for {safeTargetGp}% GP margin</span><b>{targetGpPrice == null ? '—' : money(targetGpPrice)}</b></div>
              <div><span>Price for {safeTargetNp}% NP margin</span><b>{targetNpPrice == null ? '—' : money(targetNpPrice)}</b></div>
              <div className="highlight"><span>Current price cushion above full cost</span><b>{priceCushion == null ? '—' : money(priceCushion) + ' / unit'}</b><small>{priceCushion == null ? '' : pct(priceCushionPct) + ' of current selling price'}</small></div>
            </div>
          </Panel>
          <Panel title="Break-even calculation limits" subtitle="What the current order dataset can and cannot support">
            <div className="pe-breakeven-status"><div><b>Available</b><span>Full-cost recovery selling price per unit</span><strong>{costRecoveryPrice == null ? '—' : money(costRecoveryPrice)}</strong></div><div className="blocked"><b>Not available</b><span>Break-even quantity and margin of safety quantity</span><strong>Fixed cost split required</strong></div></div>
            <p className="pe-note">Break-even quantity needs a fixed / variable cost split, which is not available. Recovery price = total expenses ÷ quantity.</p>
          </Panel>
        </div>
      </Section>

      <Section number="05 · EXPORT & FOREX" title="Foreign exchange sensitivity" subtitle="FOB-linked INR exposure estimate; not a bank settlement position." icon={Globe2}>
        <div className="pe-forex-grid">
          <Panel title="FX exposure summary" subtitle="Derived from order-level FOB USD and exchange-rate fields">
            <div className="pe-forex-kpis">
              <div><span>FOB USD value proxy</span><b>{d.usdExposure ? '$' + compact(d.usdExposure) : '—'}</b></div>
              <div><span>INR value at order rates</span><b>{d.fxExposure ? money(d.fxExposure) : '—'}</b></div>
              <div><span>Weighted order FX rate</span><b>{d.weightedFx ? '₹' + d.weightedFx.toFixed(2) : '—'}</b></div>
              <div><span>Latest market reference</span><b>{d.latestMarket ? '₹' + num(d.latestMarket.usd_inr).toFixed(2) : '—'}</b><small>{d.latestMarket ? dateMonth(d.latestMarket.month) : 'No market reference row'}</small></div>
            </div>
            {d.latestMarket && d.previousMarket && num(d.previousMarket.usd_inr) ? <p className="pe-note">Latest reference movement: {pct((num(d.latestMarket.usd_inr) / num(d.previousMarket.usd_inr) - 1) * 100)} versus {dateMonth(d.previousMarket.month)}.</p> : null}
          </Panel>
          <Panel title="FX what-if" subtitle="Model the effect of an INR strengthening or weakening against USD">
            <SliderField label="Exchange-rate movement" value={fxDelta} onChange={setFxDelta} min={-10} max={10}/>
            <div className="pe-fx-impact"><span>Estimated net profit impact</span><b className={d.fxExposure * fxDelta >= 0 ? 'positive' : 'negative'}>{money(d.fxExposure * fxDelta / 100)}</b><small>Illustrative change using FOB-linked INR value proxy</small><strong>Scenario NP: {money(fxScenarioNp)}</strong></div>
            <div className="pe-fx-scenarios">{fxScenarios.map(row => <div key={row.delta}><span>{row.delta > 0 ? '+' : ''}{row.delta}%</span><b>{money(row.impact)}</b><small>NP {money(row.np)}</small></div>)}</div>
          </Panel>
        </div>
        {!d.usdExposure && <EmptyState>FOB USD, quantity and order exchange-rate fields are not available for the selected rows, so FX scenarios are disabled by the absence of exposure.</EmptyState>}
      </Section>

      <Section number="06 · PRODUCTION ECONOMICS" title="Production-linked product profitability" subtitle="Compare line efficiency, rejection and profit per SMV minute." icon={Factory}>
        <div className="pe-production-kpis">
          <Metric label="Actual efficiency" value={d.actualEfficiency == null ? '—' : efficiencyPct(d.actualEfficiency)} note={d.targetEfficiency == null ? 'No target efficiency rows' : 'Target ' + efficiencyPct(d.targetEfficiency)} tone="blue" icon={Gauge}/>
          <Metric label="GP per standard minute" value={d.smvMinutes ? money(d.grossProfit / d.smvMinutes) : '—'} note="Gross profit ÷ SMV × ordered quantity" tone="green" icon={Activity}/>
          <Metric label="Rejection cost proxy" value={money(d.rejectionCostProxy)} note="Rejected units × average total cost per ordered unit" tone="orange" icon={ShieldAlert}/>
          <Metric label="Rework expenditure" value={money(d.reworkCost)} note={'Rework share ' + pct(d.reworkShare) + ' of revenue'} tone="violet" icon={RefreshCw}/>
        </div>
        <Panel title="Line-level productivity & profitability" subtitle="Order-linked line metrics; GP uses direct fabric + trims + CMT cost">
          <div className="pe-table-wrap"><table className="pe-table"><thead><tr><th>Production line</th><th>Orders</th><th>Revenue</th><th>GP</th><th>Actual efficiency</th><th>GP / SMV min</th><th>Rejection %</th></tr></thead><tbody>
            {productionRows.map(row => <tr key={row.id}><td><b>{row.id}</b></td><td>{fmt(row.orders)}</td><td>{money(row.revenue)}</td><td>{money(row.gp)}</td><td>{row.actualEfficiency == null ? '—' : efficiencyPct(row.actualEfficiency)}</td><td>{row.gpPerSmv == null ? '—' : money(row.gpPerSmv)}</td><td>{pct(row.rejectionPct)}</td></tr>)}
            {!productionRows.length && <tr><td colSpan="7">No line-level production data is available.</td></tr>}
          </tbody></table></div>
          <p className="pe-note">GP per SMV minute uses standard minutes × ordered quantity. Rejection cost is an average-cost proxy, not a separately posted scrap valuation.</p>
        </Panel>
      </Section>

      <Section number="07 · SUPPLIER-LINKED COST" title="Supplier cost & quality intelligence" subtitle="Order cost, profit, delivery and quality for linked suppliers." icon={Truck}>
        <Panel title="Supplier performance ranking" subtitle="Only suppliers linked through supplier_id in selected orders are shown">
          <div className="pe-table-tools"><input value={supplierSearch} onChange={event => setSupplierSearch(event.target.value)} placeholder="Search supplier / type / ID..."/></div>
          <div className="pe-table-wrap"><table className="pe-table"><thead><tr><th>Supplier</th><th>Linked orders</th><th>Order cost</th><th>Net profit</th><th>Rework</th><th>Late rate</th><th>Quality</th><th>Master delay</th></tr></thead><tbody>
            {supplierRowsForView.map(row => <tr key={row.id}><td><b>{row.name}</b><small>{row.id} · {row.supplyType}</small></td><td>{fmt(row.orders)}</td><td>{money(row.totalCost)}</td><td>{money(row.profit)}</td><td>{money(row.rework)}</td><td>{row.latePct == null ? '—' : pct(row.latePct)}</td><td>{row.quality == null ? '—' : row.quality.toFixed(1) + ' / 5'}</td><td>{row.avgDelay == null ? '—' : row.avgDelay.toFixed(1) + ' days'}</td></tr>)}
            {!supplierRowsForView.length && <tr><td colSpan="8">No linked suppliers match this filter, or supplier master data is unavailable.</td></tr>}
          </tbody></table></div>
        </Panel>
        <p className="pe-note">Quality and average delay come from supplier master data. Linked order results show association, not proof of supplier causation.</p>
      </Section>

      <Section number="08 · RULE-BASED ALERTS" title="Smart product alerts & review priorities" subtitle="Rule-based alerts using editable thresholds." icon={ShieldAlert}>
        <Panel title="Alert thresholds" subtitle="Adjust the rules used to identify products and cost structures for review">
          <div className="pe-threshold-grid">
            <label><span>Minimum GP margin (%)</span><input type="number" min="0" max="100" step="0.5" value={marginAlert} onChange={event => setMarginAlert(event.target.value === '' ? 0 : Number(event.target.value))}/></label>
            <label><span>Rejection alert (%)</span><input type="number" min="0" max="100" step="0.5" value={rejectionAlert} onChange={event => setRejectionAlert(event.target.value === '' ? 0 : Number(event.target.value))}/></label>
            <label><span>Rework / revenue alert (%)</span><input type="number" min="0" max="100" step="0.5" value={reworkAlert} onChange={event => setReworkAlert(event.target.value === '' ? 0 : Number(event.target.value))}/></label>
            <label><span>Indirect cost / total cost (%)</span><input type="number" min="0" max="100" step="0.5" value={indirectAlert} onChange={event => setIndirectAlert(event.target.value === '' ? 0 : Number(event.target.value))}/></label>
          </div>
        </Panel>
        <div className="pe-alert-list">
          {alerts.map((alert, index) => <article className={'pe-alert ' + alert.level} key={alert.title}>
            <span className="pe-alert-icon">{alert.level === 'critical' ? <AlertTriangle size={17}/> : alert.level === 'good' ? <ShieldAlert size={17}/> : alert.level === 'info' ? <Lightbulb size={17}/> : <AlertTriangle size={17}/>}</span>
            <div><div className="pe-alert-title"><b>{alert.title}</b><span>{alert.level.toUpperCase()}</span></div><p>{alert.detail}</p><small>Next step: {alert.action}</small></div>
            <strong>{alert.count}</strong>
          </article>)}
        </div>
      </Section>

    </>}
  </section>;
}
