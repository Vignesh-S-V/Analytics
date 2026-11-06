import React, { useMemo } from 'react';
import { Activity, AlertTriangle, Factory, Gauge, PackageCheck, ShieldCheck, TrendingUp, Wallet, Truck, Layers, Users } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import './production-intelligence.css';

const COLORS=['#F47721','#203B5B','#16A085','#8B4A83','#F2BE45','#557895'];
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const sum=(a,k)=>a.reduce((s,r)=>s+num(r[k]),0);
const fmt=v=>Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:1});
const compactQty=v=>{const x=num(v),a=Math.abs(x),f=n=>Number(n.toFixed(2)).toLocaleString('en-IN',{maximumFractionDigits:2});return a>=1e7?f(x/1e7)+' Cr':a>=1e5?f(x/1e5)+' Lakh':a>=1e3?f(x/1e3)+' K':fmt(x)};
const pct=v=>Number.isFinite(v)?v.toFixed(1)+'%':'—';
const money=v=>{const x=num(v),a=Math.abs(x),f=n=>Number(n.toFixed(1)).toLocaleString('en-IN');return '₹'+(a>=1e7?f(x/1e7)+' Cr':a>=1e5?f(x/1e5)+' Lakh':a>=1e3?f(x/1e3)+' K':fmt(x));};

