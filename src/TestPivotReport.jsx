import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Layers3, Plus, RotateCcw, Table2, X } from 'lucide-react';
import './test-pivot.css';

const DIMENSIONS = [
  { key: 'product_category', label: 'Product Category' },
  { key: 'fabric', label: 'Fabric' },
  { key: 'style_id', label: 'Style ID' },
  { key: 'buyer_name', label: 'Buyer' },
  { key: 'buyer_tier', label: 'Buyer Tier' },
  { key: 'country', label: 'Country' },
  { key: 'season', label: 'Season' },
  { key: 'supplier_id', label: 'Supplier ID' },
  { key: 'line_id', label: 'Production Line' },
  { key: 'order_id', label: 'Order ID' }
];

const MONTHS = [
  ['01', 'January'], ['02', 'February'], ['03', 'March'], ['04', 'April'],
  ['05', 'May'], ['06', 'June'], ['07', 'July'], ['08', 'August'],
  ['09', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December']
];

const textValue = value => String(value ?? '').trim() || 'Unspecified';
const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateParts = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2], key: match[1] + '-' + match[2] } : null;
};
const monthLabel = key => {
  const [year, month] = key.split('-');
  const label = MONTHS.find(item => item[0] === month)?.[1] || month;
  return label + ' ' + year;
};
const monthName = month => MONTHS.find(item => item[0] === month)?.[1] || month;

function buildNodes(rows, fields, level, monthKeys, prefix = '') {
  const field = fields[level];
  if (!field) return [];
  const groups = new Map();
  rows.forEach(row => {
    const label = textValue(row[field]);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  });
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
    .map(([label, items]) => {
      const totals = {};
      monthKeys.forEach(key => { totals[key] = 0; });
      items.forEach(row => {
        const date = dateParts(row.order_date);
        if (date && Object.prototype.hasOwnProperty.call(totals, date.key)) {
          totals[date.key] += Number(row.revenue_inr || 0);
        }
      });
      const id = prefix + level + ':' + label;
      return {
        id,
        label,
        field,
        totals,
        children: level < fields.length - 1 ? buildNodes(items, fields, level + 1, monthKeys, id + '/') : null
      };
    });
}

function PivotRows({ nodes, columns, fields, expanded, toggle, depth = 0 }) {
  return nodes.map(node => {
    const hasChildren = Boolean(node.children?.length);
    const isOpen = expanded.has(node.id);
    return (
      <React.Fragment key={node.id}>
        <tr className={depth === 0 ? 'tp-category-row' : 'tp-detail-row'}>
          <td className="tp-label-cell">
            <span className="tp-hierarchy-label" style={{ paddingLeft: 10 + depth * 22 }}>
              {hasChildren ? (
                <button type="button" className="tp-expand" onClick={() => toggle(node.id)} aria-label={(isOpen ? 'Collapse ' : 'Expand ') + node.label}>
                  {isOpen ? <ChevronDown size={15} /> : <Plus size={15} />}
                </button>
              ) : <span className="tp-expand-spacer" />}
              <span className="tp-node-field">{fields[depth]?.label || node.field}</span>
              <strong>{node.label}</strong>
            </span>
          </td>
          {columns.map(column => {
            const actual = node.totals[column.key] || 0;
            const value = column.kind === 'projected' ? actual * (1 + column.growth / 100) : actual;
            return <td key={column.id} className={column.kind === 'projected' ? 'tp-projected-cell' : ''}>{money(value)}</td>;
          })}
        </tr>
        {hasChildren && isOpen && <PivotRows nodes={node.children} columns={columns} fields={fields} expanded={expanded} toggle={toggle} depth={depth + 1} />}
      </React.Fragment>
    );
  });
}

