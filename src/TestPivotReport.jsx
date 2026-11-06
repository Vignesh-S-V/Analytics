import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, GripVertical, Layers3, Plus, RotateCcw, Table2, X } from 'lucide-react';
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
const percent = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + value.toFixed(2) + '%' : '—';
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

const growthBetween = (current, previous) => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

function displayColumnValue(node, column, growthNumber) {
  const current = Number(node.totals[column.currentKey] || 0);
  const previous = Number(node.totals[column.previousKey] || 0);
  if (column.kind === 'current') return money(current);
  if (column.kind === 'previous') return money(previous);
  if (column.kind === 'yoy') {
    const rate = growthBetween(current, previous);
    return rate === null ? (current > 0 ? 'New' : '—') : percent(rate);
  }
  if (column.kind === 'projected') return money(current * (1 + growthNumber / 100));
  return '—';
}

function PivotRows({ nodes, columns, expanded, toggle, growthNumber, depth = 0 }) {
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
              <strong>{node.label}</strong>
            </span>
          </td>
          {columns.map(column => (
            <td
              key={column.id}
              className={
                column.kind === 'projected' ? 'tp-projected-cell' :
                column.kind === 'yoy' ? 'tp-yoy-cell' : ''
              }
            >{displayColumnValue(node, column, growthNumber)}</td>
          ))}
        </tr>
        {hasChildren && isOpen && (
          <PivotRows
            nodes={node.children}
            columns={columns}
            expanded={expanded}
            toggle={toggle}
            growthNumber={growthNumber}
            depth={depth + 1}
          />
        )}
      </React.Fragment>
    );
  });
}