function Metric({label,value,note,tone=0,icon:Icon,compact=false}){
 return <article className={'pi-metric'+(compact?' compact':'')} style={{'--tone':COLORS[tone%COLORS.length]}}>
  <div><span>{label}</span>{Icon&&<Icon size={16}/>}</div><strong>{value}</strong>{note&&<small className="pi-metric-note">{note}</small>}
 </article>;
}
function Section({no,title,icon:Icon,children}){
 return <section className="pi-section">
  <header><div className="pi-section-icon"><Icon size={18}/></div><h2>{title}</h2><span className="pi-section-no">{no}</span></header>
  {children}
 </section>;
}
function Donut({data,centerLabel,legend=true}){
 const valid=data.filter(x=>x.value>0);
 if(!valid.length)return <div className="pi-donut-empty">No data</div>;
 return <div className="pi-donut-layout">
  <div className="pi-donut-chart"><ResponsiveContainer width="100%" height="100%">
   <PieChart><Pie data={valid} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={2} stroke="none">{valid.map((x,i)=><Cell key={x.name} fill={x.color||COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(v,n)=>[fmt(v),n]}/></PieChart>
  </ResponsiveContainer>{centerLabel&&<div className="pi-donut-center"><span>{centerLabel}</span></div>}</div>
  {legend&&<div className="pi-legend">{valid.map((x,i)=><div key={x.name}><i style={{background:x.color||COLORS[i%COLORS.length]}}/><span>{x.name}</span><b>{x.display??fmt(x.value)}</b></div>)}</div>}
 </div>;
}
function Table({columns,rows}){
 return <div className="pi-table-wrap"><table><thead><tr>{columns.map(c=><th key={c.k}>{c.t}</th>)}</tr></thead>
 <tbody>{rows.length?rows.slice(0,6).map((r,i)=><tr key={r.order_id||r.styleLabel||r.country||i}>{columns.map(c=><td key={c.k}>{c.f?c.f(r[c.k],r):(r[c.k]??'—')}</td>)}</tr>):<tr><td colSpan={columns.length}>No matching records.</td></tr>}</tbody></table></div>;
}
export default function ProductionIntelligence({orders=[],live=false}){
 const d=useMemo(()=>{
  const rows=Array.isArray(orders)?orders:[];
  const ordered=sum(rows,'order_qty'),shipped=sum(rows,'shipped_qty'),rejected=sum(rows,'rejection_qty');
  const revenue=sum(rows,'revenue_inr'),profit=sum(rows,'profit_inr'),totalCost=sum(rows,'total_cost_inr');
  const rework=sum(rows,'rework_cost_inr'),overtime=sum(rows,'overtime_hours'),workers=sum(rows,'workers');
  const dated=rows.filter(r=>r.ship_due_date&&r.actual_ship_date);
  const onTime=dated.filter(r=>String(r.actual_ship_date).slice(0,10)<=String(r.ship_due_date).slice(0,10));
  const ar=rows.filter(r=>r.actual_efficiency!=null&&r.actual_efficiency!==''),tr=rows.filter(r=>r.target_efficiency!=null&&r.target_efficiency!=='');
  const actual=ar.length?sum(ar,'actual_efficiency')/ar.length:null,target=tr.length?sum(tr,'target_efficiency')/tr.length:null;
  const costKeys=['fabric_cost_per_pc_inr','trims_cost_per_pc_inr','cmt_cost_per_pc_inr','ot_cost_per_pc_inr','overhead_per_pc_inr'];
  const costMix=['Fabric','Trims','CMT','Overtime','Overhead'].map((name,i)=>({name,value:rows.reduce((s,r)=>s+num(r[costKeys[i]])*num(r.shipped_qty||r.order_qty),0)})).filter(x=>x.value>0);
  const styles=new Map();
  rows.forEach(r=>{const k=r.style_id||r.product_category||'Unclassified',x=styles.get(k)||{styleLabel:k,orders:0,ordered:0,shipped:0,rejected:0,revenue:0,profit:0};x.orders++;x.ordered+=num(r.order_qty);x.shipped+=num(r.shipped_qty);x.rejected+=num(r.rejection_qty);x.revenue+=num(r.revenue_inr);x.profit+=num(r.profit_inr);styles.set(k,x)});
  const styleRows=[...styles.values()].map(x=>({...x,fill:x.ordered?x.shipped/x.ordered*100:null,reject:x.ordered?x.rejected/x.ordered*100:null,margin:x.revenue?x.profit/x.revenue*100:null})).sort((a,b)=>b.ordered-a.ordered);
  const risk=rows.map(r=>{const late=!!(r.ship_due_date&&r.actual_ship_date&&String(r.actual_ship_date).slice(0,10)>String(r.ship_due_date).slice(0,10)),gap=r.actual_efficiency!=null&&r.target_efficiency!=null?num(r.actual_efficiency)-num(r.target_efficiency):null,reject=r.order_qty?num(r.rejection_qty)/num(r.order_qty)*100:null,score=(late?2:0)+(gap!==null&&gap<0?1:0)+(reject!==null&&reject>3?2:0)+(num(r.late_penalty_inr)>0?1:0);return {...r,late,gap,reject,score}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  const overtimeRows=rows.filter(r=>num(r.overtime_hours)>0).length;
  return {rows,ordered,shipped,rejected,revenue,profit,totalCost,rework,overtime,workers,dated,onTime,actual,target,ar,costMix,styleRows,risk,orders:new Set(rows.map(r=>r.order_id).filter(Boolean)).size,latePenalty:sum(rows,'late_penalty_inr'),delayRows:rows.filter(r=>r.delay_days!=null&&r.delay_days!==''),overtimeRows};
 },[orders]);
 const topStyles=d.styleRows.slice(0,5);
 const efficiencyAttainment=d.target>0&&d.actual!=null?Math.min(d.actual/d.target*100,100):0;
 const onTimePct=d.dated.length?d.onTime.length/d.dated.length*100:0;
 const overtimePct=d.rows.length?d.overtimeRows/d.rows.length*100:0;
 const flaggedPct=d.rows.length?d.risk.length/d.rows.length*100:0;
 return <div className="production-intel">
  <div className="pi-kpis">
   <Metric label="Distinct orders" value={fmt(d.orders)} icon={PackageCheck} tone={0}/>
   <Metric label="Ordered / shipped qty" value={<>{compactQty(d.ordered)} <span className="pi-kpi-divider">/</span> {compactQty(d.shipped)}</>} note="Order quantity / shipped quantity" icon={TrendingUp} tone={1}/>
   <Metric label="Actual efficiency" value={d.actual==null?'—':pct(d.actual)} icon={Gauge} tone={2}/>
   <Metric label="On-time shipments" value={d.dated.length?pct(onTimePct):'—'} icon={Activity} tone={3}/>
   <Metric label="Rejection proxy" value={d.ordered?pct(d.rejected/d.ordered*100):'—'} icon={ShieldCheck} tone={4}/>
   <Metric label="Total rework cost" value={d.rework?money(d.rework):'—'} note={d.shipped?money(d.rework/d.shipped)+' per shipped pc':'Total rework expenditure · INR'} icon={Wallet} tone={5}/>
  </div>
  <div className="pi-grid">
   <Section no="01" title="Production Efficiency" icon={Factory}>
    <div className="pi-panel-body pi-efficiency">
     <div className="pi-metric-grid">
      <Metric compact label="Actual average" value={d.actual==null?'—':pct(d.actual)} tone={1}/>
      <Metric compact label="Target average" value={d.target==null?'—':pct(d.target)} tone={2}/>
      <Metric compact label="Efficiency gap" value={d.target==null||d.actual==null?'—':(d.actual-d.target).toFixed(1)+' pp'} tone={3}/>
     </div>
     {d.actual!=null&&d.target>0?<Donut centerLabel="TARGET ATTAINMENT" data={[{name:'Attained',value:efficiencyAttainment,color:COLORS[2],display:pct(efficiencyAttainment)},{name:'Remaining',value:100-efficiencyAttainment,color:'#E8EDF2',display:pct(100-efficiencyAttainment)}]}/>:<div className="pi-data-note">Efficiency target comparison is unavailable.</div>}
    </div>
   </Section>
   <Section no="02" title="Manufacturing Cost" icon={Layers}>
    {d.costMix.length?<div className="pi-cost-layout"><div className="pi-cost-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.costMix} layout="vertical" margin={{left:0,right:8,top:4,bottom:4}} barCategoryGap={12}><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={82} axisLine={false} tickLine={false} tick={{fontSize:12,fill:'#52647A'}}/><Tooltip formatter={money}/><Bar dataKey="value" name="Extended cost" radius={[0,5,5,0]}>{d.costMix.map((x,i)=><Cell key={x.name} fill={COLORS[i]}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="pi-cost-total"><span>Total</span><strong>{money(d.costMix.reduce((a,x)=>a+x.value,0))}</strong></div></div>:<div className="pi-data-note">Cost component fields are not available.</div>}
   </Section>
   <Section no="03" title="Delivery & Lead Time" icon={Truck}>
    <div className="pi-panel-body pi-delivery">
     <div className="pi-metric-grid two">
      <Metric compact label="On-time shipments" value={d.dated.length?pct(onTimePct):'—'} tone={2}/>
      <Metric compact label="Average delay days" value={d.delayRows.length?(sum(d.delayRows,'delay_days')/d.delayRows.length).toFixed(1)+' d':'—'} tone={3}/>
     </div>
     {d.dated.length?<Donut centerLabel="SHIPMENT STATUS" data={[{name:'On-time',value:d.onTime.length,color:COLORS[1],display:fmt(d.onTime.length)},{name:'Delayed',value:d.dated.length-d.onTime.length,color:COLORS[0],display:fmt(d.dated.length-d.onTime.length)}]}/>:<div className="pi-data-note">Shipment date pairs are not available.</div>}
    </div>
   </Section>
   <Section no="04" title="Style & Product Production" icon={Activity}>
    <Table columns={[{k:'styleLabel',t:'Style / category'},{k:'ordered',t:'Ordered',f:fmt},{k:'fill',t:'Fill rate',f:pct},{k:'reject',t:'Reject proxy',f:pct},{k:'margin',t:'Margin',f:pct}]} rows={topStyles}/>
   </Section>
   <Section no="05" title="Workforce & Overtime" icon={Users}>
    <div className="pi-panel-body pi-workforce">
     <div className="pi-metric-grid two">
      <Metric compact label="Worker entries (order-level)" value={fmt(d.workers)} note="Sum across orders; not unique employees" tone={1}/>
      <Metric compact label="Total overtime hours" value={fmt(d.overtime)} note="Recorded hours summed across orders" tone={3}/>
     </div>
     {d.rows.length?<Donut centerLabel="OVERTIME STATUS" data={[{name:'Orders with overtime entry',value:d.overtimeRows,color:COLORS[0],display:fmt(d.overtimeRows)},{name:'Orders without overtime entry',value:d.rows.length-d.overtimeRows,color:COLORS[1],display:fmt(d.rows.length-d.overtimeRows)}]}/>:<div className="pi-data-note">No workforce rows are available.</div>}
    </div>
   </Section>
   <Section no="06" title="Production Risk & Exceptions" icon={AlertTriangle}>
    <div className="pi-panel-body pi-risk">
     <div className="pi-metric-grid two">
      <Metric compact label="Flagged orders" value={fmt(d.risk.length)} tone={3}/>
      <Metric compact label="Late penalty exposure" value={money(d.latePenalty)} tone={4}/>
     </div>
     <Donut centerLabel="ORDER RISK" data={[{name:'Flagged',value:d.risk.length,color:COLORS[0],display:pct(flaggedPct)},{name:'No flags',value:Math.max(0,d.rows.length-d.risk.length),color:COLORS[1],display:pct(100-flaggedPct)}]}/>
    </div>
   </Section>
  </div>
 </div>;
}
