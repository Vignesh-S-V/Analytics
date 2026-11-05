import React, { useMemo } from 'react';
import { Activity, AlertTriangle, Factory, Gauge, PackageCheck, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './production-intelligence.css';
const COLORS=['#E07842','#243B53','#2A9D8F','#8A5A83','#E9C46A','#577590'];
const num=v=>Number.isFinite(Number(v))?Number(v):0, sum=(a,k)=>a.reduce((s,r)=>s+num(r[k]),0);
const fmt=v=>Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:1});
const pct=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
const money=v=>{const x=num(v),a=Math.abs(x),f=n=>Number(n.toFixed(1)).toLocaleString('en-IN');return '₹'+(a>=1e7?f(x/1e7)+' Cr':a>=1e5?f(x/1e5)+' Lakh':a>=1e3?f(x/1e3)+' K':fmt(x))};
const monthLabel=k=>{const [y,m]=k.split('-').map(Number);return new Date(Date.UTC(y,m-1,1)).toLocaleDateString('en-IN',{month:'short',year:'2-digit',timeZone:'UTC'})};
function Metric({label,value,note,tone=0,icon:Icon}){return <article className="pi-metric" style={{'--tone':COLORS[tone%COLORS.length]}}><div><span>{label}</span>{Icon&&<Icon size={16}/>}</div><strong>{value}</strong></article>}
function Section({no,title,desc,wide=false,children}){return <section className={'pi-section'+(wide?' wide':'')}><header><span>{no} · PRODUCTION</span><h2>{title}</h2></header>{children}</section>}
function Chart({children,height=225}){return <div className="pi-chart" style={{height}}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>}
function Empty({children='Not available in the current source data.'}){return <div className="pi-empty">{children}</div>}
function Table({columns,rows}){return <div className="pi-table-wrap"><table><thead><tr>{columns.map(c=><th key={c.k}>{c.t}</th>)}</tr></thead><tbody>{rows.length?rows.slice(0,8).map((r,i)=><tr key={r.order_id||r.styleLabel||r.country||i}>{columns.map(c=><td key={c.k}>{c.f?c.f(r[c.k],r):(r[c.k]??'—')}</td>)}</tr>):<tr><td colSpan={columns.length}>No matching records.</td></tr>}</tbody></table></div>}
export default function ProductionIntelligence({orders=[],live=false}){
 const d=useMemo(()=>{
  const rows=Array.isArray(orders)?orders:[];
  const ordered=sum(rows,'order_qty'),shipped=sum(rows,'shipped_qty'),rejected=sum(rows,'rejection_qty'),revenue=sum(rows,'revenue_inr'),profit=sum(rows,'profit_inr'),totalCost=sum(rows,'total_cost_inr'),rework=sum(rows,'rework_cost_inr'),overtime=sum(rows,'overtime_hours'),workers=sum(rows,'workers');
  const dated=rows.filter(r=>r.ship_due_date&&r.actual_ship_date),onTime=dated.filter(r=>String(r.actual_ship_date).slice(0,10)<=String(r.ship_due_date).slice(0,10));
  const ar=rows.filter(r=>r.actual_efficiency!=null&&r.actual_efficiency!==''),tr=rows.filter(r=>r.target_efficiency!=null&&r.target_efficiency!==''),actual=ar.length?sum(ar,'actual_efficiency')/ar.length:null,target=tr.length?sum(tr,'target_efficiency')/tr.length:null;
  const unitCostKeys=['fabric_cost_per_pc_inr','trims_cost_per_pc_inr','cmt_cost_per_pc_inr','ot_cost_per_pc_inr','overhead_per_pc_inr'];
  const costMix=['Fabric','Trims','CMT','Overtime','Overhead'].map((name,i)=>({name,value:rows.reduce((s,r)=>s+num(r[unitCostKeys[i]])*num(r.shipped_qty||r.order_qty),0)})).filter(x=>x.value>0);
  const styles=new Map();rows.forEach(r=>{const k=r.style_id||r.product_category||'Unclassified',x=styles.get(k)||{styleLabel:k,orders:0,ordered:0,shipped:0,rejected:0,revenue:0,profit:0};x.orders++;x.ordered+=num(r.order_qty);x.shipped+=num(r.shipped_qty);x.rejected+=num(r.rejection_qty);x.revenue+=num(r.revenue_inr);x.profit+=num(r.profit_inr);styles.set(k,x)});
  const styleRows=[...styles.values()].map(x=>({...x,fill:x.ordered?x.shipped/x.ordered*100:null,reject:x.ordered?x.rejected/x.ordered*100:null,margin:x.revenue?x.profit/x.revenue*100:null})).sort((a,b)=>b.revenue-a.revenue);
  const monthly=new Map();rows.forEach(r=>{const k=String(r.order_date||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(k))return;const x=monthly.get(k)||{key:k,orders:0,ordered:0,shipped:0,rejected:0,late:0,dated:0,effSum:0,effN:0,targetSum:0,targetN:0,overtime:0};x.orders++;x.ordered+=num(r.order_qty);x.shipped+=num(r.shipped_qty);x.rejected+=num(r.rejection_qty);x.overtime+=num(r.overtime_hours);if(r.actual_efficiency!=null&&r.actual_efficiency!==''){x.effSum+=num(r.actual_efficiency);x.effN++}if(r.target_efficiency!=null&&r.target_efficiency!==''){x.targetSum+=num(r.target_efficiency);x.targetN++}if(r.ship_due_date&&r.actual_ship_date){x.dated++;if(String(r.actual_ship_date).slice(0,10)>String(r.ship_due_date).slice(0,10))x.late++}monthly.set(k,x)});
  const trend=[...monthly.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(x=>({...x,month:monthLabel(x.key),fill:x.ordered?x.shipped/x.ordered*100:null,reject:x.ordered?x.rejected/x.ordered*100:null,latePct:x.dated?x.late/x.dated*100:null,actualEff:x.effN?x.effSum/x.effN:null,targetEff:x.targetN?x.targetSum/x.targetN:null}));
  const countries=new Map();rows.forEach(r=>{const k=r.country||'Unspecified',x=countries.get(k)||{country:k,orders:0,ordered:0,shipped:0};x.orders++;x.ordered+=num(r.order_qty);x.shipped+=num(r.shipped_qty);countries.set(k,x)});
  const countryRows=[...countries.values()].map(x=>({...x,fill:x.ordered?x.shipped/x.ordered*100:null})).sort((a,b)=>b.ordered-a.ordered);
  const risk=rows.map(r=>{const late=!!(r.ship_due_date&&r.actual_ship_date&&String(r.actual_ship_date).slice(0,10)>String(r.ship_due_date).slice(0,10)),gap=r.actual_efficiency!=null&&r.target_efficiency!=null?num(r.actual_efficiency)-num(r.target_efficiency):null,reject=r.order_qty?num(r.rejection_qty)/num(r.order_qty)*100:null,score=(late?2:0)+(gap!==null&&gap<0?1:0)+(reject!==null&&reject>3?2:0)+(num(r.late_penalty_inr)>0?1:0);return {...r,late,gap,reject,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  return {rows,ordered,shipped,rejected,revenue,profit,totalCost,rework,overtime,workers,dated,onTime,actual,target,ar,trend,styleRows,costMix,countryRows,risk,orders:new Set(rows.map(r=>r.order_id).filter(Boolean)).size,latePenalty:sum(rows,'late_penalty_inr'),delayRows:rows.filter(r=>r.delay_days!=null&&r.delay_days!==''),};
 },[orders]);
 const topStyles=d.styleRows.slice(0,8),risk=d.risk.slice(0,8),liveData=live&&d.rows.length>0;
 return <div className="production-intel">
   <div className="pi-kpis">
   <Metric label="Distinct orders" value={fmt(d.orders)} note={fmt(d.rows.length)+' source rows'} icon={PackageCheck}/>
   <Metric label="Ordered / shipped qty" value={fmt(d.ordered)+' / '+fmt(d.shipped)} note={'Fulfilment '+pct(d.ordered?d.shipped/d.ordered*100:NaN)} tone={1} icon={TrendingUp}/>
   <Metric label="Actual efficiency" value={d.actual==null?'—':pct(d.actual)} note={d.target==null?'Target unavailable':'Target '+pct(d.target)} tone={2} icon={Gauge}/>
   <Metric label="On-time shipments" value={d.dated.length?pct(d.onTime.length/d.dated.length*100):'—'} note={d.onTime.length+' / '+d.dated.length+' dated orders'} tone={3} icon={Activity}/>
   <Metric label="Rejection proxy" value={d.ordered?pct(d.rejected/d.ordered*100):'—'} note={fmt(d.rejected)+' rejected units'} tone={4} icon={ShieldCheck}/>
   <Metric label="Rework cost / shipped pc" value={d.shipped?money(d.rework/d.shipped):'—'} note={money(d.rework)+' recorded rework cost'} tone={5} icon={Wallet}/>
  </div>
  <div className="pi-grid">
   <div className="pi-column">
   <Section no="01" title="Production Efficiency" desc="Actual vs target efficiency and order-level performance.">
    {d.ar.length?<><div className="pi-inline"><Metric label="Actual average" value={pct(d.actual)} note={d.ar.length+' populated rows'} tone={1}/><Metric label="Target average" value={d.target==null?'—':pct(d.target)} note={d.target==null?'No target values':'Populated target rows'} tone={2}/><Metric label="Efficiency gap" value={d.target==null?'—':(d.actual-d.target).toFixed(1)+' pp'} note="Actual less target · percentage points" tone={3}/></div>{d.trend.length?<Chart><ComposedChart data={d.trend}><CartesianGrid strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis/><Tooltip/><Line dataKey="actualEff" name="Actual efficiency" stroke={COLORS[0]} dot={false}/><Line dataKey="targetEff" name="Target efficiency" stroke={COLORS[2]} dot={false}/></ComposedChart></Chart>:null}</>:null}
   </Section>
   <Section no="03" title="Delivery & Lead Time" desc="On-time shipment, late-order trend and recorded delay values.">
    <div className="pi-inline"><Metric label="On-time shipments" value={d.dated.length?pct(d.onTime.length/d.dated.length*100):'—'} note={d.onTime.length+' of '+d.dated.length+' dated orders'} tone={2}/><Metric label="Average delay days" value={d.delayRows.length?(sum(d.delayRows,'delay_days')/d.delayRows.length).toFixed(1)+' d':'—'} note="delay_days average" tone={3}/></div>
    {d.trend.length?<Chart><ComposedChart data={d.trend}><CartesianGrid strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis/><YAxis yAxisId="r" orientation="right" tickFormatter={v=>v+'%'}/><Tooltip/><Bar dataKey="late" name="Late dated shipments" fill={COLORS[0]}/><Line yAxisId="r" dataKey="latePct" name="Late share" stroke={COLORS[2]} dot={false}/></ComposedChart></Chart>:null}
   </Section>
   <Section no="05" title="Workforce & Overtime" desc="Order-linked worker and overtime fields; not attendance or unique headcount.">
    <div className="pi-inline"><Metric label="Worker records summed" value={fmt(d.workers)} note="May repeat workers across orders" tone={1}/><Metric label="Overtime hours" value={fmt(d.overtime)} note="Order-linked overtime_hours" tone={3}/></div>
    
   </Section>
   </div>
   <div className="pi-column">
   <Section no="02" title="Quality & Defect Intelligence" desc="Rejection trend and rework exposure; order quantity is a proxy denominator.">
    <div className="pi-inline"><Metric label="Rejected quantity" value={fmt(d.rejected)} note="rejection_qty" tone={3}/><Metric label="Rejected / ordered qty" value={d.ordered?pct(d.rejected/d.ordered*100):'—'} note="Proxy, not inspected-unit defect rate" tone={4}/><Metric label="Rework cost" value={money(d.rework)} note="Recorded rework_cost_inr" tone={0}/></div>
    {d.trend.length?<Chart><ComposedChart data={d.trend}><CartesianGrid strokeDasharray="3 4" vertical={false}/><XAxis dataKey="month" tick={{fontSize:10}}/><YAxis/><YAxis yAxisId="r" orientation="right" tickFormatter={v=>v+'%'}/><Tooltip/><Bar dataKey="rejected" name="Rejected qty" fill={COLORS[0]}/><Line yAxisId="r" dataKey="reject" name="Rejected / ordered %" stroke={COLORS[2]} dot={false}/></ComposedChart></Chart>:null}
   </Section>
   <Section no="04" title="Manufacturing Cost Intelligence" desc="Extended unit-cost components weighted by shipped quantity, with order quantity fallback.">
    {d.costMix.length?<><Chart height={210}><BarChart data={d.costMix} layout="vertical" margin={{left:8,right:20}}><CartesianGrid strokeDasharray="3 4" horizontal={false}/><XAxis type="number" tickFormatter={money}/><YAxis type="category" dataKey="name" width={75}/><Tooltip formatter={money}/><Bar dataKey="value" name="Extended component cost" radius={[0,4,4,0]}>{d.costMix.map((x,i)=><Cell key={x.name} fill={COLORS[i%COLORS.length]}/>)}</Bar></BarChart></Chart><div className="pi-cost-total"><span>Extended component cost</span><b>{money(d.costMix.reduce((a,x)=>a+x.value,0))}</b></div></>:<Empty>Cost-per-piece components are not populated.</Empty>}
   </Section>
   <Section no="06" title="Style & Product Production" desc="Style/category comparison across ordered quantity, fulfilment, rejection proxy and margin.">
    {topStyles.length?<Chart><BarChart data={topStyles} layout="vertical" margin={{left:8,right:18}}><CartesianGrid strokeDasharray="3 4" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="styleLabel" width={100} tick={{fontSize:9}}/><Tooltip/><Bar dataKey="ordered" name="Ordered quantity" fill={COLORS[1]}/></BarChart></Chart>:<Empty/>}
    <Table columns={[{k:'styleLabel',t:'Style / category'},{k:'ordered',t:'Ordered',f:fmt},{k:'fill',t:'Fill rate',f:pct},{k:'reject',t:'Reject proxy',f:pct},{k:'margin',t:'Margin',f:pct}]} rows={topStyles}/>
   </Section>
   <Section no="08" title="Production Risk & Exceptions" desc="Transparent rule-based flags: delay, below-target efficiency, rejection proxy and recorded penalty.">
    <div className="pi-inline"><Metric label="Flagged orders" value={fmt(d.risk.length)} note="One or more rules triggered" tone={3}/><Metric label="Late penalty exposure" value={money(d.latePenalty)} note="Recorded late_penalty_inr" tone={4}/></div>
    <Table columns={[{k:'order_id',t:'Order'},{k:'style_id',t:'Style'},{k:'gap',t:'Efficiency gap',f:v=>v==null?'—':v.toFixed(1)+' pp'},{k:'reject',t:'Reject proxy',f:pct},{k:'late',t:'Late',f:v=>v?'Yes':'No'},{k:'score',t:'Risk score'}]} rows={risk}/>
   </Section>
   </div>
   </div>
 </div>;
}