export default function TestPivotReport({ orders = [], live = false, loading = false }) {
  const availableYears = useMemo(() => [...new Set(orders.map(row => dateParts(row.order_date)?.year).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [orders]);
  const [year, setYear] = useState('latest');
  const [month, setMonth] = useState('all');
  const [growth, setGrowth] = useState('20');
  const [rowFields, setRowFields] = useState(['product_category', 'fabric']);
  const [expanded, setExpanded] = useState(() => new Set());
  const [dragField, setDragField] = useState('');

  useEffect(() => {
    if (year === 'latest' && !availableYears.length) return;
    if (year !== 'latest' && year !== 'all' && !availableYears.includes(year)) setYear('latest');
  }, [availableYears, year]);

  const selectedYear = year === 'latest' ? (availableYears[0] || 'all') : year;
  const filteredRows = useMemo(() => orders.filter(row => {
    const date = dateParts(row.order_date);
    if (!date) return false;
    if (selectedYear !== 'all' && date.year !== selectedYear) return false;
    if (month !== 'all' && date.month !== month) return false;
    return true;
  }), [orders, selectedYear, month]);

  const monthKeys = useMemo(() => [...new Set(filteredRows.map(row => dateParts(row.order_date)?.key).filter(Boolean))].sort(), [filteredRows]);
  const growthNumber = growth.trim() === '' ? 0 : Number(growth);
  const validGrowth = Number.isFinite(growthNumber) && growthNumber >= -100 && growthNumber <= 1000;
  const projectionEnabled = month !== 'all' && validGrowth;
  const columns = useMemo(() => monthKeys.flatMap(key => {
    const monthNumber = key.slice(5, 7);
    const result = [{ id: key + '-actual', key, kind: 'actual' }];
    if (projectionEnabled && monthNumber === month) result.push({ id: key + '-projected', key, kind: 'projected', growth: growthNumber });
    return result;
  }), [monthKeys, projectionEnabled, month, growthNumber]);

  const nodes = useMemo(() => buildNodes(filteredRows, rowFields, 0, monthKeys), [filteredRows, rowFields, monthKeys]);
  const fieldOptions = DIMENSIONS.filter(field => !rowFields.includes(field.key));
  const actualRevenue = filteredRows.reduce((sum, row) => sum + Number(row.revenue_inr || 0), 0);
  const projectedBase = month === 'all' ? 0 : filteredRows.reduce((sum, row) => {
    return dateParts(row.order_date)?.month === month ? sum + Number(row.revenue_inr || 0) : sum;
  }, 0);
  const projectedRevenue = projectionEnabled ? projectedBase * (1 + growthNumber / 100) : null;
  const incrementalRevenue = projectedRevenue === null ? null : projectedRevenue - projectedBase;

  const addField = fieldKey => {
    if (!DIMENSIONS.some(field => field.key === fieldKey) || rowFields.includes(fieldKey)) return;
    setRowFields(current => [...current, fieldKey]);
  };
  const removeField = fieldKey => {
    if (rowFields.length <= 1) return;
    setRowFields(current => current.filter(key => key !== fieldKey));
    setExpanded(new Set());
  };
  const toggle = id => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const reset = () => {
    setYear('latest');
    setMonth('all');
    setGrowth('20');
    setRowFields(['product_category', 'fabric']);
    setExpanded(new Set());
  };
  const handleDrop = event => {
    event.preventDefault();
    const fieldKey = event.dataTransfer.getData('text/plain') || dragField;
    addField(fieldKey);
    setDragField('');
  };

  return (
    <section className="tp-page">
      <div className="tp-intro">
        <div>
          <span className="tp-kicker">PIVOT BUILDER · TEST WORKSPACE</span>
          <h2>Category × Monthly Revenue</h2>
          <p>Drag text fields into the row hierarchy. Expand a category to see its underlying detail and the revenue impact of your growth assumption.</p>
        </div>
        <button type="button" className="tp-reset" onClick={reset}><RotateCcw size={14} /> Reset layout</button>
      </div>

      <div className="tp-filter-card">
        <label><span>Year</span>
          <select value={year} onChange={event => setYear(event.target.value)}>
            <option value="latest">{availableYears[0] ? 'Latest year · ' + availableYears[0] : 'Latest available year'}</option>
            <option value="all">All years</option>
            {availableYears.filter(value => value !== availableYears[0]).map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label><span>Month</span>
          <select value={month} onChange={event => setMonth(event.target.value)}>
            <option value="all">All months</option>
            {MONTHS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label><span>Growth (%)</span>
          <input type="number" min="-100" max="1000" step="0.1" value={growth} onChange={event => setGrowth(event.target.value)} placeholder="e.g. 20" />
        </label>
        <div className="tp-filter-hint">Growth is applied only to the selected month. Example: ₹15,000 + 20% = ₹18,000. Select a specific month to show its projected column next to actual revenue.</div>
      </div>

      <div className="tp-builder-grid">
        <aside className="tp-fields-panel">
          <div className="tp-fields-heading"><div><span className="tp-kicker">AVAILABLE TEXT FIELDS</span><h3>Drag fields to Rows</h3></div><Layers3 size={18} /></div>
          <div className="tp-field-list">
            {fieldOptions.map(field => (
              <button
                key={field.key}
                type="button"
                className="tp-field-chip"
                draggable
                onDragStart={event => { event.dataTransfer.setData('text/plain', field.key); event.dataTransfer.effectAllowed = 'copy'; setDragField(field.key); }}
                onDragEnd={() => setDragField('')}
                onClick={() => addField(field.key)}
                title={'Drag or click to add ' + field.label}
              ><GripVertical size={14} /><span>{field.label}</span><Plus size={13} /></button>
            ))}
            {!fieldOptions.length && <p className="tp-empty-fields">All available text fields are in the row hierarchy.</p>}
          </div>
          <div className="tp-field-note">Click a field or drag it into the Rows area. Fields are nested in the order shown.</div>
        </aside>

        <div className="tp-report-panel">
          <div className="tp-drop-zones">
            <div className="tp-drop-zone" onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
              <span className="tp-zone-label">ROWS</span>
              {rowFields.map((key, index) => {
                const field = DIMENSIONS.find(item => item.key === key);
                return <span className="tp-row-field" key={key}><b>{index + 1}</b>{field?.label || key}{rowFields.length > 1 && <button type="button" onClick={() => removeField(key)} aria-label={'Remove ' + field?.label}><X size={12} /></button>}</span>;
              })}
              <span className="tp-drop-placeholder">Drop field here</span>
            </div>
            <div className="tp-drop-zone tp-column-zone">
              <span className="tp-zone-label">COLUMNS</span>
              <span className="tp-row-field tp-fixed-field">Month <span>↔</span></span>
              <span className="tp-zone-note">Monthly revenue</span>
            </div>
            <div className="tp-drop-zone tp-value-zone">
              <span className="tp-zone-label">VALUES</span>
              <span className="tp-row-field tp-fixed-field">Σ Revenue</span>
              <span className="tp-zone-note">SUM(revenue_inr)</span>
            </div>
          </div>

          <div className="tp-report-heading">
            <div><span className="tp-kicker">LIVE PIVOT REPORT</span><h3>Revenue by {rowFields.map(key => DIMENSIONS.find(field => field.key === key)?.label || key).join(' → ')}</h3></div>
            <span className="tp-row-count">{filteredRows.length.toLocaleString('en-IN')} rows · {monthKeys.length} month columns</span>
          </div>

          <div className="tp-summary-strip">
            <div><span>Actual revenue</span><strong>{money(actualRevenue)}</strong></div>
            <div><span>{month === 'all' ? 'Projected revenue' : monthName(month) + ' projected'}</span><strong>{projectedRevenue === null ? 'Select month' : money(projectedRevenue)}</strong></div>
            <div><span>Growth impact</span><strong className={incrementalRevenue > 0 ? 'tp-positive' : ''}>{incrementalRevenue === null ? '—' : money(incrementalRevenue)}</strong></div>
          </div>

          {!live && (loading || !orders.length) ? (
            <div className="tp-empty-state"><Table2 size={28} /><strong>{loading ? 'Loading report data…' : 'Order data is not available yet'}</strong><p>The report uses live order rows from the connected workspace.</p></div>
          ) : !filteredRows.length ? (
            <div className="tp-empty-state"><Table2 size={28} /><strong>No rows match these filters</strong><p>Choose another year or month, or check whether order dates are available in the source.</p></div>
          ) : (
            <div className="tp-table-scroll">
              <table className="tp-table">
                <thead><tr><th className="tp-sticky-label">{rowFields.map(key => DIMENSIONS.find(field => field.key === key)?.label || key).join(' / ')}</th>{columns.map(column => <th key={column.id} className={column.kind === 'projected' ? 'tp-projected-head' : ''}>{monthLabel(column.key)}{column.kind === 'projected' ? ' · +' + growthNumber + '%' : ' · Actual'}</th>)}</tr></thead>
                <tbody>
                  <PivotRows nodes={nodes} columns={columns} fields={rowFields.map(key => DIMENSIONS.find(field => field.key === key) || { key, label: key })} expanded={expanded} toggle={toggle} />
                  <tr className="tp-grand-total"><td>Grand total</td>{columns.map(column => {
                    const actual = filteredRows.reduce((sum, row) => {
                      return dateParts(row.order_date)?.key === column.key ? sum + Number(row.revenue_inr || 0) : sum;
                    }, 0);
                    return <td key={column.id}>{money(column.kind === 'projected' ? actual * (1 + growthNumber / 100) : actual)}</td>;
                  })}</tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="tp-report-foot"><span>+ Expand a category to drill into the next row field.</span><span>Projection = actual revenue × (1 + growth %).</span></div>
        </div>
      </div>
    </section>
  );
}