export default function TestPivotReport({ orders = [], live = false, loading = false }) {
  const availableYears = useMemo(
    () => [...new Set(orders.map(row => dateParts(row.order_date)?.year).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [orders]
  );
  const [year, setYear] = useState('latest');
  const [month, setMonth] = useState('all');
  const [growth, setGrowth] = useState('20');
  const [rowFields, setRowFields] = useState(['product_category', 'country']);
  const [expanded, setExpanded] = useState(() => new Set());
  const [dragField, setDragField] = useState('');

  useEffect(() => {
    if (year === 'latest' || availableYears.includes(year)) return;
    setYear('latest');
  }, [availableYears, year]);

  const selectedYear = year === 'latest' ? (availableYears[0] || '') : year;
  const comparisonYear = selectedYear ? String(Number(selectedYear) - 1) : '';
  const filteredRows = useMemo(() => orders.filter(row => {
    const date = dateParts(row.order_date);
    if (!date) return false;
    if (date.year !== selectedYear && date.year !== comparisonYear) return false;
    if (month !== 'all' && date.month !== month) return false;
    return true;
  }), [orders, selectedYear, comparisonYear, month]);

  const monthNumbers = useMemo(
    () => [...new Set(filteredRows.map(row => dateParts(row.order_date)?.month).filter(Boolean))].sort(),
    [filteredRows]
  );
  const monthKeys = useMemo(
    () => [...new Set(filteredRows.map(row => dateParts(row.order_date)?.key).filter(Boolean))],
    [filteredRows]
  );

  const growthNumber = growth.trim() === '' ? 0 : Number(growth);
  const validGrowth = Number.isFinite(growthNumber) && growthNumber >= -100 && growthNumber <= 1000;
  const projectionEnabled = month !== 'all' && validGrowth && Boolean(selectedYear);
  const columns = useMemo(() => monthNumbers.flatMap(monthNumber => {
    const currentKey = selectedYear + '-' + monthNumber;
    const previousKey = comparisonYear + '-' + monthNumber;
    const monthLabelName = monthName(monthNumber);
    const result = [
      { id: currentKey + '-current', kind: 'current', currentKey, previousKey, label: monthLabelName + ' ' + selectedYear + ' · Actual' },
      { id: previousKey + '-previous', kind: 'previous', currentKey, previousKey, label: monthLabelName + ' ' + comparisonYear + ' · Actual' },
      { id: currentKey + '-yoy', kind: 'yoy', currentKey, previousKey, label: monthLabelName + ' · YoY %' }
    ];
    if (projectionEnabled && monthNumber === month) {
      result.push({
        id: currentKey + '-projected',
        kind: 'projected',
        currentKey,
        previousKey,
        label: monthLabelName + ' ' + selectedYear + ' · +' + growthNumber + '% Scenario'
      });
    }
    return result;
  }), [monthNumbers, selectedYear, comparisonYear, projectionEnabled, month, growthNumber]);

  const nodes = useMemo(
    () => buildNodes(filteredRows, rowFields, 0, monthKeys),
    [filteredRows, rowFields, monthKeys]
  );
  const fieldOptions = DIMENSIONS.filter(field => !rowFields.includes(field.key));
  const actualRevenue = filteredRows.reduce((sum, row) => {
    return dateParts(row.order_date)?.year === selectedYear ? sum + Number(row.revenue_inr || 0) : sum;
  }, 0);
  const previousRevenue = filteredRows.reduce((sum, row) => {
    return dateParts(row.order_date)?.year === comparisonYear ? sum + Number(row.revenue_inr || 0) : sum;
  }, 0);
  const yoyGrowth = growthBetween(actualRevenue, previousRevenue);
  const projectedBase = month === 'all' ? 0 : actualRevenue;
  const projectedRevenue = projectionEnabled ? projectedBase * (1 + growthNumber / 100) : null;
  const incrementalRevenue = projectedRevenue === null ? null : projectedRevenue - projectedBase;
  const latestYear = availableYears[0] || '';

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
    setRowFields(['product_category', 'country']);
    setExpanded(new Set());
  };
  const handleDrop = event => {
    event.preventDefault();
    const fieldKey = event.dataTransfer.getData('text/plain') || dragField;
    addField(fieldKey);
    setDragField('');
  };

  const totalsByKey = useMemo(() => {
    const totals = {};
    monthKeys.forEach(key => { totals[key] = 0; });
    filteredRows.forEach(row => {
      const date = dateParts(row.order_date);
      if (date && Object.prototype.hasOwnProperty.call(totals, date.key)) {
        totals[date.key] += Number(row.revenue_inr || 0);
      }
    });
    return totals;
  }, [filteredRows, monthKeys]);

  const totalNode = { totals: totalsByKey };

  return (
    <section className="tp-page">
      <div className="tp-intro">
        <div>
          <span className="tp-kicker">PIVOT BUILDER · TEST WORKSPACE</span>
          <h2>Category × Monthly Revenue</h2>
          <p>Compare each month with the same month in the previous year. Expand a category to see the country-level revenue split and the year-on-year change.</p>
        </div>
        <button type="button" className="tp-reset" onClick={reset}><RotateCcw size={14} /> Reset layout</button>
      </div>

      <div className="tp-filter-card">
        <label><span>Year</span>
          <select value={year} onChange={event => setYear(event.target.value)}>
            <option value="latest">{latestYear ? 'Latest year · ' + latestYear : 'Latest available year'}</option>
            {availableYears.filter(value => value !== latestYear).map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label><span>Month</span>
          <select value={month} onChange={event => setMonth(event.target.value)}>
            <option value="all">All months</option>
            {MONTHS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label><span>Growth assumption (%)</span>
          <input type="number" min="-100" max="1000" step="0.1" value={growth} onChange={event => setGrowth(event.target.value)} placeholder="e.g. 20" />
        </label>
        <div className="tp-filter-hint">YoY % is calculated from actual selected-year revenue versus the same month in the previous year. Growth assumption is a separate what-if calculation; it does not alter actuals.</div>
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
              <span className="tp-row-field tp-fixed-field">Month × Year comparison</span>
              <span className="tp-zone-note">Current year · Previous year · YoY %</span>
            </div>
            <div className="tp-drop-zone tp-value-zone">
              <span className="tp-zone-label">VALUES</span>
              <span className="tp-row-field tp-fixed-field">Σ Revenue</span>
              <span className="tp-zone-note">SUM(revenue_inr)</span>
            </div>
          </div>

          <div className="tp-report-heading">
            <div><span className="tp-kicker">LIVE PIVOT REPORT</span><h3>Revenue by {rowFields.map(key => DIMENSIONS.find(field => field.key === key)?.label || key).join(' → ')}</h3></div>
            <span className="tp-row-count">{filteredRows.length.toLocaleString('en-IN')} rows · {monthNumbers.length} month groups · {selectedYear || '—'} vs {comparisonYear || '—'}</span>
          </div>

          {latestYear && (
            <div className="tp-data-note">
              Source data currently runs through {latestYear}. The next year ({Number(latestYear) + 1}) is not present in the source yet, so that year's actual revenue cannot be shown until those rows are loaded.
            </div>
          )}

          <div className="tp-summary-strip">
            <div><span>{selectedYear || 'Selected year'} actual revenue</span><strong>{money(actualRevenue)}</strong></div>
            <div><span>{comparisonYear || 'Previous year'} actual revenue</span><strong>{money(previousRevenue)}</strong></div>
            <div><span>Actual YoY growth</span><strong className={yoyGrowth > 0 ? 'tp-positive' : ''}>{yoyGrowth === null ? '—' : percent(yoyGrowth)}</strong></div>
            <div><span>{month === 'all' ? 'Scenario revenue' : monthName(month) + ' scenario'}</span><strong>{projectedRevenue === null ? 'Select a month' : money(projectedRevenue)}</strong></div>
            <div><span>Scenario uplift · {validGrowth ? growthNumber : '—'}%</span><strong className={incrementalRevenue > 0 ? 'tp-positive' : ''}>{incrementalRevenue === null ? 'Select a month' : money(incrementalRevenue)}</strong></div>
          </div>

          {!live && (loading || !orders.length) ? (
            <div className="tp-empty-state"><Table2 size={28} /><strong>{loading ? 'Loading report data…' : 'Order data is not available yet'}</strong><p>The report uses live order rows from the connected workspace.</p></div>
          ) : !filteredRows.length ? (
            <div className="tp-empty-state"><Table2 size={28} /><strong>No rows match these filters</strong><p>Choose another year or month, or check whether order dates are available in the source.</p></div>
          ) : (
            <div className="tp-table-scroll">
              <table className="tp-table">
                <thead>
                  <tr>
                    <th className="tp-sticky-label">{rowFields.map(key => DIMENSIONS.find(field => field.key === key)?.label || key).join(' / ')}</th>
                    {columns.map(column => (
                      <th
                        key={column.id}
                        className={
                          column.kind === 'projected' ? 'tp-projected-head' :
                          column.kind === 'yoy' ? 'tp-yoy-head' : ''
                        }
                      >{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <PivotRows nodes={nodes} columns={columns} expanded={expanded} toggle={toggle} growthNumber={growthNumber} />
                  <tr className="tp-grand-total">
                    <td>Grand total</td>
                    {columns.map(column => <td key={column.id}>{displayColumnValue(totalNode, column, growthNumber)}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <div className="tp-report-foot"><span>+ Expand a category to drill into the next row field.</span><span>YoY % = (Current year − Previous year) ÷ Previous year × 100.</span></div>
        </div>
      </div>
    </section>
  );
}
