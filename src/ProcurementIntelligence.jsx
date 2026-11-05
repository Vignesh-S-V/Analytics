import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Factory, PackageSearch, ShieldAlert, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './procurement-intelligence.css';

const PALETTE=['#E07842','#243B53','#2A9D8F','#8A5A83','#E9C46A','#577590','#B85C38','#6D9773'];
const total=(rows,key)=>rows.reduce((s,r)=>s+Number(r?.[key]||0),0);
const money=v=>{const n=Number(v||0),a=Math.abs(n),f=x=>Number(x.toFixed(1)).toLocaleString('en-IN',{maximumFractionDigits:1});return '₹'+(a>=1e7?f(n/1e7)+' Cr':a>=1e5?f(n/1e5)+' Lakh':a>=1e3?f(n/1e3)+' Thousand':n.toLocaleString('en-IN',{maximumFractionDigits:1}))};
const percent=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
const monthKey=v=>String(v||'').slice(0,7);
const monthLabel=k=>{const [y,m]=k.split('-').map(Number);return new Date(Date.UTC(y,m-1,1)).toLocaleDateString('en-IN',{month:'short',year:'2-digit',timeZone:'UTC'})};
const Panel=({number,title,eyebrow,children})=><section className="proc-panel"><div className="proc-panel-head"><div><span>{number} · {eyebrow}</span><h3>{title}</h3></div></div>{children}</section>;
const Metric=({label,value,note,tone=0})=><article className="proc-metric" style={{'--proc-accent':PALETTE[tone%PALETTE.length]}}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
function DataTable({columns,rows,empty='No matching source rows.'}){return <div className="proc-table-wrap"><table className="proc-table"><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.length?rows.map((r,i)=><tr key={r.supplier_id||r.key||i}>{columns.map(c=><td key={c.key}>{c.render?c.render(r[c.key],r):(r[c.key]??'—')}</td>)}</tr>):<tr><td colSpan={columns.length} className="proc-empty">{empty}</td></tr>}</tbody></table></div>}
function ChartEmpty({children}){return <div className="proc-chart-empty">{children}</div>}
export default function ProcurementIntelligence({orders=[],supplierRows=[],marketRows=[]}){
 orders=Array.isArray(orders)?orders:[];supplierRows=Array.isArray(supplierRows)?supplierRows:[];marketRows=Array.isArray(marketRows)?marketRows:[];
 const model=useMemo(()=>{
  const linked=new Map();
  orders.forEach(r=>{if(!r.supplier_id)return;const v=linked.get(r.supplier_id)||{supplier_id:r.supplier_id,orderRows:0,orderIds:new Set(),revenue:0,orderCost:0,profit:0,orderedQty:0,rejectedQty:0,dated:0,onTime:0,late:0,delayTotal:0,delayCount:0,fabricCost:0,trimsCost:0};v.orderRows++;if(r.order_id)v.orderIds.add(r.order_id);v.revenue+=Number(r.revenue_inr||0);v.orderCost+=Number(r.total_cost_inr||0);v.profit+=Number(r.profit_inr||0);v.orderedQty+=Number(r.order_qty||0);v.rejectedQty+=Number(r.rejection_qty||0);if(r.ship_due_date&&r.actual_ship_date){v.dated++;if(String(r.actual_ship_date).slice(0,10)<=String(r.ship_due_date).slice(0,10))v.onTime++;else v.late++}if(r.delay_days!==null&&r.delay_days!==undefined&&r.delay_days!==''){v.delayTotal+=Number(r.delay_days);v.delayCount++}const qty=Number(r.shipped_qty||r.order_qty||0);v.fabricCost+=Number(r.fabric_cost_per_pc_inr||0)*qty;v.trimsCost+=Number(r.trims_cost_per_pc_inr||0)*qty;linked.set(r.supplier_id,v)});
  const suppliers=supplierRows.map(s=>{const x=linked.get(s.supplier_id)||{};return{...s,...x,orderCount:x.orderIds?.size||0,rejectionToOrderPct:x.orderedQty?x.rejectedQty/x.orderedQty*100:null,linkedOnTimePct:x.dated?x.onTime/x.dated*100:null,avgLinkedOrderDelay:x.delayCount?x.delayTotal/x.delayCount:null,revenueShare:0}}).sort((a,b)=>Number(b.revenue||0)-Number(a.revenue||0));
  const linkedRevenue=suppliers.reduce((a,s)=>a+Number(s.revenue||0),0),linkedCost=suppliers.reduce((a,s)=>a+Number(s.orderCost||0),0);
  suppliers.forEach(s=>s.revenueShare=linkedRevenue?Number(s.revenue||0)/linkedRevenue*100:0);
  const supplierDelay=suppliers.filter(s=>s.avg_delay_days!=null&&s.avg_delay_days!=='').map(s=>Number(s.avg_delay_days));
  const quality=suppliers.filter(s=>s.quality_rating!=null&&s.quality_rating!=='').map(s=>Number(s.quality_rating));
  const dates=orders.filter(r=>r.ship_due_date&&r.actual_ship_date),onTime=dates.filter(r=>String(r.actual_ship_date).slice(0,10)<=String(r.ship_due_date).slice(0,10)).length;
  const byType=new Map();suppliers.forEach(s=>{const k=s.supply_type||'Unclassified',v=byType.get(k)||{type:k,orderCost:0,revenue:0,suppliers:0};v.orderCost+=Number(s.orderCost||0);v.revenue+=Number(s.revenue||0);v.suppliers++;byType.set(k,v)});
  const monthly=new Map();orders.forEach(r=>{const k=monthKey(r.order_date);if(!/^\d{4}-\d{2}$/.test(k))return;const v=monthly.get(k)||{key:k,month:monthLabel(k),orders:0,late:0,delay:0,delayCount:0};v.orders++;if(r.ship_due_date&&r.actual_ship_date&&String(r.actual_ship_date).slice(0,10)>String(r.ship_due_date).slice(0,10))v.late++;if(r.delay_days!=null&&r.delay_days!==''){v.delay+=Number(r.delay_days);v.delayCount++}monthly.set(k,v)});
  const market=marketRows.filter(r=>r.cotton_yarn_30s_inr_per_kg!=null).slice().sort((a,b)=>String(a.month).localeCompare(String(b.month))).map(r=>({key:monthKey(r.month),month:monthLabel(monthKey(r.month)),yarn:Number(r.cotton_yarn_30s_inr_per_kg),fx:r.usd_inr==null?null:Number(r.usd_inr)}));
  const top5=suppliers.slice(0,5).reduce((a,s)=>a+s.revenueShare,0),hhi=suppliers.reduce((a,s)=>a+s.revenueShare*s.revenueShare,0);
  const types=[...byType.values()].sort((a,b)=>b.orderCost-a.orderCost);
  const supplierCount=suppliers.length,linkedCount=suppliers.filter(s=>s.orderCount>0).length;
  const avgMasterDelay=supplierDelay.length?supplierDelay.reduce((a,b)=>a+b,0)/supplierDelay.length:null;
  const avgQuality=quality.length?quality.reduce((a,b)=>a+b,0)/quality.length:null;
  const last=market.at(-1),prior=market.at(-2),yarnMom=last&&prior&&prior.yarn?((last.yarn-prior.yarn)/prior.yarn)*100:null;
  return{suppliers,linkedRevenue,linkedCost,top5,hhi,types,monthly:[...monthly.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(x=>({...x,avgDelay:x.delayCount?x.delay/x.delayCount:null,latePct:x.orders?x.late/x.orders*100:null})),market,supplierCount,linkedCount,avgMasterDelay,avgQuality,dates,onTime,overallOnTimePct:dates.length?onTime/dates.length*100:null,yarnMom,last,prior,orderCount:new Set(orders.filter(r=>r.supplier_id).map(r=>r.order_id).filter(Boolean)).size};
 },[orders,supplierRows,marketRows]);
 const costRows=model.suppliers.slice().sort((a,b)=>Number(b.orderCost||0)-Number(a.orderCost||0)).slice(0,10);
 const delayRows=model.suppliers.filter(s=>s.avg_delay_days!=null).slice().sort((a,b)=>Number(b.avg_delay_days)-Number(a.avg_delay_days));
 const qualityRows=model.suppliers.filter(s=>s.quality_rating!=null).slice().sort((a,b)=>Number(a.quality_rating)-Number(b.quality_rating));
 const dependencyRows=model.suppliers.filter(s=>Number(s.revenue||0)>0).slice().sort((a,b)=>b.revenueShare-a.revenueShare).slice(0,10);
 const actions=[];
 if(delayRows.length)actions.push({level:'Review',title:'Validate suppliers with the highest master delay values',detail:delayRows.slice(0,3).map(s=>s.supplier_name+' · '+Number(s.avg_delay_days).toFixed(1)+' days').join('  |  '),source:'dim_suppliers.avg_delay_days',caveat:'Compare with supplier SLA; the source does not define the delay period or SLA.'});
 if(qualityRows.length)actions.push({level:'Validate',title:'Confirm the supplier quality-rating scale',detail:qualityRows.slice(0,3).map(s=>s.supplier_name+' · '+Number(s.quality_rating).toFixed(1)).join('  |  '),source:'dim_suppliers.quality_rating',caveat:'The scale direction and inspection definition are not documented; no good/bad ranking is inferred.'});
 if(model.yarnMom!=null)actions.push({level:model.yarnMom>=0?'Price increase':'Price decrease',title:'Cotton yarn reference index moved '+(model.yarnMom>=0?'up':'down')+' month on month',detail:monthLabel(model.last.key)+' · '+percent(model.yarnMom)+' · '+money(model.last.yarn)+'/kg',source:'dim_market.cotton_yarn_30s_inr_per_kg',caveat:'Market reference only; it is not the company’s actual purchase price.'});
 return <div className="proc-workspace">
  <section className="proc-hero"><div className="proc-hero-icon"><PackageSearch size={23}/></div><div><span>SUPPLIER · MATERIAL · COST INTELLIGENCE</span><h2>Advanced Procurement Intelligence</h2><p>Supplier performance, linked order exposure, shipment outcomes and material-market signals — grounded in available workspace data.</p></div><div className="proc-source-status"><CheckCircle2 size={14}/> Supabase data connected</div></section>
  <div className="proc-metrics">
   <Metric label="Suppliers in master" value={model.supplierCount.toLocaleString('en-IN')} note={model.linkedCount+' linked to selected orders'} tone={0}/>
   <Metric label="Supplier-linked orders" value={model.orderCount.toLocaleString('en-IN')} note="Distinct orders in selected filters" tone={1}/>
   <Metric label="Supplier-linked revenue" value={money(model.linkedRevenue)} note="Revenue on supplier-linked orders" tone={2}/>
   <Metric label="Supplier-linked order cost" value={money(model.linkedCost)} note="Order cost exposure · not PO spend" tone={3}/>
   <Metric label="Avg. supplier master delay" value={model.avgMasterDelay==null?'—':model.avgMasterDelay.toFixed(1)+' days'} note="Average of populated master values" tone={4}/>
   <Metric label="Avg. supplier quality rating" value={model.avgQuality==null?'—':model.avgQuality.toFixed(2)} note="Scale and inspection definition need confirmation" tone={5}/>
  </div>
  <div className="proc-grid">
   <Panel number="01" eyebrow="SUPPLIER PERFORMANCE" title="Supplier profile and linked outcomes">
    <div className="proc-summary-strip"><div><small>Suppliers with linked orders</small><b>{model.linkedCount} / {model.supplierCount}</b></div><div><small>Customer shipment on-time · linked orders</small><b>{model.overallOnTimePct==null?'—':percent(model.overallOnTimePct)}</b></div><div><small>Supplier master delay coverage</small><b>{delayRows.length} / {model.supplierCount}</b></div></div>
    <DataTable columns={[{key:'supplier_name',label:'Supplier'},{key:'supply_type',label:'Supply type'},{key:'orderCount',label:'Linked orders',render:v=>Number(v||0).toLocaleString('en-IN')},{key:'revenue',label:'Linked revenue',render:v=>money(v)},{key:'avg_delay_days',label:'Master delay',render:v=>v==null?'—':Number(v).toFixed(1)+' days'},{key:'quality_rating',label:'Master quality rating',render:v=>v==null?'—':Number(v).toFixed(1)},{key:'linkedOnTimePct',label:'Linked-order on-time',render:v=>v==null?'—':percent(v)}]} rows={model.suppliers}/>
    <p className="proc-note">Master delay and quality are imported supplier attributes. Linked-order shipment performance is an association, not proof that a supplier caused the outcome. Rating direction and delay SLA are not documented.</p>
   </Panel>
   <Panel number="02" eyebrow="PURCHASE & SPEND ANALYTICS" title="Supplier-linked order cost exposure">
    {costRows.length?<div className="proc-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={costRows} layout="vertical" margin={{top:8,right:20,bottom:8,left:8}}><CartesianGrid strokeDasharray="3 4" horizontal={false}/><XAxis type="number" tickFormatter={money}/><YAxis type="category" dataKey="supplier_name" width={150} tick={{fontSize:10}} interval={0}/><Tooltip formatter={v=>money(v)}/><Bar dataKey="orderCost" name="Linked order cost" fill={PALETTE[0]} radius={[0,5,5,0]}>{costRows.map((r,i)=><Cell key={r.supplier_id} fill={PALETTE[i%PALETTE.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>:<ChartEmpty>Supplier-linked cost data unavailable.</ChartEmpty>}
    <div className="proc-inline-kpis"><div><small>Linked order cost</small><b>{money(model.linkedCost)}</b></div><div><small>Linked order revenue</small><b>{money(model.linkedRevenue)}</b></div></div>
    <p className="proc-note">This is total_cost_inr from orders associated with supplier_id. It is not purchase-order spend, supplier invoices or cash paid. PO and goods-receipt data are required for actual procurement spend and price variance.</p>
   </Panel>
   <Panel number="03" eyebrow="DELIVERY & LEAD TIME" title="Supplier delay fields and shipment outcomes">
    <div className="proc-two-charts">
     <div><h4>Supplier master delay values</h4><div className="proc-chart compact"><ResponsiveContainer width="100%" height="100%"><BarChart data={delayRows.slice(0,8)} layout="vertical" margin={{left:2,right:12}}><CartesianGrid strokeDasharray="3 4" horizontal={false}/><XAxis type="number" tickFormatter={v=>v+' d'}/><YAxis type="category" dataKey="supplier_name" width={125} tick={{fontSize:9}}/><Tooltip formatter={v=>Number(v).toFixed(1)+' days'}/><Bar dataKey="avg_delay_days" name="Master delay" fill={PALETTE[1]} radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></div>
     <div><h4>Customer shipment delay trend</h4><div className="proc-chart compact"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={model.monthly}><CartesianGrid strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" interval="preserveStartEnd"/><YAxis yAxisId="left"/><YAxis yAxisId="right" orientation="right" tickFormatter={v=>v+'%'}/><Tooltip/><Bar yAxisId="left" dataKey="late" name="Late customer shipments" fill={PALETTE[0]}/><Line yAxisId="right" dataKey="latePct" name="Late share" stroke={PALETTE[2]} strokeWidth={2.5} dot={false}/></ComposedChart></ResponsiveContainer></div></div>
    </div>
    <div className="proc-inline-kpis"><div><small>Orders with both ship dates</small><b>{model.dates.length.toLocaleString('en-IN')}</b></div><div><small>On-time customer shipments</small><b>{model.overallOnTimePct==null?'—':percent(model.overallOnTimePct)}</b></div></div>
    <p className="proc-note">The shipment trend is based on actual_ship_date vs ship_due_date for customer orders. It is not supplier purchase lead time or supplier OTIF. PO promised and goods-received dates are absent.</p>
   </Panel>
   <Panel number="04" eyebrow="QUALITY INTELLIGENCE" title="Supplier master ratings and linked-order rejection proxy">
    <div className="proc-two-charts">
     <div><h4>Supplier master quality rating</h4><div className="proc-chart compact"><ResponsiveContainer width="100%" height="100%"><BarChart data={qualityRows.slice(0,10)} layout="vertical" margin={{left:2,right:12}}><CartesianGrid strokeDasharray="3 4" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="supplier_name" width={145} tick={{fontSize:9}}/><Tooltip/><Bar dataKey="quality_rating" name="Master rating" fill={PALETTE[2]} radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></div>
     <div><h4>Rejected quantity ÷ ordered quantity</h4><div className="proc-chart compact"><ResponsiveContainer width="100%" height="100%"><BarChart data={model.suppliers.filter(s=>s.rejectionToOrderPct!=null).slice().sort((a,b)=>b.rejectionToOrderPct-a.rejectionToOrderPct).slice(0,10)} layout="vertical" margin={{left:2,right:12}}><CartesianGrid strokeDasharray="3 4" horizontal={false}/><XAxis type="number" tickFormatter={v=>v.toFixed(1)+'%'}/><YAxis type="category" dataKey="supplier_name" width={145} tick={{fontSize:9}}/><Tooltip formatter={v=>percent(Number(v))}/><Bar dataKey="rejectionToOrderPct" name="Rejected / ordered qty" fill={PALETTE[3]} radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></div></div>
    </div>
    <p className="proc-note">The rejection ratio uses order_qty as its denominator because produced/inspected quantity is not available. Supplier grouping shows association only; it is not a supplier defect rate. Quality-rating scale and inspection method require confirmation.</p>
   </Panel>
   <Panel number="05" eyebrow="RAW MATERIAL PRICE INTELLIGENCE" title="Cotton yarn reference index">
    {model.market.length?<><div className="proc-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={model.market} margin={{top:12,right:18,bottom:8,left:8}}><CartesianGrid strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" interval="preserveStartEnd"/><YAxis tickFormatter={v=>'₹'+Number(v).toLocaleString('en-IN')}/><Tooltip formatter={v=>'₹'+Number(v).toFixed(2)+'/kg'}/><Line dataKey="yarn" name="Cotton yarn 30s reference" stroke={PALETTE[0]} strokeWidth={3} dot={{r:3,fill:PALETTE[1],stroke:'#fff',strokeWidth:1.5}} activeDot={{r:5,fill:PALETTE[1],stroke:'#fff',strokeWidth:1.5}}/></LineChart></ResponsiveContainer></div><div className="proc-inline-kpis"><div><small>Latest reference</small><b>{money(model.last.yarn)}/kg</b></div><div><small>Latest month-on-month movement</small><b className={model.yarnMom>=0?'proc-up':'proc-down'}>{model.yarnMom==null?'—':percent(model.yarnMom)}</b></div><div><small>Reference coverage</small><b>{model.market.length} months</b></div></div></>:<ChartEmpty>No yarn reference rows available for the selected period.</ChartEmpty>}
    <p className="proc-note">Source: dim_market.cotton_yarn_30s_inr_per_kg. This is a market reference series, not actual supplier invoice or purchase price. Historical coverage is limited to imported months.</p>
   </Panel>
   <Panel number="06" eyebrow="SUPPLIER RISK & DEPENDENCY" title="Supplier concentration and revenue exposure">
    <div className="proc-risk-kpis"><div><small>Top 5 supplier revenue share</small><b>{percent(model.top5)}</b></div><div><small>Supplier concentration index (HHI)</small><b>{model.hhi.toFixed(0)}</b></div><div><small>Suppliers with linked revenue</small><b>{model.suppliers.filter(s=>s.revenue>0).length}</b></div></div>
    <div className="proc-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dependencyRows} dataKey="revenue" nameKey="supplier_name" innerRadius={65} outerRadius={112} paddingAngle={2}>{dependencyRows.map((s,i)=><Cell key={s.supplier_id} fill={PALETTE[i%PALETTE.length]} stroke="#fff" strokeWidth={2}/>)}</Pie><Tooltip formatter={v=>money(v)}/><Legend verticalAlign="bottom" height={35}/></PieChart></ResponsiveContainer></div>
    <DataTable columns={[{key:'supplier_name',label:'Supplier'},{key:'supply_type',label:'Supply type'},{key:'revenue',label:'Linked revenue',render:v=>money(v)},{key:'revenueShare',label:'Share',render:v=>percent(v)}]} rows={dependencyRows}/>
    <p className="proc-note">Concentration is based on revenue from orders linked to supplier_id. It is a dependency indicator, not proof of exclusive sourcing or supplier failure probability.</p>
   </Panel>
   <Panel number="07" eyebrow="MATERIAL PLANNING INTELLIGENCE" title="Inventory coverage and replenishment readiness">
    <div className="proc-blocked"><div className="proc-blocked-icon"><AlertTriangle size={20}/></div><div><strong>Not available from current source data</strong><p>No dated stock snapshots, SKU/lot balances, consumption history, reorder levels or purchase-order open quantities were found. Inventory days-on-hand, stockout risk and reorder quantities are therefore not calculated.</p></div></div>
    <div className="proc-required-grid">{['Daily / month-end stock by material SKU and lot','Material consumption by date and production order','Open PO quantity and promised receipt date','Reorder level, safety stock and supplier-material mapping'].map(x=><div key={x}><PackageSearch size={15}/>{x}</div>)}</div>
   </Panel>
   <Panel number="08" eyebrow="PROCUREMENT ACTION CENTRE" title="Evidence-led reviews">
    {actions.length?<div className="proc-actions">{actions.map((a,i)=><article key={i}><div><span>{a.level}</span><b>{a.title}</b></div><strong>{a.detail}</strong><small>Evidence: {a.source}</small><p>{a.caveat}</p></article>)}</div>:<ChartEmpty>No actionable supplier or material reference values are available for the selected filters.</ChartEmpty>}
    <p className="proc-note">These are review prompts based on imported fields, not automated supplier-risk predictions. No SLA, quality-rating direction or purchase-price threshold has been assumed.</p>
   </Panel>
  </div>
 </div>;
}
