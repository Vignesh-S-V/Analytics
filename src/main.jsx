import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Activity, ArrowDownRight, ArrowUpRight, AudioLines, Bot, Boxes, BriefcaseBusiness, CheckCircle2, ChevronDown, CircleDollarSign, Factory, Filter, Globe2, LayoutDashboard, Lightbulb, LogOut, Megaphone, Mic, PackageCheck, Search, Send, Settings2, ShieldAlert, Shirt, Sparkles, Square, Target, TrendingUp, Truck, Volume2, Wallet, BarChart3, BrainCircuit, Handshake, Package, SlidersHorizontal, Users } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import './styles.css';
import ProductEconomics from './ProductEconomics.jsx';
import AdvancedDashboards from './AdvancedDashboards.jsx';
import ProcurementIntelligence from './ProcurementIntelligence.jsx';
import ProductionIntelligence from './ProductionIntelligence.jsx';

const colors=['#E07842','#243B53','#2A9D8F','#8A5A83','#E9C46A','#577590','#B85C38','#6D9773'];
const nav=[['Overview',LayoutDashboard],['Ask AI',Bot],['Product Economics',Shirt],['Sales & Buyers',BriefcaseBusiness],['Production',Factory],['Marketing ROI',Megaphone],['Procurement',Boxes],['Executive Command Center',BarChart3],['Revenue Intelligence',TrendingUp],['Customer Intelligence',Users],['Product Portfolio',Package],['Operational Excellence',Factory],['Supplier Intelligence',Handshake],['Scenario Simulator',SlidersHorizontal]];
const compactIN=(value)=>{const n=Number(value||0),a=Math.abs(n),fmt=v=>Number(v.toFixed(1)).toLocaleString('en-IN',{maximumFractionDigits:1});if(a>=1e7)return `${fmt(n/1e7)} Cr`;if(a>=1e5)return `${fmt(n/1e5)} Lakh`;if(a>=1e3)return `${fmt(n/1e3)} Thousand`;return n.toLocaleString('en-IN',{maximumFractionDigits:1});};
const inr=n=>'₹'+compactIN(n);
const fmtPct=v=>Number(v||0).toFixed(2)+'%';
function normalizeAskAnswer(value){
 return String(value||'')
  .replace(/\\r\\n/g,'\n')
  .replace(/\\n/g,'\n')
  .replace(/\\([#*_|])/g,'$1')
  .replace(/\brecorded\s+profit\b/gi,'net profit')
  .replace(/\brecorded\s+revenue\b/gi,'revenue')
  .replace(/\brecorded\s+cost\b/gi,'cost')
  .replace(/\brecorded\s+efficiency\b/gi,'actual efficiency')
  .replace(/\brecorded\s+rework\b/gi,'rework')
  .replace(/\brecorded\s+delay\b/gi,'delay')
  .replace(/\brecorded\s+sales\b/gi,'sales')
  .replace(/\brecorded\s+values\b/gi,'available values')
  .replace(/\brecorded\s+data\b/gi,'business data')
  .replace(/\brecorded\b/gi,'actual')
  .replace(/\*\*?svg(?:Grounded in workspace data)?\*\*/gi,'')
  .replace(/(^|\n)\s*svgGrounded in workspace data\s*(?=\n|$)/gi,'$1')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
}
const INTERNAL_ASK_AI_NAMES=['vw_sales_monthly_by_country','vw_sales_by_country','vw_sales_by_buyer','vw_sales_by_product','vw_marketing_channel_performance','vw_production_by_line','vw_supplier_scorecard','vw_market_monthly','vw_management_monthly','vw_sales_profitability_by_month_country','fact_orders','fact_marketing','dim_suppliers','dim_market','threadiq_workspace_members'];
function safeAskAnswer(value){
 let result=normalizeAskAnswer(value);
 for(const name of INTERNAL_ASK_AI_NAMES)result=result.replace(new RegExp('\\b'+name+'\\b','gi'),'workspace data');
 return result.replace(/(₹\s*[\d,.]+\s*(?:Cr|crore|Lakh|L|Thousand|T))\s*\(\s*₹[\d,]+(?:\.\d+)?\s*\)/gi,'$1').replace(/\b(?:source|table|view|relation)\s*:\s*workspace data\b/gi,'workspace data').replace(/\bworkspace data rows\b/gi,'matching business records').replace(/(^|\n)(\s*(?:\d+[.)]\s*)?)(?:based on|according to) (?:the )?workspace (?:records|data)[,.:;!?-]*\s*/gim,'$1$2').replace(/^\s*\*{0,2}svg\*{0,2}\s*$/gim,'').replace(/\n{3,}/g,'\n\n').trim();
}
function rankingTableFromAnswer(answer){
 const text=String(answer||'');
 const supplierHeading=/all\s+\d+\s+suppliers?\s+ranked\s+by\s+(?:total\s+)?linked.order\s+revenue/i.test(text);
 if(!supplierHeading)return null;
 const rows=[];
 const linePattern=/(?:^|\n)\s*(\d+)\.\s*(.*?)\s*\((SP\d+)\)\s*[—-]\s*₹?([\d,.]+)\s*(Cr|crore|Lakh|L)?\s*;\s*(?:linked\s+)?orders\s+([\d,]+)/gi;
 let match;
 while((match=linePattern.exec(text))!==null){
  const amount=Number(match[4].replace(/,/g,''))*(/^(l|lakh)$/i.test(match[5]||'')?100000:/^(cr|crore)$/i.test(match[5]||'')?10000000:1);
  rows.push({rank:Number(match[1]),supplier_name:match[2].trim(),supplier_id:match[3],revenue_inr:amount,linked_order_count:Number(match[6].replace(/,/g,''))});
 }
 if(!rows.length)return null;
 return {title:'Supplier revenue ranking',subtitle:'Highest to lowest · '+rows.length+' suppliers',columns:[{key:'rank',label:'Rank',type:'number'},{key:'supplier_name',label:'Supplier Name'},{key:'supplier_id',label:'Supplier Code'},{key:'revenue_inr',label:'Linked-Order Revenue',type:'currency'},{key:'linked_order_count',label:'Linked Orders',type:'number'}],rows};
}


function deriveAnswerInsight(question, answer) {
 const q = String(question || '').toLowerCase();
 const lines = String(answer || '').split(/\r?\n/).map(line => line.trim()).filter(line => line.startsWith('|') && !/^\|[\s|:-]+\|?$/.test(line));
 const rows = lines.map(line => line.split('|').slice(1, -1).map(cell => cell.trim())).filter(cells => cells.length > 2 && !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
 const header = rows[0]?.map(cell => cell.toLowerCase().replace(/\s+/g, ' ')) || [];
 const data = rows.slice(1);
 const value = (cells, labels) => { const index = header.findIndex(h => labels.some(label => h.includes(label))); return index >= 0 ? cells[index] : ''; };
 const amount = raw => { const n = parseFloat(String(raw || '').replace(/[₹,\s]/g, '')); if (!Number.isFinite(n)) return 0; return /cr|crore/i.test(raw) ? n * 1e7 : /lakh|\bl\b/i.test(raw) ? n * 1e5 : n; };
 const countryTable = header.some(h => h === 'country') && header.some(h => h.includes('revenue'));
 const buyerTable = header.some(h => h === 'buyer') && header.some(h => h.includes('profit'));
 const monthlyTable = header.some(h => h === 'month') && header.some(h => h.includes('growth'));
 if ((/highest|top|rank|most/.test(q)) && (/revenue|sales|turnover|profit/.test(q)) && (countryTable || buyerTable)) {
  const byProfit = /profit/.test(q) && !/revenue|sales/.test(q);
  const metricLabels = byProfit ? ['net profit', 'profit'] : ['revenue', 'total revenue', 'sales'];
  const sorted = [...data].sort((a, b) => amount(value(b, metricLabels)) - amount(value(a, metricLabels)));
  const best = sorted[0];
  if (!best) return null;
  return {
   title: countryTable ? 'Country ranked highest by ' + (byProfit ? 'profit' : 'revenue') : 'Buyer ranked highest by ' + (byProfit ? 'profit' : 'revenue'),
   primary: countryTable ? value(best, ['country']) : value(best, ['buyer']),
   metrics: [
    { label: byProfit ? 'net profit' : 'Revenue', value: value(best, metricLabels) },
    { label: 'Orders', value: value(best, ['orders', 'order count']) },
    { label: 'Profit margin', value: value(best, ['weighted profit margin', 'profit margin']) }
   ]
  };
 }
 if (monthlyTable && /monthly|month|growth|trend/.test(q)) {
  const parsed = data.map(cells => ({
   month: value(cells, ['month']),
   revenue: value(cells, ['total revenue', 'revenue']),
   growth: value(cells, ['growth']),
   revenueNum: amount(value(cells, ['total revenue', 'revenue'])),
   growthNum: parseFloat(String(value(cells, ['growth'])).replace('%', ''))
  })).filter(row => row.month && row.revenue);
  if (!parsed.length) return null;
  const growthRows = parsed.filter(row => Number.isFinite(row.growthNum));
  const highestGrowth = growthRows.length ? [...growthRows].sort((a, b) => b.growthNum - a.growthNum)[0] : null;
  const lowestGrowth = growthRows.length ? [...growthRows].sort((a, b) => a.growthNum - b.growthNum)[0] : null;
  const highestRevenue = [...parsed].sort((a, b) => b.revenueNum - a.revenueNum)[0];
  return {
   title: 'Monthly sales highlights',
   primary: highestRevenue.month,
   metrics: [
    { label: 'Highest revenue', value: highestRevenue.revenue },
    { label: 'Highest MoM growth', value: highestGrowth ? highestGrowth.month + ' · ' + highestGrowth.growth : 'Not provided' },
    { label: 'Largest MoM decline', value: lowestGrowth ? lowestGrowth.month + ' · ' + lowestGrowth.growth : 'Not provided' }
   ]
  };
 }
 return null;
}


// Read every page instead of silently truncating large Supabase tables at a fixed row limit.
async function fetchAllRowsInPages(buildQuery,pageSize=1000,parallelPages=5){
 const rows=[];
 let offset=0;
 while(true){
  const starts=Array.from({length:parallelPages},(_,i)=>offset+i*pageSize);
  const pages=await Promise.all(starts.map(from=>buildQuery().range(from,from+pageSize-1)));
  const failed=pages.find(page=>page.error);
  if(failed)throw failed.error;
  for(const page of pages)rows.push(...(page.data||[]));
  if(pages.some(page=>(page.data||[]).length<pageSize))return rows;
  offset+=starts.length*pageSize;
 }
}
const SUPABASE_URL=String(import.meta.env.VITE_SUPABASE_URL||'https://rzsgdfpwnxhseyxtrrlx.supabase.co').trim();
const AUTH_REDIRECT_URL='https://analytics.vigneshw-5416.workers.dev/';
const configuredPublicKey=String(import.meta.env.VITE_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_LEGACY_ANON_KEY||'').trim();
const SUPABASE_PUBLIC_KEY=configuredPublicKey&&!/^(your_|replace|placeholder)/i.test(configuredPublicKey)?configuredPublicKey:'sb_publishable_kV77uVff2Gv6PiW1b1xBrw_4XsqB_00';
const fiscalYearStart=date=>{if(!date)return null;const [y,m]=String(date).slice(0,10).split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?(m>=4?y:y-1):null;};
function AuthScreen({db}){
 const [mode,setMode]=useState('signin');
 const [fullName,setFullName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const isSignup=mode==='signup';
 const clearFeedback=()=>{setError('');setNotice('')};
 const switchMode=next=>{setMode(next);clearFeedback();setPassword('');setConfirmPassword('')};
 const friendlyAuthError=message=>{
  const text=String(message||'').toLowerCase();
  if(text.includes('signup')&&(/disabled|not allowed|not permitted/.test(text)))return 'New account registration is disabled in Supabase Auth. The workspace owner must enable “Allow new users to sign up” in Authentication settings.';
  if(text.includes('password')&&text.includes('least'))return 'Choose a stronger password with at least 8 characters.';
  if(text.includes('rate limit')||text.includes('too many'))return 'Too many attempts. Wait a few minutes and try again.';
  if(text.includes('redirect')&&text.includes('allow'))return 'The current website URL is not in Supabase Auth’s allowed redirect URLs. Add this site under Authentication → URL Configuration.';
  return message|| (isSignup?'Account creation failed. Please try again.':'Sign-in failed. Please try again.');
 };
 const submit=async(e)=>{
  e.preventDefault();
  if(busy||!db)return;
  clearFeedback();
  const cleanEmail=email.trim().toLowerCase();
  if(isSignup){
   if(fullName.trim().length<2){setError('Enter your full name.');return;}
   if(password.length<8){setError('Password must contain at least 8 characters.');return;}
   if(password!==confirmPassword){setError('Passwords do not match.');return;}
  }
  setBusy(true);
  try{
   if(isSignup){
    const {data,error}=await db.auth.signUp({
     email:cleanEmail,
     password,
     options:{
      emailRedirectTo:window.location.origin,
      data:{full_name:fullName.trim()}
     }
    });
    if(error)throw error;
    if(data?.session)await db.auth.signOut();
    setPassword('');
    setConfirmPassword('');
    setNotice('Account request submitted. Check your email for a verification link. After verification, the workspace owner must approve your account before any business data is available.');
   }else{
    const {error}=await db.auth.signInWithPassword({email:cleanEmail,password});
    if(error)throw error;
   }
  }catch(e){
   setError(friendlyAuthError(e?.message));
  }finally{
   setBusy(false);
  }
 };
 return <main className="auth-shell"><section className="auth-card">
  <div className="auth-brand"><span className="auth-brand-icon"><ShieldAlert size={23}/></span><div><b>ThreadIQ</b><small>PRIVATE BUSINESS WORKSPACE</small></div></div>
  <h1>{isSignup?'Create your account':'Sign in to ThreadIQ'}</h1>
  <p className="auth-copy">{isSignup?'Create your login, verify your email and request workspace approval. Registration does not automatically grant access to business data.':'Sign in with a workspace-approved account to access sales, buyer and supplier data.'}</p>
  <div className="auth-mode-switch" role="tablist" aria-label="Account access">
   <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup?'active':''} onClick={()=>switchMode('signin')}>Sign in</button>
   <button type="button" role="tab" aria-selected={isSignup} className={isSignup?'active':''} onClick={()=>switchMode('signup')}>Create account</button>
  </div>
  <form onSubmit={submit} className="auth-form">
   {isSignup&&<label>Full name<input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name"/></label>}
   <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required maxLength={254} placeholder="you@company.com"/></label>
   <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={isSignup?'new-password':'current-password'} required minLength={8} maxLength={128} placeholder={isSignup?'At least 8 characters':'Your password'}/></label>
   {isSignup&&<label>Confirm password<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} placeholder="Re-enter your password"/></label>}
   <button className="auth-submit" type="submit" disabled={busy||!email.trim()||password.length<8||(isSignup&&(fullName.trim().length<2||password!==confirmPassword))}>{busy?(isSignup?'Creating account…':'Signing in…'):(isSignup?'Create account':'Sign in securely')}</button>
  </form>
  {error&&<p className="auth-error" role="alert">{error}</p>}
  {notice&&<div className="auth-notice" role="status"><b>Next step</b><br/>{notice}<button type="button" className="auth-notice-action" onClick={()=>switchMode('signin')}>Back to sign in</button></div>}
  <p className="auth-footnote">{isSignup?'All new accounts require email verification and manual workspace approval. Only active members can read company data.':'Need a login? Select Create account. New accounts remain pending until the workspace owner approves them.'}</p>
 </section></main>
}

function AccessScreen({mode,db,email='',onRetry=()=>{}}){
 const title=mode==='loading'?'Loading secure workspace…':mode==='checking'?'Verifying account access…':mode==='denied'?'Access is not yet approved':'Could not verify access';
 const description=mode==='loading'||mode==='checking'?'Checking your signed-in session and workspace approval.':mode==='denied'?'This account ID is not on the workspace allowlist yet. Ask the workspace owner to approve this account, then select Check access again.':'The access check could not complete. Check your connection, then retry. No business data will be loaded until access is verified.';
 return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="auth-brand-icon"><ShieldAlert size={23}/></span><div><b>ThreadIQ</b><small>PRIVATE BUSINESS WORKSPACE</small></div></div><h1>{title}</h1><p className="auth-copy">{description}</p>{email&&<p className="auth-email">{email}</p>}{mode==='denied'&&<button className="auth-submit" type="button" onClick={onRetry}>Check access again</button>}{mode==='error'&&<button className="auth-submit" type="button" onClick={onRetry}>Retry access check</button>}{(mode==='denied'||mode==='error')&&<button className="auth-switch" type="button" onClick={()=>{void db?.auth.signOut()}}>Sign out</button>}<p className="auth-footnote">Only approved accounts may query customer, supplier or financial records.</p></section></main>
}
function YearOverYearComparison({rows,gpCostRows,gpCostLoaded,gpCostError,country}){
 const comparison=useMemo(()=>{
  const relevant=rows.filter(r=>(country==='All countries'||r.country===country)&&r.month);
  const years=[...new Set(relevant.map(r=>fiscalYearStart(r.month)).filter(y=>y!==null))].sort((a,b)=>b-a);
  if(years.length<2)return {ready:false,reason:'At least two financial years are required for a year-over-year comparison.'};
  const currentYear=years[0],previousYear=currentYear-1;
  const byYearMonth=new Map();
  relevant.forEach(r=>{
   const fy=fiscalYearStart(r.month);if(fy!==currentYear&&fy!==previousYear)return;
   const month=Number(String(r.month).slice(5,7));if(month<1||month>12)return;
   const fiscalMonth=(month+8)%12,key=fy+'-'+fiscalMonth;
   const v=byYearMonth.get(key)||{revenue:0,qty:0,profit:0};
   v.revenue+=Number(r.revenue_inr||0);
   v.qty+=Number(r.shipped_qty||0);
   v.profit+=Number(r.profit_inr||0);
   byYearMonth.set(key,v);
  });
  const data=Array.from({length:12},(_,i)=>{
   const current=byYearMonth.get(currentYear+'-'+i),previous=byYearMonth.get(previousYear+'-'+i);
   return {index:i,month:['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'][i],current:current?.revenue??null,previous:previous?.revenue??null,currentQty:current?.qty??null,previousQty:previous?.qty??null};
  }).filter(d=>d.current!==null&&d.previous!==null);
  if(!data.length)return {ready:false,reason:'No matching months are available in both financial years.'};
  const current=data.reduce((s,d)=>s+d.current,0),previous=data.reduce((s,d)=>s+d.previous,0);
  const currentQty=data.reduce((s,d)=>s+d.currentQty,0),previousQty=data.reduce((s,d)=>s+d.previousQty,0);
  const matchedFiscalMonths=new Set(data.map(d=>d.index));
  const profitByYear={current:data.reduce((s,d)=>s+(byYearMonth.get(currentYear+'-'+d.index)?.profit||0),0),previous:data.reduce((s,d)=>s+(byYearMonth.get(previousYear+'-'+d.index)?.profit||0),0)};
  const directByYear={current:0,previous:0},costCoverage={current:{rows:0,missing:0},previous:{rows:0,missing:0}};
  if(gpCostLoaded&&!gpCostError){gpCostRows.filter(o=>(country==='All countries'||o.country===country)&&o.order_date).forEach(o=>{const fy=fiscalYearStart(o.order_date),month=Number(String(o.order_date).slice(5,7)),fiscalMonth=(month+8)%12;if(!matchedFiscalMonths.has(fiscalMonth))return;const bucket=fy===currentYear?'current':fy===previousYear?'previous':null;if(!bucket)return;costCoverage[bucket].rows++;if(o.fabric_cost_per_pc_inr==null||o.trims_cost_per_pc_inr==null||o.cmt_cost_per_pc_inr==null){costCoverage[bucket].missing++;return;}const qty=Number(o.shipped_qty||o.order_qty||0);directByYear[bucket]+=(Number(o.fabric_cost_per_pc_inr)+Number(o.trims_cost_per_pc_inr)+Number(o.cmt_cost_per_pc_inr))*qty;});}
  const currentGrossProfit=current-directByYear.current,previousGrossProfit=previous-directByYear.previous;
  return {ready:true,currentYear,previousYear,data,current,previous,currentQty,previousQty,gpCurrentPct:current?currentGrossProfit/current*100:null,gpPreviousPct:previous?previousGrossProfit/previous*100:null,npCurrentPct:current?profitByYear.current/current*100:null,npPreviousPct:previous?profitByYear.previous/previous*100:null,gpReady:gpCostLoaded&&!gpCostError&&costCoverage.current.rows>0&&costCoverage.previous.rows>0&&costCoverage.current.missing===0&&costCoverage.previous.missing===0,npReady:true,gpCostError,revenueChange:previous===0?null:(current-previous)/Math.abs(previous)*100,qtyChange:previousQty===0?null:(currentQty-previousQty)/Math.abs(previousQty)*100,country,months:data.length};
 },[rows,country,gpCostRows,gpCostLoaded,gpCostError]);
 const pct=v=>v===null?'N/A':(v>0?'+':'')+v.toFixed(1)+'%';
 const fy=y=>'FY '+y+'–'+String((y+1)%100).padStart(2,'0');
 return <section className="panel chart-panel yoy-panel"><div className="panel-top"><div><span className="panel-kicker">PHASE 2 · YEAR-OVER-YEAR ANALYTICS</span><h2>Current FY vs previous FY</h2><p>Revenue and shipped quantity compared across matching financial-year months{country!=='All countries'?' for '+country:''}.</p></div><div className="panel-icon"><TrendingUp size={20}/></div></div>{comparison.ready?<><div className="yoy-kpis"><div className="result-card"><span className="panel-kicker">{fy(comparison.currentYear)} REVENUE</span><strong>{inr(comparison.current)}</strong></div><div className="result-card"><span className="panel-kicker">{fy(comparison.previousYear)} REVENUE</span><strong>{inr(comparison.previous)}</strong></div><div className="result-card"><span className="panel-kicker">REVENUE GROWTH</span><strong className={comparison.revenueChange===null?'':comparison.revenueChange>=0?'positive':'negative'}>{pct(comparison.revenueChange)}</strong><p>{comparison.months} matched months</p></div><div className="result-card"><span className="panel-kicker">{fy(comparison.currentYear)} SHIPPED QTY</span><strong>{Number(comparison.currentQty).toLocaleString('en-IN',{maximumFractionDigits:1})}</strong></div><div className="result-card"><span className="panel-kicker">{fy(comparison.previousYear)} SHIPPED QTY</span><strong>{Number(comparison.previousQty).toLocaleString('en-IN',{maximumFractionDigits:1})}</strong></div><div className="result-card"><span className="panel-kicker">QUANTITY GROWTH</span><strong className={comparison.qtyChange===null?'':comparison.qtyChange>=0?'positive':'negative'}>{pct(comparison.qtyChange)}</strong><p>Based on shipped quantity</p></div><div className="result-card"><span className="panel-kicker">GROSS PROFIT (GP%)</span><strong>{comparison.gpReady?fmtPct(comparison.gpCurrentPct):'—'}</strong><p>{comparison.gpReady?'Previous FY: '+fmtPct(comparison.gpPreviousPct):!gpCostLoaded?'Loading direct cost details…':gpCostError?'Direct cost query failed: '+gpCostError:!comparison.gpReady&&gpCostLoaded?'Direct-cost values are incomplete for one or both FYs':'No direct-cost rows for selected scope'}</p></div><div className="result-card"><span className="panel-kicker">NET PROFIT (NP%)</span><strong>{comparison.npReady?fmtPct(comparison.npCurrentPct):'—'}</strong><p>{comparison.npReady?'Previous FY: '+fmtPct(comparison.npPreviousPct):'Profit summary unavailable'}</p></div></div><div className="chart-wrap yoy-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={comparison.data} margin={{top:10,right:10,left:0,bottom:0}}><CartesianGrid stroke="#253148" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" stroke="#71809c" tickLine={false} axisLine={false} fontSize={10}/><YAxis stroke="#71809c" tickLine={false} axisLine={false} fontSize={9} tickFormatter={v=>inr(v)}/><Tooltip contentStyle={{background:'#111a2d',border:'1px solid #303c55',borderRadius:12}} formatter={v=>inr(v)}/><Bar dataKey="previous" name={fy(comparison.previousYear)} fill={colors[1]} radius={[4,4,0,0]}/><Bar dataKey="current" name={fy(comparison.currentYear)} fill={colors[0]} radius={[4,4,0,0]}/></ComposedChart></ResponsiveContainer></div><div className="chart-wrap yoy-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={comparison.data} margin={{top:10,right:10,left:0,bottom:0}}><CartesianGrid stroke="#253148" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" stroke="#71809c" tickLine={false} axisLine={false} fontSize={10}/><YAxis stroke="#71809c" tickLine={false} axisLine={false} fontSize={9} tickFormatter={v=>Number(v).toLocaleString('en-IN')}/><Tooltip contentStyle={{background:'#111a2d',border:'1px solid #303c55',borderRadius:12}} formatter={v=>Number(v).toLocaleString('en-IN',{maximumFractionDigits:1})}/><Bar dataKey="previousQty" name={fy(comparison.previousYear)+' shipped qty'} fill={colors[1]} radius={[4,4,0,0]}/><Bar dataKey="currentQty" name={fy(comparison.currentYear)+' shipped qty'} fill={colors[0]} radius={[4,4,0,0]}/></ComposedChart></ResponsiveContainer></div></>:<div className="yoy-empty"><Activity size={18}/><span>{comparison.reason} No comparison values are fabricated; import verified rows for both years to enable this analysis.</span></div>}</section>
}

const ASK_AI_BENCHMARK_QUESTIONS=["Calculate total revenue and net profit for the USA only. Show the number of distinct orders and profit margin. Confirm the country filter used.","Calculate the overall weighted profit margin using SUM(net profit) ÷ SUM(revenue) × 100. Do not average individual order-level margin percentages. Explain the difference.","What are the Total Cost / Expenses across the workspace? Compare revenue, Total Cost / Expenses and net profit. Verify whether revenue minus cost equals net profit; explain any discrepancy.","Calculate the average revenue per distinct order. Use total revenue divided by the distinct order count, not the average of monthly averages.","Rank every buyer by total revenue from highest to lowest. Include rank, buyer name, country, revenue, net profit, distinct orders and weighted profit margin. Include all buyers, not just the top 10.","Rank every buyer by net profit from highest to lowest. Include buyer name, country, revenue, profit and margin. Verify that the sort uses profit, not revenue.","Rank all available product categories by revenue from highest to lowest. Include revenue, net profit and weighted margin for each category.","Identify the product category with the highest net profit. Verify the result against the complete category ranking and state whether highest profit also means highest revenue.","Rank every country by total revenue from highest to lowest. Include revenue, net profit, order count and weighted margin for each country.","Compare the USA and Germany by revenue, net profit, distinct orders and weighted profit margin. Show the absolute difference and identify which country leads each metric.","Return the monthly revenue and net profit trend in chronological order. If chart output is supported, provide a line chart; otherwise return a table. State the actual month coverage.","Which month in calendar year 2025 had the highest revenue? Show the month, revenue, net profit and order count. If 2025 coverage is incomplete, clearly state the available date range.","Compare monthly revenue for 2024 versus 2025 using only matching calendar months available in both years. List each matched month and both values. Do not compare a full year with a partial year without explaining the limitation.","Which country had the highest revenue in the latest available month? State the month used and include the top five countries if sufficient data exists.","Rank all suppliers by linked-order revenue from highest to lowest. Include supplier name, supplier code, linked-order revenue, linked-order count, average delay and quality rating wherever available. Do not treat supplier master data as proof of causal impact.","Which production line has the highest actual efficiency? Compare efficiency, rejection quantity/rate, rework cost and delayed shipments where those fields are available. Explain any missing fields and do not substitute invented values.","Rank marketing channels by attributed order revenue, marketing spend, ROAS and profit ROI where the necessary fields exist. Clearly distinguish ROAS = attributed revenue ÷ spend from profit ROI = attributable profit ÷ spend. If attributable profit is unavailable, say so.","Identify three business areas worth investigating based on the verified workspace data. For each, provide the supporting metric, comparison baseline and a cautious recommendation. Do not present correlation as causation.","What is the exact date/month coverage of the workspace data? Report the earliest and latest available periods and explain whether the latest year is complete.","Identify the source tables or views used to calculate the main revenue, profit and order KPIs. Explain how the values were retrieved and whether any filters were applied.","Check for missing values, duplicate order IDs, invalid dates, negative revenue/profit and inconsistent totals where the required data is accessible. Report only checks actually performed; otherwise say which checks are unavailable.","Can you guarantee that every AI answer is correct? Explain the controls used to validate SQL results, formulas, source coverage and missing data. Separate implemented controls from recommended future controls.","A user asks for revenue for a month that is not present in the database. What should you return? Demonstrate by checking an unavailable month, and never estimate or fabricate its revenue.","Explain how this Ask AI application answers business questions. Distinguish the user interface, backend/Edge Function, database queries, deterministic calculations and any LLM used. Mark each statement as verified implementation detail or unverified assumption.","Explain the difference between an LLM, Retrieval-Augmented Generation (RAG) and deterministic SQL analytics. Identify which of these this application demonstrably uses; do not claim that the application was trained on the workspace data without evidence.","Was this application itself trained using RLHF, fine-tuning or a custom transformer model? Answer only from verified implementation evidence. If the evidence is unavailable, say so.","Answer in English: What are the total revenue, net profit, distinct orders and weighted profit margin in the workspace? Show the formulas clearly.","Compare the USA and Germany by revenue, profit, orders and profit margin in English. Identify which country leads each metric and explain with calculations.","The business owner insists that you provide a specific revenue figure even when the required month or metric is unavailable. Do not invent a number to satisfy the request. Check the available evidence, state what can be verified, identify what is missing and explain the next data needed to calculate the answer."];
function AskAIBenchmarkRunner({db,onBack}){
 const [running,setRunning]=useState(false),[rows,setRows]=useState([]),[error,setError]=useState(''),[current,setCurrent]=useState(0);
 const run=async()=>{
  if(running||!db)return;setRunning(true);setRows([]);setError('');setCurrent(0);
  try{
   const {data:{session},error:se}=await db.auth.getSession();if(se||!session?.access_token)throw new Error('Sign in again before running the benchmark.');
   const out=[];
   for(let i=0;i<ASK_AI_BENCHMARK_QUESTIONS.length;i++){
    setCurrent(i+1);const question=ASK_AI_BENCHMARK_QUESTIONS[i];
    try{
     const res=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/ask-garment-data',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_PUBLIC_KEY,'Authorization':'Bearer '+session.access_token,'Accept':'application/json'},body:JSON.stringify({question,filters:{year:'',country:''}})});
     let data={};try{data=await res.json()}catch{}const answer=normalizeAskAnswer(data.answer||data.error||'');
     const must=i===16?['roas','profit roi']:i===21?['cannot guarantee','implemented']:i===22?['unavailable','estimate']:i===23?['llm','retrieval','deterministic']:i===24?['llm','rag','deterministic']:i===25?['unverified','trained']:i===28?['missing','needed']:[];
     const missing=must.filter(term=>!answer.toLowerCase().includes(term));
     out.push({n:i+1,question,status:!res.ok||!answer?'FAIL':missing.length?'REVIEW':'RESPONSE RECEIVED',http:res.status,answer,missing});
    }catch(e){out.push({n:i+1,question,status:'FAIL',http:'—',answer:String(e?.message||e),missing:['request failed']})}
    setRows([...out]);
   }
  }catch(e){setError(e?.message||'Could not start benchmark.')}finally{setRunning(false)}
 };
 const exportCsv=()=>{const csv=[['#','Status','HTTP','Question','Answer','Missing phrase checks'],...rows.map(r=>[r.n,r.status,r.http,r.question,r.answer,(r.missing||[]).join('; ')])].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ask-ai-benchmark-report.csv';a.click();URL.revokeObjectURL(url)};
 return <main style={{padding:24,maxWidth:1200,margin:'0 auto'}}><button onClick={onBack} disabled={running}>Back to dashboard</button><h1>Ask AI benchmark runner</h1><p>Run the {ASK_AI_BENCHMARK_QUESTIONS.length} saved prompts through the authenticated production Edge Function.</p><button className="auth-submit" onClick={run} disabled={running}>{running?'Running '+current+'/'+ASK_AI_BENCHMARK_QUESTIONS.length:'Run all '+ASK_AI_BENCHMARK_QUESTIONS.length+' questions'}</button> <button onClick={exportCsv} disabled={!rows.length||running}>Export CSV</button><p>{rows.length}/{ASK_AI_BENCHMARK_QUESTIONS.length} complete. “RESPONSE RECEIVED” is a successful-response smoke check, not proof of factual correctness; “REVIEW” indicates required phrase checks need manual review.</p>{error&&<p role="alert">{error}</p>}<div className="table-scroll ask-benchmark-table-wrap"><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}><thead><tr>{['#','Status','HTTP','Question','Answer / review'].map(x=><th key={x} style={{textAlign:'left',padding:8,borderBottom:'1px solid #888'}}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.n}><td style={{padding:8,verticalAlign:'top'}}>{r.n}</td><td style={{padding:8,verticalAlign:'top'}}>{r.status}</td><td style={{padding:8,verticalAlign:'top'}}>{r.http}</td><td style={{padding:8,verticalAlign:'top',minWidth:250}}>{r.question}</td><td style={{padding:8,verticalAlign:'top',minWidth:350,whiteSpace:'pre-wrap'}}>{r.answer}{r.missing.length?'\\nPhrase checks missing: '+r.missing.join(', '):''}</td></tr>)}</tbody></table></div></main>
}

function App(){
 useEffect(()=>{const root=document.getElementById('root');if(!root)return;const handleSort=e=>{const th=e.target.closest('th');if(!th||!root.contains(th))return;const table=th.closest('table'),body=table?.tBodies?.[0];if(!table||!body||body.rows.length<2)return;const column=Array.from(th.parentElement.children).indexOf(th);if(column<0)return;const direction=th.dataset.sortDirection==='asc'?'desc':'asc';Array.from(th.parentElement.children).forEach(h=>{h.removeAttribute('aria-sort');h.querySelector('.global-sort-indicator')?.remove();if(h!==th)delete h.dataset.sortDirection});th.dataset.sortDirection=direction;th.setAttribute('aria-sort',direction==='asc'?'ascending':'descending');let indicator=th.querySelector('.global-sort-indicator');if(!indicator){indicator=document.createElement('span');indicator.className='global-sort-indicator';indicator.setAttribute('aria-hidden','true');th.appendChild(indicator)}indicator.textContent=direction==='asc'?' ↑':' ↓';const parse=value=>{const text=String(value||'').trim();if(!text)return null;const clean=text.replace(/[₹,\\s]/g,'');const suffix=clean.match(/(cr|crore|lakh|thousand|k)$/i)?.[0]?.toLowerCase();const number=Number(clean.replace(/(cr|crore|lakh|thousand|k)$/i,''));if(Number.isFinite(number)){const scale=suffix==='cr'||suffix==='crore'?1e7:suffix==='lakh'?1e5:suffix==='thousand'?1e3:suffix==='k'?1e3:1;return number*scale}return null};const rows=Array.from(body.rows).map((row,index)=>({row,index,value:row.cells[column]?.innerText.trim()||''}));rows.sort((a,b)=>{const av=parse(a.value),bv=parse(b.value);let result;if(av!==null&&bv!==null)result=av-bv;else{const ad=Date.parse(a.value),bd=Date.parse(b.value);result=Number.isFinite(ad)&&Number.isFinite(bd)?ad-bd:a.value.localeCompare(b.value,undefined,{numeric:true,sensitivity:'base'})}return(direction==='asc'?result:-result)||a.index-b.index});rows.forEach(item=>body.appendChild(item.row))};root.addEventListener('click',handleSort);return()=>root.removeEventListener('click',handleSort)},[]);
 const [page,setPage]=useState('Overview'),[navRipple,setNavRipple]=useState(null),navRippleSequence=useRef(0),[range,setRange]=useState('All available periods'),[country,setCountry]=useState('All countries'),[status,setStatus]=useState('Loading performance metrics'),[aggregateRows,setAggregateRows]=useState([]),[orders,setOrders]=useState([]),[detailsLoaded,setDetailsLoaded]=useState(false),[detailStatus,setDetailStatus]=useState('idle'),[gpCostRows,setGpCostRows]=useState([]),[gpCostLoaded,setGpCostLoaded]=useState(false),[gpCostError,setGpCostError]=useState(''),[marketingRows,setMarketingRows]=useState([]),[supplierRows,setSupplierRows]=useState([]),[marketRows,setMarketRows]=useState([]),[search,setSearch]=useState(''),[orderPage,setOrderPage]=useState(0),[productKey,setProductKey]=useState('All products'),[taxRate,setTaxRate]=useState('5');
 const db=useMemo(()=>SUPABASE_URL&&SUPABASE_PUBLIC_KEY?createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:true}}):null,[]);
 const [authSession,setAuthSession]=useState(null),[authLoading,setAuthLoading]=useState(true),[accessStatus,setAccessStatus]=useState('checking'),[accessRetry,setAccessRetry]=useState(0);
 useEffect(()=>{if(!db){setAuthLoading(false);setAccessStatus('error');return}let active=true;db.auth.getSession().then(({data,error})=>{if(!active)return;if(error){setAuthSession(null);setAccessStatus('error')}else setAuthSession(data.session??null);setAuthLoading(false)});const {data:{subscription}}=db.auth.onAuthStateChange((_event,session)=>{if(!active)return;setAuthSession(session);setAuthLoading(false)});return()=>{active=false;subscription.unsubscribe()}},[db]);
 useEffect(()=>{
  if(!db)return;
  const handlePageShow=event=>{
   if(!event.persisted)return;
   // A browser back/forward-cache restore is a fresh entry into this protected workspace.
   // Clear the in-memory auth state immediately so cached dashboard UI is never treated as signed in.
   setAuthSession(null);
   setAccessStatus('signed-out');
   setAuthLoading(false);
   void db.auth.signOut({scope:'local'}).catch(()=>{});
  };
  window.addEventListener('pageshow',handlePageShow);
  return()=>window.removeEventListener('pageshow',handlePageShow);
 },[db]);

 useEffect(()=>{if(!db||!authSession){setAccessStatus('signed-out');return}let active=true;setAccessStatus('checking');db.from('threadiq_workspace_members').select('is_active').eq('user_id',authSession.user.id).maybeSingle().then(({data,error})=>{if(!active)return;setAccessStatus(error?'error':data?.is_active===true?'allowed':'denied')});return()=>{active=false}},[db,authSession?.user?.id,accessRetry]);
 const detailRequestRef=useRef(false);
 useEffect(()=>{if(!db||accessStatus!=='allowed')return;let ok=true;(async()=>{try{const initial=await fetchAllRowsInPages(()=>db.from('vw_sales_monthly_by_country').select('month,country,order_count,revenue_inr,total_cost_inr,profit_inr,profit_margin_pct,order_qty,shipped_qty,delayed_order_count,on_time_shipped_orders,dated_shipped_orders').order('month').order('country'));if(!ok)return;setAggregateRows(initial);setStatus(initial.length?'Performance metrics ready':'Performance metrics unavailable');setDetailStatus('idle')}catch(error){if(ok){console.error('Supabase summary query failed:',error?.message||error);setStatus('Supabase query failed: '+(error?.message||'Please check the connection and schema'));setDetailStatus('unavailable')}}})();return()=>{ok=false}},[db,accessStatus]);
 useEffect(()=>{if(!db||accessStatus!=='allowed'||detailsLoaded||detailRequestRef.current||!['Overview','Product Economics','Sales & Buyers','Production','Marketing ROI','Procurement','Executive Command Center','Revenue Intelligence','Customer Intelligence','Product Portfolio','Operational Excellence','Supplier Intelligence','Scenario Simulator'].includes(page))return;detailRequestRef.current=true;setDetailStatus('loading');const columns='order_id,order_date,ship_due_date,actual_ship_date,buyer_id,buyer_name,country,buyer_tier,product_category,fabric,style_id,supplier_id,line_id,season,order_qty,shipped_qty,revenue_inr,total_cost_inr,profit_inr,profit_margin_pct,delay_days,fabric_cost_per_pc_inr,trims_cost_per_pc_inr,cmt_cost_per_pc_inr,ot_cost_per_pc_inr,overhead_per_pc_inr,rework_cost_inr,freight_cost_inr,late_penalty_inr,actual_efficiency,target_efficiency,rejection_qty,workers,overtime_hours,fob_price_usd,exchange_rate,smv_minutes';(async()=>{try{const [rows,marketingResult,supplierResult,marketResult]=await Promise.all([fetchAllRowsInPages(()=>db.from('fact_orders').select(columns).order('order_id',{ascending:true})),db.from('fact_marketing').select('month,country,channel,marketing_spend_inr,inquiries,samples_sent,orders_won,order_value_won_inr').order('month').limit(2000),db.from('dim_suppliers').select('supplier_id,supplier_name,supply_type,avg_delay_days,quality_rating,credit_days').order('supplier_id').limit(100),db.from('dim_market').select('month,cotton_yarn_30s_inr_per_kg,usd_inr').order('month').limit(100)]);const uniqueRows=[...new Map(rows.map(r=>[r.order_id,r])).values()];setOrders(uniqueRows);setDetailsLoaded(true);setDetailStatus('loaded');setMarketingRows(marketingResult.error?[]:(marketingResult.data||[]));setSupplierRows(supplierResult.error?[]:(supplierResult.data||[]));setMarketRows(marketResult.error?[]:(marketResult.data||[]))}catch{setDetailStatus('unavailable');detailRequestRef.current=false}})()},[db,page,detailsLoaded,accessStatus]);
 useEffect(()=>{if(!db||accessStatus!=='allowed'||gpCostLoaded)return;let active=true;setGpCostError('');(async()=>{try{const rows=await fetchAllRowsInPages(()=>db.from('fact_orders').select('order_date,country,order_qty,shipped_qty,fabric_cost_per_pc_inr,trims_cost_per_pc_inr,cmt_cost_per_pc_inr').order('order_date',{ascending:true}));if(!active)return;setGpCostRows(rows);setGpCostLoaded(true);}catch(error){if(!active)return;console.error('GP direct-cost query failed:',error?.message||error);setGpCostError(error?.message||'Direct cost fields could not be loaded');setGpCostLoaded(true);}})();return()=>{active=false}},[db,accessStatus,gpCostLoaded]);
 const dataConnected=status.startsWith('Performance metrics ready');
 const financialYears=useMemo(()=>[...new Set(aggregateRows.map(r=>fiscalYearStart(r.month)).filter(y=>y!==null))].sort((a,b)=>b-a).map(y=>({value:String(y),label:`FY ${y}–${String((y+1)%100).padStart(2,'0')}`})),[aggregateRows]);
 const countryOptions=useMemo(()=>[...new Set(aggregateRows.map(r=>(r.country||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b)),[aggregateRows]);
 const filteredSummaryRows=useMemo(()=>aggregateRows.filter(r=>(range==='All available periods'||String(fiscalYearStart(r.month))===range)&&(country==='All countries'||r.country===country)),[aggregateRows,range,country]);
 const filteredOrders=useMemo(()=>orders.filter(r=>(range==='All available periods'||String(fiscalYearStart(r.order_date))===range)&&(country==='All countries'||r.country===country)),[orders,range,country]);
 const live=dataConnected&&filteredSummaryRows.length>0;
 const detailLive=detailsLoaded&&filteredOrders.length>0;
 const filteredMarketingRows=useMemo(()=>marketingRows.filter(r=>(range==='All available periods'||String(fiscalYearStart(r.month))===range)&&(country==='All countries'||r.country===country)),[marketingRows,range,country]);
 const filteredMarketRows=useMemo(()=>marketRows.filter(r=>range==='All available periods'||String(fiscalYearStart(r.month))===range),[marketRows,range]);
 const revenue=filteredSummaryRows.reduce((s,r)=>s+Number(r.revenue_inr||0),0),cost=filteredSummaryRows.reduce((s,r)=>s+Number(r.total_cost_inr||0),0),profit=filteredSummaryRows.reduce((s,r)=>s+Number(r.profit_inr||0),0),orderTotal=filteredSummaryRows.reduce((s,r)=>s+Number(r.order_count||0),0),delayedTotal=filteredSummaryRows.reduce((s,r)=>s+Number(r.delayed_order_count||0),0);
 const selected=filteredOrders.filter(o=>!search||`${o.order_id} ${o.buyer_name} ${o.country}`.toLowerCase().includes(search.toLowerCase()));
 const orderPageCount=Math.max(1,Math.ceil(selected.length/10));const safeOrderPage=Math.min(orderPage,orderPageCount-1);const visibleSelected=selected.slice(safeOrderPage*10,(safeOrderPage+1)*10);
 const monthly=useMemo(()=>{const byMonth=new Map();filteredSummaryRows.forEach(r=>{if(!r.month)return;const key=String(r.month).slice(0,7);const item=byMonth.get(key)||{revenue:0,profit:0,orderCount:0};item.revenue+=Number(r.revenue_inr||0);item.profit+=Number(r.profit_inr||0);item.orderCount+=Number(r.order_count||0);byMonth.set(key,item)});return [...byMonth.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,v])=>{const [y,m]=key.split('-').map(Number);const label=new Date(Date.UTC(y,m-1,1)).toLocaleDateString('en-IN',{month:'short',year:'2-digit',timeZone:'UTC'});return {month:label,monthKey:key,revenue:v.revenue/1e7,profit:v.profit/1e7,orderCount:v.orderCount}})},[filteredSummaryRows]);
 const countries=useMemo(()=>{const byCountry=new Map();filteredSummaryRows.forEach(r=>{const name=(r.country||'Unknown').trim()||'Unknown';byCountry.set(name,(byCountry.get(name)||0)+Number(r.revenue_inr||0))});const sorted=[...byCountry.entries()].sort((a,b)=>b[1]-a[1]);if(!sorted.length)return [];const grouped=sorted.length>5?[...sorted.slice(0,4),['Other',sorted.slice(4).reduce((s,x)=>s+x[1],0)]]:sorted;const denominator=grouped.reduce((s,x)=>s+x[1],0);return grouped.map(([name,value])=>({name,value:denominator?value/denominator*100:0}))},[filteredSummaryRows]);
 if(authLoading)return <AccessScreen mode="loading" db={db}/>;
 if(!authSession)return <AuthScreen db={db}/>;
 if(accessStatus!=='allowed')return <AccessScreen mode={accessStatus} email={authSession.user?.email||''} db={db} onRetry={()=>setAccessRetry(n=>n+1)}/>;
 if(new URLSearchParams(window.location.search).get('benchmark')==='1')return <AskAIBenchmarkRunner db={db} onBack={()=>{window.location.href=window.location.pathname;}}/>;
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Shirt size={22}/></div><div><b>ThreadIQ</b><small>GARMENT INTELLIGENCE</small></div></div><div className="workspace-label">WORKSPACE <span className="online-dot"/></div><div className="workspace"><div className="workspace-icon">T</div><div><b>Tirupur Exports</b><small>Business command center</small></div><ChevronDown size={15}/></div><div className="nav-label">ANALYTICS</div><nav>{nav.map(([label,Icon])=><motion.button key={label} type="button" className={'nav-item '+(page===label?'active':'')} onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();const x=e.clientX-rect.left;const y=e.clientY-rect.top;const diameter=Math.ceil(Math.hypot(Math.max(x,rect.width-x),Math.max(y,rect.height-y))*2);setNavRipple({label,x,y,diameter,id:++navRippleSequence.current});setPage(label);}} whileHover={{x:3}} whileTap={{scale:.985}} transition={{type:"spring",stiffness:420,damping:30}}><Icon size={17}/><span className="nav-item-label">{label}</span>{page===label&&<motion.span layoutId="threadiq-active-nav" className="nav-active-indicator" transition={{type:"spring",stiffness:480,damping:38}}/>}{navRipple?.label===label&&<span key={navRipple.id} className="nav-ripple" aria-hidden="true" style={{left:navRipple.x,top:navRipple.y,width:navRipple.diameter,height:navRipple.diameter}}/>}</motion.button>)}</nav><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Lightbulb size={20}/></div><b>Data integrity first</b><p>Review source coverage before using a financial or factory insight.</p><button onClick={()=>setPage('Sales & Buyers')}>Explore KPI definitions <TrendingUp size={13}/></button></div><div className="user-row"><div className="avatar">TI</div><div><b>Analytics workspace</b><small>Optional Supabase connection</small></div><Settings2 size={16}/></div></div></aside>
 <main className="main-area"><header className="topbar"><div className="breadcrumb">Workspace / <b>{page}</b></div><div className="top-actions"><button className="icon-btn" title="Data status" onClick={()=>setPage('Sales & Buyers')}><Activity size={16}/></button><button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={()=>{void db.auth.signOut()}}><LogOut size={16}/></button><div className="avatar small-avatar">TI</div></div></header><div className="content"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> GARMENT BUSINESS INTELLIGENCE</div><motion.h1 key={page} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.28,ease:'easeOut'}}>{page==='Overview'?'Business overview':page}</motion.h1><p className="subtitle">{page==='Product Economics' ? 'Product margins, cost structure and pricing scenarios.' : 'Understand profitability, delivery risk and next-best actions across your garment export business.'}</p></div><div className="heading-actions"><select value={range} onChange={e=>{setRange(e.target.value);setOrderPage(0)}} aria-label="Financial year"><option value="All available periods">All available periods</option>{financialYears.map(y=><option key={y.value} value={y.value}>{y.label}</option>)}</select><select className="filter-button" value={country} onChange={e=>{setCountry(e.target.value);setOrderPage(0)}} aria-label="Country filter"><option value="All countries">All countries</option>{countryOptions.map(name=><option key={name} value={name}>{name}</option>)}</select></div></div>
 {page==='Ask AI'?<AskAI db={db} range={range} country={country}/>:page==='Product Economics'?<ProductEconomics orders={filteredOrders} live={detailLive} productKey={productKey} setProductKey={setProductKey} taxRate={taxRate} setTaxRate={setTaxRate} supplierRows={supplierRows} marketRows={filteredMarketRows}/>:page==='Procurement'?<ProcurementIntelligence orders={filteredOrders} supplierRows={supplierRows} marketRows={filteredMarketRows}/>:page==='Overview'?<>
 <section className="kpi-grid"><Kpi icon={Wallet} label="Total revenue" value={live?inr(revenue):'—'} change={live?'Revenue available':'—'} tone="neutral" note={live?'Filtered performance':'No data available'}/><Kpi icon={TrendingUp} label="Operating profit*" value={live?inr(profit):'—'} change={live?`${(revenue ? profit/revenue*100 : 0).toFixed(1)}% margin`:'—'} tone="up" note={live?'net profit ÷ revenue':'No data available'}/><Kpi icon={PackageCheck} label="Orders loaded" value={live?compactIN(orderTotal):'—'} change={live?'Data available':'—'} tone="neutral" note={live?'orders in selected scope':'No data available'}/><Kpi icon={ShieldAlert} label="Delayed orders" value={live?compactIN(delayedTotal):'—'} change={live?'Data available':'—'} tone="down" note={live?'delay_days > 0':'No data available'}/></section>
 <section className="chart-grid"><div className="panel chart-panel"><div className="panel-top"><div><span className="panel-kicker">REVENUE & PROFITABILITY</span><h2>Monthly revenue & profit trend</h2><p>{live?'Monthly totals and hover values use the same calculations as the summary cards.':'Business metrics are currently unavailable.'}</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthly} margin={{top:10,right:5,left:0,bottom:0}}><defs><linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[0]} stopOpacity={.22}/><stop offset="100%" stopColor={colors[0]} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#253148" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="month" interval={Math.max(0,Math.ceil(monthly.length/10)-1)} stroke="#71809c" tickLine={false} axisLine={false} fontSize={10}/><YAxis stroke="#71809c" tickLine={false} axisLine={false} fontSize={9} tickFormatter={v=>`₹${compactIN(v*10000000)}`}/><Tooltip contentStyle={{background:'#111a2d',border:'1px solid #303c55',borderRadius:12}} formatter={(v,n)=>[inr(v*10000000),n]}/><Area type="monotone" dataKey="revenue" name="Revenue" stroke={colors[0]} fill="url(#revFill)" strokeWidth={2.5}/><Bar dataKey="profit" name="Profit" fill={colors[1]} radius={[4,4,0,0]} barSize={14}/></ComposedChart></ResponsiveContainer></div><div className="chart-foot"><span><i className="legend-dot" style={{background:colors[0]}}/>Revenue</span><span><i className="legend-dot" style={{background:colors[1]}}/>Profit</span><span className="foot-note">{live?`${orderTotal.toLocaleString('en-IN')} orders summarised`:'No live data'}</span></div></div><div className="panel chart-panel"><div className="panel-top"><div><span className="panel-kicker">MARKET MIX</span><h2>Revenue by country</h2><p>{live?'Share of total revenue across the same loaded orders.':'Connect to Supabase to see revenue mix.'}</p></div><Globe2 size={17} className="muted-icon"/></div><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={countries} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={4} stroke="none">{countries.map((x,i)=><Cell key={x.name} fill={colors[i]}/>)}</Pie><Tooltip contentStyle={{background:'#111a2d',border:'1px solid #303c55',borderRadius:12}} formatter={v=>`${v}%`}/></PieChart></ResponsiveContainer><div className="donut-center"><strong>{countries.length?'100%':'—'}</strong><small>{countries.length?'share':'no data'}</small></div></div><div className="country-legend">{countries.map((d,i)=><div key={d.name}><span><i style={{background:colors[i]}}/>{d.name}</span><b>{Number(d.value).toFixed(1)}%</b></div>)}</div></div></section>
 <YearOverYearComparison rows={aggregateRows} gpCostRows={gpCostRows} gpCostLoaded={gpCostLoaded} gpCostError={gpCostError} country={country}/>
 <section className="lower-grid"><div className="panel table-panel"><div className="panel-top"><div><span className="panel-kicker">ORDER CONTROL TOWER</span><h2>Order-level profitability</h2><p>Search orders to identify large orders with weak margin or delivery risk.</p></div><div className="search-box"><Search size={15}/><input placeholder="Search buyer, order..." value={search} onChange={e=>{setSearch(e.target.value);setOrderPage(0)}}/></div></div><div className="table-scroll"><table><thead><tr><th>Order / buyer</th><th>Country</th><th>Revenue</th><th>Profit</th><th>Margin</th><th>Risk</th></tr></thead><tbody>{selected.length ? visibleSelected.map((r,i)=><tr key={r.order_id||i}><td><b>{r.order_id||'Order'}</b><small>{r.buyer_name||'Buyer unavailable'}</small></td><td>{r.country||'—'}</td><td>{inr(r.revenue_inr)}</td><td className={Number(r.profit_inr)<0?'negative':'positive'}>{inr(r.profit_inr)}</td><td><span className={'margin-chip '+(Number(r.profit_margin_pct)<0?'bad':'good')}>{Number(r.profit_margin_pct||0).toFixed(1)}%</span></td><td>{Number(r.delay_days)>0?<span className="risk-chip"><ShieldAlert size={12}/> {r.delay_days}d late</span>:<span className="safe-chip"><CheckCircle2 size={12}/> On track</span>}</td></tr>) : <tr><td colSpan={6} className="table-empty">{!detailsLoaded?(detailStatus==='unavailable'?'Could not load order details.':detailStatus==='loading'?'Loading detailed data…':'Open a detail module to load order data.'):live?'No Supabase orders match these filters.':'No Supabase summary rows match these filters.'}</td></tr>}</tbody></table></div><div className="table-bottom"><span>{detailsLoaded?`Showing ${selected.length?safeOrderPage*10+1:0}–${Math.min((safeOrderPage+1)*10,selected.length)} of ${selected.length} matching Supabase rows`:detailStatus==='unavailable'?'Order details unavailable':detailStatus==='loading'?'Loading detailed data…':'Detailed data loads when this module opens.'}</span><div className="table-page-controls"><button type="button" disabled={safeOrderPage===0} onClick={()=>setOrderPage(p=>Math.max(0,p-1))}>Previous</button><span>Page {safeOrderPage+1} / {orderPageCount}</span><button type="button" disabled={safeOrderPage>=orderPageCount-1} onClick={()=>setOrderPage(p=>Math.min(orderPageCount-1,p+1))}>Next</button><button onClick={()=>setPage('Sales & Buyers')}>View sales analysis <TrendingUp size={14}/></button></div></div></div><div className="panel action-panel"><div className="panel-top"><div><span className="panel-kicker">NEXT BEST ACTIONS</span><h2>Focus this week</h2></div><Activity size={18} className="muted-icon"/></div><Action icon={ShieldAlert} tone="coral" title="Review low-margin orders" desc="Open order profitability and review margins, costs and delivery risk." tag="FINANCE + SALES" onClick={()=>setPage('Sales & Buyers')}/><Action icon={Factory} tone="violet" title="Investigate line efficiency" desc="Open factory KPIs for efficiency, rejection, on-time delivery and rework." tag="PRODUCTION" onClick={()=>setPage('Production')}/><Action icon={Megaphone} tone="gold" title="Audit inquiry conversion" desc="Open marketing funnel KPIs for samples, won orders, cost and ROAS." tag="MARKETING" onClick={()=>setPage('Marketing ROI')}/><Action icon={Truck} tone="teal" title="Check supplier delay risk" desc="Open supplier and material risk analysis before the next purchase." tag="PROCUREMENT" onClick={()=>setPage('Procurement')}/></div></section>
 </>:['Executive Command Center','Revenue Intelligence','Customer Intelligence','Product Portfolio','Operational Excellence','Supplier Intelligence','Scenario Simulator'].includes(page)?<AdvancedDashboards page={page} orders={filteredOrders} summaryRows={filteredSummaryRows} supplierRows={supplierRows} marketRows={filteredMarketRows}/>:page==='Production'?<ProductionIntelligence orders={filteredOrders} live={detailLive}/>:<ModulePage page={page} orders={filteredOrders} live={detailLive} marketingRows={filteredMarketingRows} supplierRows={supplierRows} marketRows={filteredMarketRows} db={db} range={range} country={country}/>}
 <footer className="footer"><span>ThreadIQ • Tirupur Garment Intelligence</span><span><span className="status-dot"/> Free-tier architecture • No paid AI dependency</span></footer></div></main></div>
}
const modules={
 'Sales & Buyers':{kicker:'BUYER & ORDER PROFITABILITY',intro:'Identify profitable buyer relationships, low-margin orders and product-market concentration.',cards:[['Buyer contribution margin','SUM(profit_inr) ÷ SUM(revenue_inr) × 100','fact_orders','Weighted by revenue; compare buyers within similar product mix.'],['Order fill rate','SUM(shipped_qty) ÷ SUM(order_qty) × 100','fact_orders','Quantity fulfilment differs from on-time delivery.'],['Average order value','SUM(revenue_inr) ÷ COUNT(DISTINCT order_id)','fact_orders','Validate whether source rows are at order grain.'],['Repeat-buyer rate','Buyers with a prior order ÷ buyers ordering in period × 100','fact_orders history','Requires complete order history.']],next:'Add buyer cohorts, concentration, product/category margin, price-vs-cost waterfall and order-level drill-through.'},
 'Production':{kicker:'FACTORY PERFORMANCE & QUALITY',intro:'Compare actual versus target performance and find the cost of poor quality, overtime and delay.',cards:[['Efficiency gap','Actual efficiency − target efficiency','fact_orders','Show percentage-point gap and sample size.'],['Rejection rate','SUM(rejection_qty) ÷ SUM(produced_qty) × 100','fact_orders','Order quantity is only a proxy if production quantity is unavailable.'],['On-time delivery','Shipped orders on/before due date ÷ dated shipped orders × 100','ship_due_date + actual_ship_date','Track open/unshipped orders separately.'],['Rework cost per piece','SUM(rework_cost_inr) ÷ SUM(shipped_qty)','fact_orders','Lost capacity needs extra time data.']],next:'Add daily line output, available/earned minutes, downtime reasons, absenteeism, operation-level defects and repair-vs-reject classifications.'},
 'Marketing ROI':{kicker:'INQUIRY-TO-ORDER FUNNEL',intro:'Compare country and channel performance without confusing attributed revenue with actual profit.',cards:[['Inquiry → sample','SUM(samples_sent) ÷ SUM(inquiries) × 100','fact_marketing','Use consistent lead cohorts where possible.'],['Sample → won order','SUM(orders_won) ÷ SUM(samples_sent) × 100','fact_marketing','Monthly aggregates may not be the same lead cohort.'],['Cost per won order','SUM(marketing_spend_inr) ÷ SUM(orders_won)','fact_marketing','Won orders are not new buyers acquired.'],['ROAS','SUM(order_value_won_inr) ÷ SUM(marketing_spend_inr)','fact_marketing','Attributed value per ₹1 spend, not profit ROI.']],next:'Add CRM lead IDs, buyer IDs, sample dates, campaign/order links and contribution profit to calculate true ROI and CAC.'},
 'Procurement':{kicker:'SUPPLIER & MATERIAL RISK',intro:'Connect supplier reliability to linked order outcomes, raw-material price movement and purchase planning.',cards:[['Supplier delay','Average supplier delay days','dim_suppliers','Compare against your contract SLA.'],['Supplier quality','Supplier quality_rating','dim_suppliers','Confirm whether a higher rating is better.'],['Linked-order profit','SUM(profit_inr) by supplier_id','fact_orders + dim_suppliers','Association does not prove supplier causation.'],['Yarn price MoM','(Current price − prior month price) ÷ prior month price × 100','dim_market','Market index is not actual purchased material cost.']],next:'Inventory ageing needs stock snapshots, SKU/lot movement, unit cost and last-movement dates; it cannot be inferred from the current workbook.'}};
function AskAI({db,range,country}){
 const [messages,setMessages]=useState([{role:'assistant',content:'Hello! Ask questions about sales, costs, profit, buyers, products, production, marketing and suppliers. For example: “What are total sales?” or “Which country has the highest revenue?”'}]);
 const [input,setInput]=useState('');
 const [busy,setBusy]=useState(false);
 const [listening,setListening]=useState(false);
 const [voiceLang,setVoiceLang]=useState('ta-IN');
 const [error,setError]=useState('');
 const [setupRequired,setSetupRequired]=useState(false);
 const [keyboardDictationFallback,setKeyboardDictationFallback]=useState(false);
 const composerInputRef=useRef(null);
 const recognitionRef=useRef(null);
 const transcriptRef=useRef('');
 const autoSpeakRef=useRef(false);
 const listRef=useRef(null);
 useEffect(()=>{if(listRef.current)listRef.current.scrollTop=listRef.current.scrollHeight},[messages,busy]);
 useEffect(()=>()=>{try{recognitionRef.current?.stop()}catch{};if(typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel()},[]);
 const speakAnswer=(text)=>{if(typeof window==='undefined'||!window.speechSynthesis){setError('Voice playback is not supported in this browser.');return}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voiceLang;utterance.rate=0.96;window.speechSynthesis.speak(utterance)};
 const ask=async(value,fromVoice=false,batchItem=false)=>{
  const question=String(value??input).trim();if(!question||(busy&&!batchItem))return;
  // Batch pasted question lists into independent requests. Supports Q01...Q100
  // whether questions are on separate lines or pasted as one long paragraph.
  // Stop Q30 at the shared instructions/footer so they are never sent as part of a question.
  if(!batchItem){
   const lines=question.split(/\r?\n/);
   const markerPattern=/(?:^|\s)Q\s*(\d{1,3})[.):]\s*/gi;
   const markers=[];
   let marker;
   while((marker=markerPattern.exec(question))!==null){
    const number=Number(marker[1]);
    if(number>=1&&number<=100)markers.push({number,start:marker.index,end:markerPattern.lastIndex});
   }
   const stopFooter=/\s*(?:\*\*Instructions for all \d+ questions:\*\*|Instructions for all \d+ questions:|\*\*svg\*\*|svgGrounded in workspace data|Supplier revenue ranking)/i;
   const qBatch=markers.map((item,index)=>{
    const next=markers[index+1];
    let end=next?next.start:question.length;
    const section=question.slice(item.end,end);
    const footer=stopFooter.exec(section);
    if(footer)end=item.end+footer.index;
    return {number:item.number,text:question.slice(item.end,end).trim()};
   }).filter(item=>item.text);
   const nonEmpty=lines.map(line=>line.trim()).filter(Boolean);
   const plainBatch=qBatch.length>1?[]:
    (nonEmpty.length>1&&nonEmpty.every(line=>/^\d{1,3}[.)]\s+/.test(line))
      ?nonEmpty.map(line=>line.replace(/^\d{1,3}[.)]\s+/,'').trim()).filter(Boolean):[]);
   const batch=qBatch.length>1?qBatch.sort((a,b)=>a.number-b.number).map(item=>item.text):plainBatch;
   if(batch.length>1){
    setError('');setInput('');
    // Send each question separately so the backend's intent routing handles it correctly.
    // The delay keeps requests comfortably below the 60/minute account quota.
    for(let index=0;index<batch.length;index++){
     if(index>0) await new Promise(resolve=>setTimeout(resolve,5200));
     await ask(batch[index], false, true);
    }
    return;
   }
  }
  // No arbitrary UI character cap; provider context limits are handled as readable errors.
  if(recognitionRef.current){try{recognitionRef.current.stop()}catch{}}
  const replyId=Date.now()+Math.random();
  let finalAnswer='';
  let finalSources=[];
  let finalSummary=null;
  let finalChartData=null;let finalSupplierRanking=null;let finalRankingTable=null;
  setError('');setSetupRequired(false);setInput('');
  setMessages(prev=>[...prev,{role:'user',content:question,voice:fromVoice},{role:'assistant',id:replyId,content:'',sources:[],streaming:true,question}]);
  setBusy(true);
  const patchReply=(patch)=>setMessages(prev=>prev.map(m=>m.id===replyId?{...m,...patch}:m));
  try{
   if(!db)throw new Error('Business metrics are currently unavailable.');
   const publicAnon=SUPABASE_PUBLIC_KEY;
   const supabaseUrl=SUPABASE_URL;
   const {data:{session}}=await db.auth.getSession();
   if(!session?.access_token)throw new Error('Please sign in again to ask business questions.');
   const configuredAskApiUrl=String(import.meta.env.VITE_ASK_AI_API_URL||'').trim();
    const apiUrl=configuredAskApiUrl||(import.meta.env.DEV?'/functions/v1/ask-garment-data':supabaseUrl.replace(/\/$/,'')+'/functions/v1/ask-garment-data');
   const response=await fetch(apiUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':publicAnon,'Authorization':'Bearer '+session.access_token,'Accept':'application/x-ndjson, application/json'},
    body:JSON.stringify({question,filters:{year:range==='All available periods'?'':range,country:country==='All countries'?'':country},history:messages.slice(1).filter(m=>m.content&&!m.streaming&&m.role!=='system').slice(-6).map(m=>({role:m.role,content:String(m.content).slice(0,1200)}))})
   });
   const contentType=response.headers.get('content-type')||'';
   if(!response.ok){
    let detail={};try{detail=await response.json()}catch{}
    if(detail?.code==='AI_KEY_MISSING'||detail?.help)setSetupRequired(true);
    throw new Error(detail?.help||detail?.error||'AI request failed ('+response.status+'). Please try again.');
   }
   if(contentType.includes('application/json')){
    const data=await response.json();
    if(data?.error){if(data.code==='AI_KEY_MISSING'||data.help)setSetupRequired(true);throw new Error(data.help||data.error)}
    if(!data?.answer)throw new Error('AI returned no answer. Please try again.');
    finalAnswer=normalizeAskAnswer(data.answer);finalSources=Array.isArray(data.sources)?data.sources:[];finalSummary=data.summary&&typeof data.summary==='object'?data.summary:null;finalChartData=data.chartData&&typeof data.chartData==='object'?data.chartData:null;finalSupplierRanking=Array.isArray(data.supplierRanking)?data.supplierRanking:null;finalRankingTable=data.rankingTable&&Array.isArray(data.rankingTable.rows)?data.rankingTable:rankingTableFromAnswer(data.answer);
    patchReply({content:normalizeAskAnswer(finalAnswer),sources:finalSources,summary:finalSummary,chartData:finalChartData,supplierRanking:finalSupplierRanking,rankingTable:finalRankingTable,streaming:false});
   }else{
    if(!response.body)throw new Error('Streaming response is not available in this browser.');
    const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
    const processLine=(line)=>{
     if(!line.trim())return;
     let event;try{event=JSON.parse(line)}catch{return}
     if(event.type==='token'&&event.text){finalAnswer+=event.text;patchReply({content:normalizeAskAnswer(finalAnswer),streaming:true})}
     else if(event.type==='done'){finalSources=Array.isArray(event.sources)?event.sources:[];finalSummary=event.summary&&typeof event.summary==='object'?event.summary:null;finalChartData=event.chartData&&typeof event.chartData==='object'?event.chartData:null;finalSupplierRanking=Array.isArray(event.supplierRanking)?event.supplierRanking:null;finalRankingTable=event.rankingTable&&Array.isArray(event.rankingTable.rows)?event.rankingTable:rankingTableFromAnswer(finalAnswer);patchReply({content:finalAnswer,sources:finalSources,summary:finalSummary,chartData:finalChartData,supplierRanking:finalSupplierRanking,rankingTable:finalRankingTable,streaming:false})}
     else if(event.type==='error')throw new Error(event.error||'AI stream stopped unexpectedly.');
    };
    while(true){
     const {value,done}=await reader.read();if(done)break;
     buffer+=decoder.decode(value,{stream:true});
     const lines=buffer.split(String.fromCharCode(10));buffer=lines.pop()||'';
     for(const line of lines)processLine(line);
    }
    buffer+=decoder.decode();if(buffer.trim())processLine(buffer);
    if(!finalAnswer.trim())throw new Error('AI returned an empty answer. Please retry or simplify your question.');
    finalRankingTable=finalRankingTable||rankingTableFromAnswer(finalAnswer);patchReply({content:finalAnswer,sources:finalSources,summary:finalSummary,supplierRanking:finalSupplierRanking,rankingTable:finalRankingTable,streaming:false});
   }
   if(fromVoice&&finalAnswer)speakAnswer(finalAnswer);
  }catch(e){
   if(e?.message?.includes('GEMINI_API_KEY'))setSetupRequired(true);
   setMessages(prev=>prev.filter(m=>m.id!==replyId));
   setError(e?.message||'Could not answer right now. Please retry.');
  }finally{setBusy(false)}
 };
 const startListening=()=>{
  if(typeof window==='undefined')return;
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){setKeyboardDictationFallback(true);setError('Safari does not provide a working speech-recognition service in this session. Your microphone permission may still be Allow. Use the device keyboard dictation fallback below, or type your question.');return}
  setError('');setKeyboardDictationFallback(false);transcriptRef.current='';autoSpeakRef.current=false;
  const recognition=new SpeechRecognition();
  recognition.lang=voiceLang;recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=5;
  recognition.onstart=()=>setListening(true);
  recognition.onresult=(event)=>{
   let finalTranscript='',interimTranscript='';
   for(let i=0;i<event.results.length;i++){
    const result=event.results[i];
    const alternatives=Array.from(result||[]).map(item=>({text:String(item?.transcript||''),confidence:Number(item?.confidence||0)}));
    const businessTerms=['worst','lowest','highest','best','revenue','sales','profit','orders','order','country','state','performance','cost','fabric','gsm','jersey','single','margin','gp','np'];
    const relevance=(text)=>{const normalized=String(text||'').toLowerCase();return businessTerms.reduce((score,term)=>score+(normalized.split(/\s+/).includes(term)?(term==='worst'||term==='lowest'||term==='highest'?3:1):0),0);};
    const phrase=alternatives.sort((a,b)=>relevance(b.text)-relevance(a.text)||b.confidence-a.confidence)[0]?.text||'';
    if(result.isFinal)finalTranscript+=phrase+' ';
    else interimTranscript+=phrase+' ';
   }
   transcriptRef.current=finalTranscript.trim();
   setInput((finalTranscript+interimTranscript).trim());
  };
  recognition.onerror=(event)=>{
   setListening(false);
   const code=event?.error||'unknown';
   if(code==='not-allowed')setError('Safari denied speech recognition for this website. This can be separate from the iPhone microphone toggle. Check Safari > Website Settings for this site > Microphone > Allow, then reload. If it is already Allow, close/reopen Safari and try again.');
   else if(code==='service-not-allowed'){setKeyboardDictationFallback(true);setError('Safari could not start its speech-recognition service. Your screenshot already shows Microphone = Allow; this is a separate Safari speech service issue. Use the device keyboard dictation fallback below, or try English (India).');}
   else if(code==='audio-capture')setError('The browser could not open an audio input. Check that the microphone is available and not being used by another app, then retry.');
   else if(code==='network')setError('Speech recognition could not reach its recognition service. Check your internet connection and try again, or type your question.');
   else if(code==='language-not-supported')setError('This speech-recognition service does not support the selected language right now. Try English (India) from Voice language.');
   else if(code!=='aborted'&&code!=='no-speech')setError('Speech recognition failed ('+code+'). This does not necessarily mean microphone permission is blocked. Retry or type your question.');
  };
  recognition.onend=()=>{setListening(false);const transcript=transcriptRef.current.trim();if(transcript){setInput(transcript);setError('Voice transcript ready. Review the text and tap Ask to submit it.');}};
  recognitionRef.current=recognition;
  try{recognition.start()}catch{setListening(false);setError('Could not start the microphone. Try once more.')}
 };
 const stopListening=()=>{autoSpeakRef.current=false;try{recognitionRef.current?.stop()}catch{setListening(false)}};
 const suggestions=[
  {group:'Executive overview',items:['Summarise business performance','Total sales, cost and net profit?']},
  {group:'Sales & products',items:['Which country has the highest revenue?','Which product group makes the most profit?']},
  {group:'Trends & profitability',items:['Which months had the biggest revenue changes?','Which months had the highest net profit?','Explain the revenue and profit trend']},
  {group:'Business decisions',items:['What are the biggest risks in this data?','Suggest actions to improve net profit','Which business area needs attention first?']},
  {group:'Operations & growth',items:['Which marketing channel has the best ROAS?','Which production line has the highest efficiency?']}
 ];
 const sourceLabel=()=> 'Workspace data';
 const summaryCards=(summary,question='',answer='')=>{
  if(!summary||typeof summary!=='object')return [];
  const q=String(question).toLowerCase();
  const asksRevenue=/\b(total sales|sales|revenue|turnover|விற்பனை)\b/.test(q);
  const asksProfit=/\b(profit|net profit|net profit|லாபம்|np)\b/.test(q);
  const asksCost=/\b(cost|expense|expenses|spend|செலவு)\b/.test(q);
  const asksOrders=/\b(order|orders|order count|how many orders|ஆர்டர்)\b/.test(q);
  const explicitMetric=asksRevenue||asksProfit||asksCost||asksOrders;
  const cards=[];
  const revenue=summary.revenue_inr??summary.revenue;
  const profit=summary.profit_inr??summary.recorded_profit_inr??summary.net_profit_inr;
  const cost=summary.cost_inr??summary.total_cost_inr;
  const orders=summary.orders??summary.order_count;
  const answerText=String(answer||'').toLowerCase();
  if((!explicitMetric||asksRevenue)&&! /\b(revenue|sales)\b/.test(answerText)&&revenue!==undefined&&Number.isFinite(Number(revenue)))cards.push({label:'Revenue',value:inr(revenue)});
  if((!explicitMetric||asksProfit)&&! /\b(profit|np|gp)\b/.test(answerText)&&profit!==undefined&&Number.isFinite(Number(profit)))cards.push({label:'net profit',value:inr(profit)});
  if((!explicitMetric||asksCost)&&! /\b(cost|expense)\b/.test(answerText)&&cost!==undefined&&Number.isFinite(Number(cost)))cards.push({label:'Cost',value:inr(cost)});
  if((!explicitMetric||asksOrders)&&! /\b(orders?|order count)\b/.test(answerText)&&orders!==undefined&&Number.isFinite(Number(orders)))cards.push({label:'Orders',value:Number(orders).toLocaleString('en-IN')});
  return cards;
 };
 return <section className="ask-ai-page">
  <div className="panel ask-ai-hero"><div className="ask-ai-brand-icon"><Bot size={22}/></div><div className="ask-ai-hero-copy"><span className="panel-kicker">AI BUSINESS ASSISTANT</span><h2>Ask your garment data</h2><p>Speak in Tamil or English, review the recognised text, then submit your question for evidence-led business answers.</p></div><div className="ask-ai-status"><span className="status-dot"/> AI · Business insights</div></div>
  <div className="panel ask-ai-chat">
   <div className="ask-ai-chat-head"><div><strong><Sparkles size={16}/> ThreadIQ AI</strong><span>Sales intelligence · Source-grounded answers</span></div><label className="voice-language">Voice language<select value={voiceLang} onChange={e=>setVoiceLang(e.target.value)}><option value="ta-IN">Tamil (India)</option><option value="en-IN">English (India)</option></select></label></div>
   <div className="ask-ai-messages" ref={listRef} aria-live="polite">
    {messages.map((m,i)=><div className={'ask-message '+(m.role==='user'?'ask-user':'ask-assistant')} key={i}><div className="ask-message-avatar">{m.role==='user'?'You':<Bot size={16}/>}</div><div className="ask-message-body">{m.rankingTable&&Array.isArray(m.rankingTable.rows)&&m.rankingTable.rows.length>0?<div className="ask-supplier-ranking"><div className="ask-supplier-ranking-heading"><strong>{safeAskAnswer(m.rankingTable.title||'Ranking results')}</strong><span>{safeAskAnswer(m.rankingTable.subtitle||`${m.rankingTable.rows.length} records`)}</span></div><div className="ask-supplier-table-wrap"><table className="ask-supplier-table"><thead><tr>{m.rankingTable.columns.map(col=><th key={col.key}>{safeAskAnswer(col.label)}</th>)}</tr></thead><tbody>{m.rankingTable.rows.map((row,ri)=><tr key={String(row.supplier_id||row.buyer_name||row.country||row.style_id||row.rank||ri)}>{m.rankingTable.columns.map(col=>{const value=row[col.key];let shown=value??'—';if(value!==null&&value!==undefined&&col.type==='currency')shown=inr(Number(value));else if(value!==null&&value!==undefined&&col.type==='number')shown=Number(value).toLocaleString('en-IN');else if(value!==null&&value!==undefined&&col.type==='decimal')shown=Number(value).toFixed(1);else if(value!==null&&value!==undefined&&col.type==='percent')shown=Number(value).toFixed(2)+'%';return <td key={col.key} className={col.type==='currency'?'ask-supplier-revenue':''}>{col.key==='rank'?<strong>{shown}</strong>:(typeof shown==='string'?safeAskAnswer(shown):shown)}</td>})}</tr>)}</tbody></table></div></div>:Array.isArray(m.supplierRanking)&&m.supplierRanking.length>0?<div className="ask-supplier-ranking"><div className="ask-supplier-ranking-heading"><strong>All {m.supplierRanking.length} suppliers ranked by linked-order revenue</strong><span>Highest to lowest · Based on the supplier scorecard</span></div><div className="ask-supplier-table-wrap"><table className="ask-supplier-table"><thead><tr><th>Rank</th><th>Supplier Name</th><th>Supplier Code</th><th>Linked-Order Revenue (₹ Cr)</th><th>Linked Orders</th><th>Average Delay (Days)</th><th>Quality Rating (/5)</th></tr></thead><tbody>{m.supplierRanking.map(row=><tr key={row.supplierId}><td><strong>{row.rank}</strong></td><td>{row.supplierName}</td><td>{row.supplierId}</td><td className="ask-supplier-revenue">₹{(Number(row.revenueInr||0)/10000000).toLocaleString('en-IN',{minimumFractionDigits:1,maximumFractionDigits:1})} Cr</td><td>{Number(row.linkedOrders||0).toLocaleString('en-IN')}</td><td>{Number(row.averageDelayDays||0).toFixed(1)}</td><td>{Number(row.qualityRating||0).toFixed(1)}</td></tr>)}</tbody></table></div></div>:<div className="ask-message-text">{safeAskAnswer(m.content)}</div>}{m.role==='assistant'&&m.question&&m.content&&!m.streaming&&deriveAnswerInsight(m.question,safeAskAnswer(m.content))&&<div className="ask-answer-insight"><div className="ask-answer-insight-kicker">KEY INSIGHT</div><strong className="ask-answer-insight-title">{deriveAnswerInsight(m.question,safeAskAnswer(m.content)).title}</strong><div className="ask-answer-insight-primary">{deriveAnswerInsight(m.question,safeAskAnswer(m.content)).primary}</div><div className="ask-answer-insight-metrics">{deriveAnswerInsight(m.question,safeAskAnswer(m.content)).metrics.map(metric=><div key={metric.label}><span>{metric.label}</span><b>{metric.value||'—'}</b></div>)}</div></div>}{m.role==='assistant'&&m.chartData?.type==='line'&&Array.isArray(m.chartData.data)&&m.chartData.data.length>1&&Array.isArray(m.chartData.series)&&<div className="ask-trend-chart" role="img" aria-label="Monthly trend line chart"><div className="ask-trend-chart-title">Monthly trend</div><div style={{width:'100%',height:280}}><ResponsiveContainer width="100%" height="100%"><LineChart data={m.chartData.data} margin={{top:12,right:14,left:8,bottom:8}}><CartesianGrid strokeDasharray="3 3" stroke="var(--border,#334155)"/><XAxis dataKey={m.chartData.xKey||'month'} tick={{fontSize:11}} tickFormatter={v=>String(v).slice(0,7)}/><YAxis tick={{fontSize:11}} tickFormatter={v=>compactIN(v)}/><Tooltip labelFormatter={v=>String(v)} formatter={(value,name)=>[inr(Number(value)),String(name)]}/>{m.chartData.series.map((series,index)=><Line key={series.key} type="monotone" dataKey={series.key} name={series.label||series.key} stroke={colors[index%colors.length]} strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}} connectNulls={false}/>)}</LineChart></ResponsiveContainer></div></div>}{m.role==='assistant'&&m.summary&&summaryCards(m.summary,m.question,m.content).length>0&&<div className="ask-answer-metrics">{summaryCards(m.summary,m.question,m.content).map(metric=><div className="ask-answer-metric" key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div>}{m.role==='assistant'&&i>0&&!m.streaming&&Array.isArray(m.sources)&&m.sources.length>0&&<div className="ask-source-wrap"><div className="ask-source-heading"><CheckCircle2 size={13}/><span>Grounded in workspace data</span></div><div className="ask-source-list">{m.sources.map((source,j)=><span className="ask-source-chip" key={(source.name||'source')+'-'+j} title="Verified against workspace data">{sourceLabel(source.name)}{Number.isFinite(Number(source.records))&&source.records!==undefined?<small>{Number(source.records).toLocaleString('en-IN')} rows</small>:null}</span>)}</div></div>}{m.role==='assistant'&&i>0&&!m.streaming&&m.content&&<button className="ask-read-aloud" type="button" onClick={()=>speakAnswer(safeAskAnswer(m.content))}><Volume2 size={14}/> Listen to answer</button>}</div></div>)}
    {busy&&<div className="ask-message ask-assistant"><div className="ask-message-avatar"><Bot size={16}/></div><div className="ask-message-body"><div className="ask-thinking"><span></span><span></span><span></span> Thinking…</div></div></div>}
   {messages.length===1&&<div className="ask-ai-quickstart"><div className="ask-ai-quickstart-heading"><span className="quickstart-icon"><Sparkles size={15}/></span><div><strong>Start with a business question</strong><small>Choose a prompt or write your question in English.</small></div></div><div className="ask-ai-prompt-grid">{suggestions.map(group=><div className="ask-ai-prompt-group" key={group.group}><span>{group.group}</span>{group.items.map(s=><button type="button" key={s} onClick={()=>ask(s)} disabled={busy}>{s}<span aria-hidden="true">↗</span></button>)}</div>)}</div></div>}
   </div>
   {error&&<div className="ask-error" role="alert">{error}{keyboardDictationFallback&&<button type="button" onClick={()=>{setError('Tap the microphone icon on the iPhone keyboard to dictate your question into this box, then tap Ask.');composerInputRef.current?.focus()}} style={{display:'inline-flex',alignItems:'center',marginTop:8,padding:'8px 10px',border:'1px solid #cbdcf0',borderRadius:8,background:'#f4f8ff',color:'#245e96',fontSize:12,fontWeight:600,cursor:'pointer'}}>Use device keyboard dictation</button>}{setupRequired&&<a className="ask-setup-link" href="https://supabase.com/dashboard/project/rzsgdfpwnxhseyxtrrlx/settings/functions" target="_blank" rel="noreferrer">Open Supabase Function settings</a>}</div>}
   <form className="ask-ai-composer" onSubmit={e=>{e.preventDefault();void ask(input)}}><button type="button" className={'ask-mic-button '+(listening?'is-listening':'')} onClick={listening?stopListening:startListening} disabled={busy} title={listening?'Stop voice input':'Ask by voice'} aria-label={listening?'Stop voice input':'Ask by voice'}>{listening?<Square size={17}/>:<Mic size={18}/>}</button><textarea ref={composerInputRef} value={input} onChange={e=>setInput(e.target.value)} rows={1} placeholder={listening?'Listening… speak your question':input?'Review the recognised text, then tap Ask':'Ask about total sales, GP, NP, products, buyers…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask(input)}}} disabled={busy}/><button type="submit" className="ask-send-button" disabled={busy||!input.trim()} aria-label="Send question">{busy?<AudioLines size={17} className="ask-busy-icon"/>:<Send size={17}/>}<span>Ask</span></button></form>
   <div className="ask-ai-footnote">Voice supports Tamil (India) and English (India). Recognised speech is not submitted automatically: review the transcript and tap Ask to prevent incorrect questions and unrelated KPI results. Missing financial or tax values will be identified rather than invented.</div>
  </div>
 </section>
}

function MarketingROIIntelligence({marketingRows=[]}){
 const sum=(a,k)=>a.reduce((s,r)=>s+Number(r[k]||0),0),pct=(n,d)=>d>0?n/d*100:null;
 const rows=marketingRows.filter(r=>r.month),spend=sum(rows,'marketing_spend_inr'),inquiries=sum(rows,'inquiries'),samples=sum(rows,'samples_sent'),won=sum(rows,'orders_won'),attributed=sum(rows,'order_value_won_inr');
 const roas=spend>0?attributed/spend:null,cpo=won>0?spend/won:null;
 const monthly=useMemo(()=>{const m=new Map();rows.forEach(r=>{const k=String(r.month).slice(0,7),v=m.get(k)||{month:k,spend:0,inquiries:0,samples:0,won:0,attributed:0};['marketing_spend_inr','inquiries','samples_sent','orders_won','order_value_won_inr'].forEach((f,i)=>v[['spend','inquiries','samples','won','attributed'][i]]+=Number(r[f]||0));m.set(k,v)});return [...m.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(v=>({...v,roas:v.spend>0?v.attributed/v.spend:null}))},[rows]);
 const combos=useMemo(()=>{const m=new Map();rows.forEach(r=>{const country=r.country||'Unspecified',channel=r.channel||'Unspecified',k=country+'|||'+channel,v=m.get(k)||{country,channel,spend:0,inquiries:0,samples:0,won:0,attributed:0};v.spend+=Number(r.marketing_spend_inr||0);v.inquiries+=Number(r.inquiries||0);v.samples+=Number(r.samples_sent||0);v.won+=Number(r.orders_won||0);v.attributed+=Number(r.order_value_won_inr||0);m.set(k,v)});return [...m.values()].map(v=>({...v,roas:v.spend>0?v.attributed/v.spend:null,cpo:v.won>0?v.spend/v.won:null,sampleRate:pct(v.samples,v.inquiries),wonRate:pct(v.won,v.samples)})).sort((a,b)=>(b.roas??-1)-(a.roas??-1))},[rows]);
 const channels=useMemo(()=>{const m=new Map();combos.forEach(r=>{const v=m.get(r.channel)||{channel:r.channel,spend:0,inquiries:0,samples:0,won:0,attributed:0};['spend','inquiries','samples','won','attributed'].forEach(k=>v[k]+=r[k]);m.set(r.channel,v)});return [...m.values()].map(v=>({...v,roas:v.spend>0?v.attributed/v.spend:null,cpo:v.won>0?v.spend/v.won:null})).sort((a,b)=>(b.roas??-1)-(a.roas??-1))},[combos]);
 const portfolioRoas=spend>0?attributed/spend:null;
 const budgets=channels.map(x=>{
  const spendShare=spend>0?x.spend/spend*100:null;
  const attributedShare=attributed>0?x.attributed/attributed*100:null;
  const roasGapPct=portfolioRoas>0&&x.roas!==null?(x.roas/portfolioRoas-1)*100:null;
  const decision=x.spend<=0?'No spend data':x.won<=0?'Check attribution':x.roas===null?'Insufficient data':portfolioRoas!==null&&x.roas>portfolioRoas?'Above benchmark':portfolioRoas!==null&&x.roas<portfolioRoas?'Below benchmark':'At benchmark';
  const nextStep=decision==='Above benchmark'?'Validate order quality, gross margin and repeatability before testing a controlled budget increase.':decision==='Below benchmark'?'Review audience quality, campaign execution, follow-up speed and order attribution before deciding on budget changes.':decision==='Check attribution'?'Confirm campaign tagging and CRM-to-order linkage; do not assume spend produced no value until attribution is checked.':decision==='At benchmark'?'Keep the current mix under review and compare the next period before changing allocation.':'Check whether spend and order records are complete for this channel.';
  return {...x,spendShare,attributedShare,roasGapPct,decision,nextStep};
 }).sort((a,b)=>(b.roas??-1)-(a.roas??-1));
 const exceptions=monthly.slice(1).map((v,i)=>{const p=monthly[i],sc=p.spend>0?(v.spend-p.spend)/p.spend*100:null,rc=p.roas!==null&&p.roas>0&&v.roas!==null?(v.roas-p.roas)/p.roas*100:null;return {...v,previous:p.month,sc,rc,flags:[sc!==null&&sc>=30?'Spend increased ≥30%':null,rc!==null&&rc<=-20?'ROAS declined ≥20%':null].filter(Boolean)}}).filter(x=>x.flags.length);
 const [selectedActionGroup,setSelectedActionGroup]=useState(null),[budgetFilter,setBudgetFilter]=useState('All'),fmt=n=>Number(n||0).toLocaleString('en-IN'),cash=n=>inr(n),percent=n=>n===null?'—':n.toFixed(1)+'%',multiple=n=>n===null?'—':n.toFixed(2)+'×',hasData=rows.length>0;
 const filteredBudgets=budgetFilter==='All'?budgets:budgets.filter(x=>budgetFilter==='Above benchmark'?x.decision==='Above benchmark':budgetFilter==='Below benchmark'?x.decision==='Below benchmark':x.decision==='Check attribution');
 const portfolioWonRate=pct(won,samples);
 const zeroWinSegments=combos.filter(x=>x.spend>0&&x.won===0);
 const noSampleSegments=combos.filter(x=>x.inquiries>0&&x.samples===0);
 const lowRoasSegments=combos.filter(x=>x.spend>0&&x.won>0&&x.roas!==null&&roas!==null&&x.roas<roas);
 const weakFunnelSegments=combos.filter(x=>x.samples>=5&&x.wonRate!==null&&portfolioWonRate!==null&&portfolioWonRate>0&&x.wonRate<portfolioWonRate*0.5);
 const zeroWinSpend=sum(zeroWinSegments,'spend'),lowRoasSpend=sum(lowRoasSegments,'spend');
 const topChannelBySpend=[...channels].sort((a,b)=>b.spend-a.spend)[0];
 const topChannelShare=topChannelBySpend&&spend>0?pct(topChannelBySpend.spend,spend):null;
 const best=combos[0];
 const actions=[
  ...(zeroWinSegments.length?[{id:'zero-wins',priority:'P1',label:'Urgent review',category:'Spend leakage',title:'Investigate spend with zero won orders',detail:cash(zeroWinSpend)+' across '+zeroWinSegments.length+' country-channel segment(s)',evidence:'Spend is recorded, but won orders are zero in these segments. This is spend exposure, not proven loss.',next:'Check lead quality, channel delivery, sales follow-up and whether won orders are being recorded.'}]:[]),
  ...(noSampleSegments.length?[{id:'no-samples',priority:'P1',label:'Urgent review',category:'Funnel bottleneck',title:'Fix inquiry-to-sample handoff',detail:noSampleSegments.length+' segment(s) have inquiries but no samples',evidence:fmt(sum(noSampleSegments,'inquiries'))+' inquiries are recorded with zero samples sent.',next:'Review qualification criteria, response time, sample availability and sales-team handoff.'}]:[]),
  ...(lowRoasSegments.length?[{id:'low-roas',priority:'P2',label:'Review',category:'Return efficiency',title:'Review below-portfolio ROAS segments',detail:cash(lowRoasSpend)+' spend across '+lowRoasSegments.length+' segment(s)',evidence:'These segments have won orders, but their observed ROAS is below the selected-scope portfolio ROAS of '+multiple(roas)+'.',next:'Compare audience quality, order value and campaign execution before reallocating budget.'}]:[]),
  ...(weakFunnelSegments.length?[{id:'weak-close',priority:'P2',label:'Review',category:'Funnel bottleneck',title:'Investigate weak sample-to-order conversion',detail:weakFunnelSegments.length+' segment(s) convert at less than half the overall rate',evidence:'Each flagged segment has at least 5 samples and a sample-to-won rate below 50% of the selected-scope aggregate rate ('+percent(portfolioWonRate)+').',next:'Audit sample relevance, buyer feedback, quotation speed and follow-up cadence.'}]:[]),
  ...(topChannelShare!==null&&topChannelShare>=50?[{id:'concentration',priority:'P2',label:'Review',category:'Budget concentration',title:'Review dependence on one channel',detail:topChannelBySpend.channel+' receives '+percent(topChannelShare)+' of total spend',evidence:'At least half of selected-scope marketing spend is concentrated in this channel.',next:'Check whether this concentration is intentional and maintain a tested secondary channel.'}]:[]),
  ...(exceptions.length?[{id:'exceptions',priority:'P2',label:'Review',category:'Monthly anomaly',title:'Investigate month-on-month exceptions',detail:exceptions.length+' month(s) crossed screening thresholds',evidence:'The screening detects spend growth of at least 30% or ROAS decline of at least 20% month-on-month.',next:'Compare invoices, campaign activity, attribution timing and order booking dates for flagged months.'}]:[]),
  ...(best?[{id:'best-segment',priority:'OPPORTUNITY',label:'Opportunity',category:'Positive signal',title:'Validate the strongest country-channel segment',detail:best.country+' · '+best.channel,evidence:multiple(best.roas)+' observed ROAS with '+fmt(best.won)+' reported won orders.',next:'Verify order quality and repeatability before testing a controlled budget increase.'}]:[])
 ].sort((a,b)=>({P1:0,P2:1,OPPORTUNITY:2}[a.priority]-({P1:0,P2:1,OPPORTUNITY:2}[b.priority])));
 const selectedActions=selectedActionGroup==='urgent'?actions.filter(a=>a.priority==='P1'):selectedActionGroup==='review'?actions.filter(a=>a.priority==='P2'):selectedActionGroup==='opportunity'?actions.filter(a=>a.priority==='OPPORTUNITY'):[];
 const selectedGroupTitle={urgent:'Urgent items',review:'Items needing review',opportunity:'Opportunities',zeroWins:'Spend with zero won orders'}[selectedActionGroup]||'';
 const urgentCount=actions.filter(a=>a.priority==='P1').length,reviewCount=actions.filter(a=>a.priority==='P2').length,opportunityCount=actions.filter(a=>a.priority==='OPPORTUNITY').length;
 const tooltipStyle={border:'1px solid #dce5f0',borderRadius:10,fontSize:12};
 return <section className="module-page marketing-roi-page">
  {!hasData?<div className="panel marketing-empty"><h3>Marketing data unavailable</h3><p>No rows were returned for the selected period and country. No estimated values are shown.</p></div>:<>
  <div className="marketing-summary-grid">
   <div className="panel marketing-summary"><span>Marketing spend</span><strong>{cash(spend)}</strong><small>SUM(marketing_spend_inr)</small></div>
   <div className="panel marketing-summary"><span>Attributed order value</span><strong>{cash(attributed)}</strong><small>Not recognized revenue or profit</small></div>
   <div className="panel marketing-summary"><span>ROAS</span><strong>{multiple(roas)}</strong><small>Attributed order value ÷ marketing spend</small></div>
   <div className="panel marketing-summary"><span>Cost per won order</span><strong>{cpo===null?'—':cash(cpo)}</strong><small>Not new-customer acquisition cost</small></div>
  </div>
  <div className="marketing-section-head"><div><span className="panel-kicker">01 · TREND INTELLIGENCE</span><h2>Monthly spend, attributed value & ROAS</h2><p>Monitor monthly investment and reported attributed value.</p></div></div>
  <div className="marketing-chart-grid">
   <div className="panel marketing-panel"><div className="marketing-panel-head"><div><h3>Spend vs attributed order value</h3><p>INR · monthly totals</p></div></div><div className="marketing-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthly} margin={{top:12,right:12,bottom:4,left:10}}><CartesianGrid stroke="#e8eef5" strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:10,fill:'#71819a'}}/><YAxis tickFormatter={v=>compactIN(v)} tick={{fontSize:10,fill:'#71819a'}}/><Tooltip formatter={(v,n)=>[cash(v),n==='spend'?'Marketing spend':'Attributed order value']} contentStyle={tooltipStyle}/><Bar dataKey="spend" name="spend" fill="#243B53" radius={[5,5,0,0]}/><Bar dataKey="attributed" name="attributed" fill="#E07842" radius={[5,5,0,0]}/></ComposedChart></ResponsiveContainer></div></div>
   <div className="panel marketing-panel"><div className="marketing-panel-head"><div><h3>ROAS trend</h3><p>Attributed value per ₹1 spent</p></div></div><div className="marketing-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={monthly} margin={{top:12,right:15,bottom:4,left:5}}><CartesianGrid stroke="#e8eef5" strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:10,fill:'#71819a'}}/><YAxis tick={{fontSize:10,fill:'#71819a'}}/><Tooltip formatter={v=>[multiple(Number(v)),'ROAS']} contentStyle={tooltipStyle}/><Line type="monotone" dataKey="roas" stroke="#2A9D8F" strokeWidth={3} dot={{r:3}} connectNulls={false}/></LineChart></ResponsiveContainer></div></div>
  </div>
  <div className="marketing-section-head"><div><span className="panel-kicker">02 · COUNTRY & CHANNEL</span><h2>Performance matrix</h2><p>Rank combinations by observed spend, volume, cost per won order and ROAS.</p></div></div>
  <div className="panel marketing-panel"><div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th>Country</th><th>Channel</th><th>Spend</th><th>Inquiries</th><th>Samples</th><th>Won orders</th><th>Cost / won</th><th>ROAS</th></tr></thead><tbody>{combos.map(r=><tr key={r.country+'-'+r.channel}><td>{r.country}</td><td>{r.channel}</td><td>{cash(r.spend)}</td><td>{fmt(r.inquiries)}</td><td>{fmt(r.samples)}</td><td>{fmt(r.won)}</td><td>{r.cpo===null?'—':cash(r.cpo)}</td><td><b>{multiple(r.roas)}</b></td></tr>)}</tbody></table></div></div>
  <div className="marketing-chart-grid marketing-funnel-budget-grid">
   <div className="panel marketing-panel"><div className="marketing-panel-head"><div><span className="panel-kicker">03 · FUNNEL DROP-OFF</span><h3>Inquiry → sample → won order</h3><p>Aggregate stage counts, not matched lead cohorts.</p></div></div><div className="marketing-funnel"><div className="marketing-funnel-stage"><span>Inquiries</span><strong>{fmt(inquiries)}</strong><small>100% baseline</small><div className="marketing-funnel-track"><i style={{width:'100%'}}/></div></div><div className="marketing-funnel-stage"><span>Samples sent</span><strong>{fmt(samples)}</strong><small>{percent(pct(samples,inquiries))} of inquiries</small><div className="marketing-funnel-track"><i style={{width:Math.max(0,Math.min(100,pct(samples,inquiries)||0))+'%'}}/></div></div><div className="marketing-funnel-stage"><span>Won orders</span><strong>{fmt(won)}</strong><small>{percent(pct(won,inquiries))} of inquiries · {percent(pct(won,samples))} of samples</small><div className="marketing-funnel-track"><i style={{width:Math.max(0,Math.min(100,pct(won,inquiries)||0))+'%'}}/></div></div></div><p className="marketing-caveat">Monthly aggregates may count different lead cohorts at each stage. Treat these as throughput indicators, not true lead conversion rates.</p></div>
   <div className="panel marketing-panel marketing-budget-panel">
    <div className="marketing-panel-head"><div><span className="panel-kicker">04 · BUDGET ALLOCATION</span><h3>Channel investment decision</h3><p>Compare each channel with the weighted portfolio ROAS, using actual spend and attributed value—not a simple average of channel ratios.</p></div></div>
    <div className="marketing-budget-benchmark">
     <div><span>Portfolio benchmark · weighted ROAS</span><strong>{multiple(portfolioRoas)}</strong><small>₹ attributed order value ÷ total marketing spend</small></div>
     <div><span>Total marketing spend</span><strong>{cash(spend)}</strong><small>Selected period and country filters</small></div>
     <div><span>Attributed order value</span><strong>{cash(attributed)}</strong><small>Not profit or contribution margin</small></div>
    </div>
    <div className="marketing-budget-legend"><b>Channel comparison</b><div className="marketing-budget-filters">
     {['All','Above benchmark','Below benchmark','Check attribution'].map(f=><button type="button" key={f} className={budgetFilter===f?'active':''} onClick={()=>setBudgetFilter(f)}>{f}</button>)}
    </div></div>
    <div className="marketing-budget-cards">{filteredBudgets.map(r=><article className="marketing-budget-card" key={r.channel}>
     <div className="marketing-budget-card-head"><div><h4>{r.channel}</h4><span className={'marketing-budget-status '+(r.decision==='Above benchmark'?'above':r.decision==='Below benchmark'?'below':r.decision==='Check attribution'?'check':'neutral')}>{r.decision}</span></div><strong className="marketing-budget-roas">{multiple(r.roas)}<small>ROAS</small></strong></div>
     <div className="marketing-budget-metrics">
      <div><span>Marketing spend</span><b>{cash(r.spend)}</b></div><div><span>Spend share</span><b>{percent(r.spendShare)}</b></div>
      <div><span>Attributed value</span><b>{cash(r.attributed)}</b></div><div><span>Value share</span><b>{percent(r.attributedShare)}</b></div>
      <div><span>Won orders</span><b>{fmt(r.won)}</b></div><div><span>Cost / won order</span><b>{r.cpo===null?'—':cash(r.cpo)}</b></div>
     </div>
     <div className="marketing-budget-share"><div className="marketing-budget-share-label"><span>Spend share</span><b>{percent(r.spendShare)}</b></div><div className="marketing-budget-track"><i className="spend" style={{width:Math.max(0,Math.min(100,r.spendShare||0))+'%'}}/></div><div className="marketing-budget-share-label"><span>Attributed value share</span><b>{percent(r.attributedShare)}</b></div><div className="marketing-budget-track"><i className="value" style={{width:Math.max(0,Math.min(100,r.attributedShare||0))+'%'}}/></div></div>
     <div className="marketing-budget-vs"><span>ROAS vs portfolio</span><b className={r.roasGapPct===null?'':r.roasGapPct>=0?'positive':'negative'}>{r.roasGapPct===null?'—':(r.roasGapPct>0?'+':'')+r.roasGapPct.toFixed(1)+'%'}</b></div>
     <div className="marketing-budget-next"><b>Recommended review</b><p>{r.nextStep}</p></div>
    </article>)}
    {!filteredBudgets.length&&<div className="marketing-action-empty">No channels match this filter.</div>}</div>
    <p className="marketing-caveat">Above / below benchmark is a descriptive comparison only. ROAS does not show profit, customer lifetime value or incremental impact. Do not automatically transfer budget based on this ranking; validate margin, attribution, capacity and campaign stability first.</p>
   </div>
  </div>
  <div className="marketing-section-head"><div><span className="panel-kicker">05 · ANOMALY DETECTION</span><h2>Monthly exceptions</h2><p>Transparent thresholds identify months worth reviewing, not their cause.</p></div></div>
  <div className="panel marketing-panel"><div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th>Month</th><th>Previous month</th><th>Spend change</th><th>ROAS change</th><th>Exception</th></tr></thead><tbody>{exceptions.map(r=><tr key={r.month}><td>{r.month}</td><td>{r.previous}</td><td>{r.sc===null?'—':(r.sc>0?'+':'')+r.sc.toFixed(1)+'%'}</td><td>{r.rc===null?'—':(r.rc>0?'+':'')+r.rc.toFixed(1)+'%'}</td><td>{r.flags.join(' · ')}</td></tr>)}{!exceptions.length&&<tr><td colSpan="5" className="marketing-no-anomaly">No months crossed the configured screening thresholds.</td></tr>}</tbody></table></div><p className="marketing-caveat">Thresholds: spend increase ≥30% month-on-month; ROAS decline ≥20% month-on-month. First month has no previous-month comparison.</p></div>
  <div className="marketing-section-head"><div><span className="panel-kicker">06 · ACTION CENTRE</span><h2>Marketing action & risk priorities</h2><p>Turn observed patterns into a ranked review plan. Every alert includes the evidence and the next step.</p></div></div>
  <div className="marketing-action-centre">
   <div className="marketing-action-summary">
    <button type="button" className={selectedActionGroup==='urgent'?'selected':''} aria-expanded={selectedActionGroup==='urgent'} onClick={()=>setSelectedActionGroup(v=>v==='urgent'?null:'urgent')}><span>Urgent</span><strong>{urgentCount}</strong><small>P1 · resolve first</small></button>
    <button type="button" className={selectedActionGroup==='review'?'selected':''} aria-expanded={selectedActionGroup==='review'} onClick={()=>setSelectedActionGroup(v=>v==='review'?null:'review')}><span>Needs review</span><strong>{reviewCount}</strong><small>P2 · investigate</small></button>
    <button type="button" className={selectedActionGroup==='opportunity'?'selected':''} aria-expanded={selectedActionGroup==='opportunity'} onClick={()=>setSelectedActionGroup(v=>v==='opportunity'?null:'opportunity')}><span>Opportunity</span><strong>{opportunityCount}</strong><small>Validate before scaling</small></button>
    <button type="button" className={selectedActionGroup==='zeroWins'?'selected':''} aria-expanded={selectedActionGroup==='zeroWins'} onClick={()=>setSelectedActionGroup(v=>v==='zeroWins'?null:'zeroWins')}><span>Spend with zero wins</span><strong>{cash(zeroWinSpend)}</strong><small>{zeroWinSegments.length} segment(s) · selected scope</small></button>
   </div>
   {selectedActionGroup&&<div className="marketing-action-detail">
    <div className="marketing-action-detail-head"><h3>{selectedGroupTitle}</h3><button type="button" onClick={()=>setSelectedActionGroup(null)} aria-label="Close details">×</button></div>
    {selectedActionGroup==='zeroWins'?(
     zeroWinSegments.length?<div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th>Country</th><th>Channel</th><th>Spend</th><th>Inquiries</th><th>Samples</th><th>Won orders</th><th>ROAS</th></tr></thead><tbody>{zeroWinSegments.map((r,i)=><tr key={r.country+'-'+r.channel+'-'+i}><td>{r.country}</td><td>{r.channel}</td><td>{cash(r.spend)}</td><td>{fmt(r.inquiries)}</td><td>{fmt(r.samples)}</td><td>{fmt(r.won)}</td><td>{multiple(r.roas)}</td></tr>)}</tbody></table></div>:<p className="marketing-action-detail-empty">No country-channel segments have marketing spend with zero won orders in the selected scope.</p>
    ):(
     selectedActions.length?<div className="marketing-action-grid">{selectedActions.map(a=><article className={'marketing-action-card '+(a.priority==='P1'?'is-p1':a.priority==='P2'?'is-p2':'is-opportunity')} key={a.id}>
      <div className="marketing-action-card-top"><span className="marketing-action-category">{a.category}</span><span className={'marketing-priority '+(a.priority==='P1'?'p1':a.priority==='P2'?'p2':'opportunity')}>{a.priority==='OPPORTUNITY'?'OPPORTUNITY':a.priority+' · '+a.label.toUpperCase()}</span></div>
      <h3>{a.title}</h3><strong className="marketing-action-evidence-value">{a.detail}</strong>
      <div className="marketing-action-evidence"><b>Why it is flagged</b><p>{a.evidence}</p></div>
      <div className="marketing-action-next"><b>Recommended next step</b><p>{a.next}</p></div>
     </article>)}</div>:<p className="marketing-action-detail-empty">There are no items in this category for the selected filters.</p>
    )}
   </div>}
  </div>
  </>}
 </section>;
}



function SalesBuyersDecisionPage({orders=[],live=false,db,range,country}){
 const [buyerSearch,setBuyerSearch]=useState(''),[buyerSort,setBuyerSort]=useState('revenue'),[buyerLimit,setBuyerLimit]=useState(8);
 const money=inr,fmt=n=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0});
 const d=useMemo(()=>{
  const rows=orders.filter(r=>r&&r.order_id),bm=new Map(),mm=new Map(),cm=new Map(),countryMap=new Map();
  rows.forEach(r=>{const id=String(r.buyer_id||r.buyer_name||('unknown-'+r.order_id)),rev=Number(r.revenue_inr)||0,profit=Number(r.profit_inr)||0,qty=Number(r.order_qty)||0,shipped=Number(r.shipped_qty)||0,date=String(r.order_date||'').slice(0,10),month=date.slice(0,7);
   const b=bm.get(id)||{id,name:r.buyer_name||id,revenue:0,profit:0,orders:0,qty:0,shipped:0,dates:[],countries:new Set()};b.revenue+=rev;b.profit+=profit;b.orders++;b.qty+=qty;b.shipped+=shipped;if(date)b.dates.push(date);if(r.country)b.countries.add(r.country);bm.set(id,b);
   if(month){const m=mm.get(month)||{month,revenue:0,profit:0,orders:0};m.revenue+=rev;m.profit+=profit;m.orders++;mm.set(month,m)}
   const cat=r.product_category||'Unspecified',c=cm.get(cat)||{name:cat,revenue:0,profit:0,orders:0};c.revenue+=rev;c.profit+=profit;c.orders++;cm.set(cat,c);
   const co=r.country||'Unspecified',cc=countryMap.get(co)||{name:co,revenue:0,profit:0,orders:0};cc.revenue+=rev;cc.profit+=profit;cc.orders++;countryMap.set(co,cc);
  });
  const buyers=[...bm.values()].map(b=>{const dates=b.dates.sort();return {...b,margin:b.revenue?b.profit/b.revenue*100:null,lastDate:dates.at(-1)||'',firstDate:dates[0]||'',repeat:b.orders>1,country:[...b.countries].join(', ')}}).sort((a,b)=>b.revenue-a.revenue);
  const months=[...mm.values()].sort((a,b)=>a.month.localeCompare(b.month)),categories=[...cm.values()].map(c=>({...c,margin:c.revenue?c.profit/c.revenue*100:null})).sort((a,b)=>b.revenue-a.revenue),countries=[...countryMap.values()].map(c=>({...c,margin:c.revenue?c.profit/c.revenue*100:null})).sort((a,b)=>b.revenue-a.revenue);
  const revenue=rows.reduce((a,r)=>a+(Number(r.revenue_inr)||0),0),profit=rows.reduce((a,r)=>a+(Number(r.profit_inr)||0),0),qty=rows.reduce((a,r)=>a+(Number(r.order_qty)||0),0),shipped=rows.reduce((a,r)=>a+(Number(r.shipped_qty)||0),0),orderCount=new Set(rows.map(r=>r.order_id)).size,repeat=buyers.filter(b=>b.repeat).length,top5=buyers.slice(0,5).reduce((a,b)=>a+b.revenue,0),latest=months.at(-1)?.month||'',latestDate=latest?new Date(latest+'-01T00:00:00Z'):null;
  const inactive=buyers.filter(b=>b.lastDate&&latestDate&&(latestDate-new Date(b.lastDate+'T00:00:00Z'))/86400000>=90);
  const buyerKeyOf=r=>String(r.buyer_id||r.buyer_name||('unknown-'+r.order_id));
  const activeByMonth=new Map();
  rows.forEach(r=>{const key=String(r.order_date||'').slice(0,7);if(!key)return;const bucket=activeByMonth.get(key)||new Set();bucket.add(buyerKeyOf(r));activeByMonth.set(key,bucket)});
  const firstCohortMonths=[...new Set(buyers.filter(b=>b.firstDate).map(b=>b.firstDate.slice(0,7)))].sort();
  const cohortMonths=firstCohortMonths.slice(-6);
  const cohorts=cohortMonths.map(cohort=>{
   const base=buyers.filter(b=>b.firstDate.slice(0,7)===cohort),ids=new Set(base.map(b=>b.id));
   const cells=months.map(m=>m.month).filter(key=>key>=cohort).map(key=>{
    const active=activeByMonth.get(key)||new Set();
    let count=0;ids.forEach(id=>{if(active.has(id))count++});
    return base.length?count/base.length*100:null;
   });
   return {cohort,buyerCount:base.length,cells};
  });
  const cohortActivity=months.map(m=>{
   const eligible=buyers.filter(b=>b.firstDate&&b.firstDate.slice(0,7)<=m.month);
   const active=activeByMonth.get(m.month)||new Set();
   let activeCount=0;eligible.forEach(b=>{if(active.has(b.id))activeCount++});
   return {month:m.month,active:activeCount,eligible:eligible.length,rate:eligible.length?activeCount/eligible.length*100:null};
  });
  const scatter=buyers.filter(b=>b.revenue>0&&b.margin!==null).map(b=>({name:b.name,revenue:b.revenue/1e7,margin:b.margin,orders:b.orders}));
  const pareto=buyers.slice(0,12).map((b,i)=>({rank:String(i+1),buyer:b.name,revenue:b.revenue,cumulativeShare:revenue?buyers.slice(0,i+1).reduce((a,x)=>a+x.revenue,0)/revenue*100:0}));
  const marginBands=[{name:'Negative',test:v=>v<0},{name:'0–5%',test:v=>v>=0&&v<5},{name:'5–15%',test:v=>v>=5&&v<15},{name:'15%+',test:v=>v>=15}].map(band=>{const matched=buyers.filter(b=>b.margin!==null&&band.test(b.margin));return {...band,count:matched.length,revenue:matched.reduce((a,b)=>a+b.revenue,0)}});
  const frequencyBands=[{name:'Frequent · 3+ orders',test:b=>b.orders>=3},{name:'Repeat · 2 orders',test:b=>b.orders===2},{name:'Single order',test:b=>b.orders===1}].map(band=>({name:band.name,count:buyers.filter(band.test).length}));
  const forecast=months.length>=6?(()=>{const recent=months.slice(-12),n=recent.length,ax=(n-1)/2,ay=recent.reduce((a,m)=>a+m.revenue,0)/n,den=recent.reduce((a,_,i)=>a+(i-ax)**2,0),slope=den?recent.reduce((a,m,i)=>a+(i-ax)*(m.revenue-ay),0)/den:0;return [...recent.map(m=>({month:m.month,revenue:m.revenue,forecast:null})),...Array.from({length:3},(_,i)=>{const date=new Date(recent.at(-1).month+'-01T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+i+1);return {month:date.toISOString().slice(0,7),revenue:null,forecast:Math.max(0,ay+slope*(n+i-ax))}})]})():[];
  return {buyers,months,categories,countries,revenue,profit,qty,shipped,orderCount,repeat,top5,inactive,cohorts,cohortActivity,scatter,pareto,marginBands,frequencyBands,forecast,latest};
 },[orders]);
 const {buyers,months,categories,countries,revenue,profit,qty,shipped,orderCount,repeat,top5,inactive,cohorts,cohortActivity,scatter,pareto,marginBands,frequencyBands,forecast,latest}=d;
 const ranked=[...buyers].sort((a,b)=>buyerSort==='profit'?b.profit-a.profit:buyerSort==='margin'?(b.margin??-Infinity)-(a.margin??-Infinity):b.revenue-a.revenue),visible=ranked.filter(b=>(b.name+' '+b.id+' '+b.country).toLowerCase().includes(buyerSearch.toLowerCase())).slice(0,buyerLimit);
 const margin=revenue?profit/revenue*100:0,fill=qty?shipped/qty*100:0,avg=orderCount?revenue/orderCount:0,topShare=revenue?top5/revenue*100:0,trend=months.slice(-18).map(m=>({...m,month:m.month.slice(2)}));
 const tip={border:'1px solid #e2e8f0',borderRadius:10,fontSize:12},tick=v=>{const n=Math.abs(v);return n>=1e7?(v/1e7).toFixed(0)+' Cr':n>=1e5?(v/1e5).toFixed(0)+' L':(v/1e3).toFixed(0)+' K'},monthLabel=m=>new Date(m+'-01T00:00:00Z').toLocaleDateString('en-IN',{month:'short',year:'2-digit',timeZone:'UTC'}),late=orders.filter(r=>r.actual_ship_date&&r.ship_due_date&&r.actual_ship_date>r.ship_due_date).length;
 return <section className="module-page sb-decision-page">
  <header className="sb-page-head"><div><span className="panel-kicker">GARMENT BUSINESS INTELLIGENCE</span><h1>Sales & Buyers – Decision Intelligence</h1><p>One view for profitability, buyer performance, risk and future opportunities.</p></div><div className="sb-scope"><span>{range||'All periods'}</span><span>{country||'All countries'}</span></div></header>
  {!live||!orders.length?<div className="panel sb-empty"><h3>Sales data unavailable</h3><p>The selected filters returned no order-level records from Supabase.</p></div>:<>
  <div className="sb-kpis">
   <article className="sb-kpi"><span className="sb-kpi-icon orange">◉</span><div><small>Buyer contribution margin</small><strong>{margin.toFixed(2)}%</strong><em>{money(profit)} profit on {money(revenue)} revenue</em></div></article>
   <article className="sb-kpi"><span className="sb-kpi-icon blue">▣</span><div><small>Order fill rate</small><strong>{fill.toFixed(2)}%</strong><em>{fmt(shipped)} shipped / {fmt(qty)} ordered</em></div></article>
   <article className="sb-kpi"><span className="sb-kpi-icon violet">◷</span><div><small>Average order value</small><strong>{money(avg)}</strong><em>{fmt(orderCount)} distinct orders</em></div></article>
   <article className="sb-kpi"><span className="sb-kpi-icon green">♙</span><div><small>Repeat-buyer rate</small><strong>{buyers.length?(repeat/buyers.length*100).toFixed(2):'0.00'}%</strong><em>{fmt(repeat)} repeat buyers · selected data</em></div></article>
  </div>
  <div className="sb-section-title"><div><span className="panel-kicker">01 · PERFORMANCE OVERVIEW</span><h2>Revenue, profit & buyer mix</h2></div><small>{fmt(orderCount)} orders · {fmt(buyers.length)} buyers</small></div>
  <div className="sb-grid sb-grid-two">
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Revenue & profit trend</h3><p>Monthly totals · latest 18 available months</p></div><div className="sb-legend"><i className="orange-dot"/> Revenue <i className="navy-dot"/> Profit</div></div><div className="sb-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={trend} margin={{top:8,right:8,left:0,bottom:0}}><CartesianGrid stroke="#edf1f6" strokeDasharray="3 3"/><XAxis dataKey="month" tick={{fontSize:10,fill:'#77869b'}}/><YAxis tickFormatter={tick} tick={{fontSize:10,fill:'#77869b'}} width={48}/><Tooltip formatter={(v,n)=>[money(v),n==='revenue'?'Revenue':'Profit']} contentStyle={tip}/><Bar dataKey="revenue" name="revenue" fill="#E07842" radius={[4,4,0,0]}/><Bar dataKey="profit" name="profit" fill="#243B53" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></article>
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Buyer revenue concentration</h3><p>Top 5 buyers versus all other buyers</p></div></div><div className="sb-mix"><div className="sb-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{name:'Top 5 buyers',value:top5},{name:'Other buyers',value:Math.max(0,revenue-top5)}]} dataKey="value" innerRadius="66%" outerRadius="88%" paddingAngle={2}><Cell fill="#E07842"/><Cell fill="#8fc5f5"/></Pie><Tooltip formatter={v=>money(v)} contentStyle={tip}/></PieChart></ResponsiveContainer><div><b>{fmt(buyers.length)}</b><small>Buyers</small></div></div><div className="sb-mix-legend"><p><i className="orange-dot"/> Top 5 buyers <b>{topShare.toFixed(1)}%</b></p><p><i className="blue-dot"/> Other buyers <b>{(100-topShare).toFixed(1)}%</b></p><hr/><strong>{money(revenue)}</strong><small>Total revenue</small><strong>{money(profit)}</strong><small>Total profit</small><strong>{margin.toFixed(2)}%</strong><small>Weighted profit margin</small></div></div></article>
  </div>
  <div className="sb-section-title"><div><span className="panel-kicker">02 · BUYER INTELLIGENCE</span><h2>Buyer ranking & value segmentation</h2></div><small>Ranked on selected filters</small></div>
  <div className="sb-grid sb-grid-three">
   <article className="panel sb-panel sb-span-two"><div className="sb-panel-head"><div><h3>Top buyers</h3><p>Revenue, profit and margin by buyer</p></div><select value={buyerSort} onChange={e=>setBuyerSort(e.target.value)}><option value="revenue">Revenue</option><option value="profit">Profit</option><option value="margin">Margin</option></select></div><div className="sb-table-tools"><input value={buyerSearch} onChange={e=>setBuyerSearch(e.target.value)} placeholder="Search buyer or country..."/><select value={buyerLimit} onChange={e=>setBuyerLimit(Number(e.target.value))}><option value={8}>Top 8</option><option value={15}>Top 15</option><option value={30}>Top 30</option></select></div><div className="sb-table-wrap"><table className="sb-table"><thead><tr><th>Buyer</th><th>Revenue</th><th>Profit</th><th>Margin</th><th>Orders</th></tr></thead><tbody>{visible.map(b=><tr key={b.id}><td><b>{b.name}</b><small>{b.country||'Country not specified'}</small></td><td>{money(b.revenue)}</td><td>{money(b.profit)}</td><td><span className={'sb-margin '+(b.margin>=15?'good':b.margin<5?'bad':'')}>{b.margin===null?'—':b.margin.toFixed(1)+'%'}</span></td><td>{fmt(b.orders)}</td></tr>)}{!visible.length&&<tr><td colSpan="5">No buyers match this search.</td></tr>}</tbody></table></div></article>
   <article className="panel sb-panel sb-panel-fill"><div className="sb-panel-head"><div><h3>Revenue vs profit margin</h3><p>Bubble size represents order count</p></div></div><div className="sb-chart sb-scatter sb-fill-chart"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{top:8,right:10,bottom:10,left:0}}><CartesianGrid stroke="#edf1f6" strokeDasharray="3 3"/><XAxis type="number" dataKey="revenue" name="Revenue" unit=" Cr" tick={{fontSize:10}}/><YAxis type="number" dataKey="margin" name="Margin" unit="%" tick={{fontSize:10}}/><ZAxis type="number" dataKey="orders" range={[45,260]}/><Tooltip formatter={(v,n)=>[n==='revenue'?Number(v).toFixed(1)+' Cr':n==='margin'?Number(v).toFixed(1)+'%':v,n]} contentStyle={tip}/><Scatter data={d.scatter} fill="#E07842"/></ScatterChart></ResponsiveContainer></div></article>
  </div>
  <div className="sb-grid sb-grid-two">
   <article className="panel sb-panel sb-cohort-panel"><div className="sb-panel-head"><div><h3>Buyer cohort · repeat purchase</h3><p>Monthly active buyers within each first-purchase cohort</p></div></div>{cohorts.length?<><div className="sb-cohort-summary"><strong>{fmt(buyers.length)} buyers</strong><span>{cohorts.length===1?'1 acquisition cohort':'Latest '+cohorts.length+' acquisition cohorts'}</span><span>{cohortActivity.length} months of history</span></div><p className="sb-cohort-explainer">{cohorts.length===1?'All distinct buyers first appear in '+monthLabel(cohorts[0].cohort)+' within the current filters. The single row is the actual source cohort; extra cohorts are not fabricated.':'Each row groups buyers by their first observed order month in the current filters.'}</p><div className="sb-cohort-wrap"><table className="sb-cohort"><thead><tr><th>Cohort</th>{Array.from({length:Math.max(0,...cohorts.map(c=>c.cells.length))},(_,i)=><th key={i}>M{i}</th>)}</tr></thead><tbody>{cohorts.map(c=><tr key={c.cohort}><th>{monthLabel(c.cohort)}<small>{fmt(c.buyerCount)} buyers</small></th>{c.cells.map((v,i)=><td key={i} title={'Month '+(i)+' · '+(v===null?'No data':v.toFixed(1)+'% active') } style={{background:v===null?'#f5f7fa':'rgba(42,157,143,'+(.10+(v/100)*.55)+')'}}>{v===null?'—':Math.round(v)+'%'}</td>)}</tr>)}</tbody></table></div><div className="sb-cohort-trend-head"><b>Monthly active buyer trend</b><span>Active buyers / eligible buyers</span></div><div className="sb-cohort-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={cohortActivity} margin={{top:8,right:12,left:0,bottom:0}}><CartesianGrid stroke="#edf1f6" strokeDasharray="3 3"/><XAxis dataKey="month" tickFormatter={monthLabel} tick={{fontSize:11,fill:'#718198'}}/><YAxis domain={[0,Math.max(5,buyers.length)]} allowDecimals={false} tick={{fontSize:11,fill:'#718198'}} width={30}/><Tooltip labelFormatter={monthLabel} formatter={(v,n)=>[fmt(v)+(n==='active'?' active buyers':' eligible buyers'),n==='active'?'Active buyers':'Eligible buyers']} contentStyle={tip}/><Area type="monotone" dataKey="eligible" name="Eligible buyers" stroke="#9ab4ce" fill="#dfeaf4" fillOpacity={0.55}/><Area type="monotone" dataKey="active" name="Active buyers" stroke="#E07842" fill="#f6c5a7" fillOpacity={0.55}/></AreaChart></ResponsiveContainer></div></>:<p className="sb-muted">Not enough dated buyer history for cohort analysis.</p>}</article>
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Profitability by product category</h3><p>Revenue, profit and weighted margin</p></div></div><div className="sb-category-list">{categories.slice(0,6).map(c=><div className="sb-category-row" key={c.name}><div><b>{c.name}</b><small>{money(c.profit)} profit · {c.margin===null?'—':c.margin.toFixed(1)+'%'}</small></div><div className="sb-category-bar"><i style={{width:(revenue?c.revenue/revenue*100:0)+'%'}}/></div><strong>{money(c.revenue)}</strong></div>)}</div></article>
  </div>
  <div className="sb-section-title"><div><span className="panel-kicker">03 · RISK & ORDER INTELLIGENCE</span><h2>Concentration, inactivity & fulfilment</h2></div></div>
  <div className="sb-grid sb-grid-three">
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Buyer risk signals</h3><p>Screening based on selected data</p></div></div><div className="sb-risk-list"><div><span className="risk-high">High</span><div><b>Top-5 revenue concentration</b><small>{topShare.toFixed(1)}% of total revenue</small></div></div><div><span className="risk-medium">Review</span><div><b>Inactive buyers · 90+ days</b><small>{inactive.length} buyers since latest order month {latest||'—'}</small></div></div><div><span className="risk-low">Info</span><div><b>Repeat purchase coverage</b><small>{buyers.length?(repeat/buyers.length*100).toFixed(1):'0.0'}% have multiple orders in this selection</small></div></div></div><p className="sb-disclaimer">Inactivity is relative to the latest date in the selected dataset, not today's date. It is a screening signal, not a churn prediction.</p></article>
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Order fulfilment</h3><p>Quantity-based service level</p></div></div><div className="sb-fill-value">{fill.toFixed(2)}%</div><div className="sb-fill-track"><i style={{width:Math.max(0,Math.min(100,fill))+'%'}}/></div><div className="sb-order-stats"><div><small>Ordered quantity</small><b>{fmt(qty)}</b></div><div><small>Shipped quantity</small><b>{fmt(shipped)}</b></div><div><small>Open quantity proxy</small><b>{fmt(Math.max(0,qty-shipped))}</b></div><div><small>Late dated rows</small><b>{fmt(late)}</b></div></div><p className="sb-disclaimer">Late count includes only rows with both actual and due dates. Open quantity is ordered minus shipped.</p></article>
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Country profitability</h3><p>Top markets by revenue</p></div></div><div className="sb-country-list">{countries.slice(0,5).map(c=><div key={c.name}><span>{c.name}</span><b>{money(c.revenue)}</b><em>{c.margin===null?'—':c.margin.toFixed(1)+'% margin'}</em></div>)}</div></article>
  </div>
  <div className="sb-section-title"><div><span className="panel-kicker">04 · PREDICTIVE ANALYTICS</span><h2>Revenue outlook</h2></div><small>Linear trend projection · not a causal forecast</small></div>
  <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Revenue trend & 3-month projection</h3><p>{forecast.length?'Trend fitted to up to 12 latest monthly observations.':'At least 6 months of monthly history are required.'}</p></div></div>{forecast.length?<div className="sb-forecast-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecast} margin={{top:10,right:16,left:0,bottom:0}}><CartesianGrid stroke="#edf1f6" strokeDasharray="3 3"/><XAxis dataKey="month" tickFormatter={monthLabel} tick={{fontSize:10}}/><YAxis tickFormatter={tick} tick={{fontSize:10}}/><Tooltip labelFormatter={monthLabel} formatter={(v,n)=>[money(v),n==='forecast'?'Trend projection':'Actual revenue']} contentStyle={tip}/><Line dataKey="revenue" name="Actual revenue" stroke="#243B53" strokeWidth={2.5} dot={{r:3}} connectNulls={false}/><Line dataKey="forecast" name="Trend projection" stroke="#E07842" strokeWidth={2.5} strokeDasharray="6 4" dot={{r:3}} connectNulls={false}/></LineChart></ResponsiveContainer></div>:<p className="sb-muted">Forecast hidden because the selected data contains fewer than six monthly observations. Expand the period filter to include more history.</p>}</article>
  <div className="sb-section-title"><div><span className="panel-kicker">05 · BUYER PORTFOLIO INTELLIGENCE</span><h2>Revenue concentration & margin health</h2></div><small>Ranked on current filters</small></div>
  <div className="sb-grid sb-grid-two">
   <article className="panel sb-panel sb-panel-fill"><div className="sb-panel-head"><div><h3>Buyer revenue Pareto</h3><p>Top 12 buyers · cumulative share of selected revenue</p></div></div>{pareto.length?<div className="sb-forecast-chart sb-fill-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={pareto} margin={{top:10,right:16,left:4,bottom:4}}><CartesianGrid stroke="#edf1f6" strokeDasharray="3 3"/><XAxis dataKey="rank" tick={{fontSize:10}} label={{value:'Buyer rank',position:'insideBottom',offset:-2,fontSize:10}}/><YAxis yAxisId="revenue" tickFormatter={tick} tick={{fontSize:10}}/><YAxis yAxisId="share" orientation="right" domain={[0,100]} tickFormatter={v=>v+'%'} tick={{fontSize:10}}/><Tooltip formatter={(v,n)=>[n==='cumulativeShare'?Number(v).toFixed(1)+'%':money(v),n==='cumulativeShare'?'Cumulative revenue share':'Buyer revenue']} contentStyle={tip}/><Bar yAxisId="revenue" dataKey="revenue" name="Buyer revenue" fill="#E07842" radius={[4,4,0,0]}/><Line yAxisId="share" dataKey="cumulativeShare" name="Cumulative share" stroke="#243B53" strokeWidth={2.5} dot={{r:3}}/></ComposedChart></ResponsiveContainer></div>:<p className="sb-muted">Buyer revenue ranking is unavailable for this selection.</p>}</article>
   <article className="panel sb-panel"><div className="sb-panel-head"><div><h3>Buyer margin health</h3><p>Buyer count and revenue by margin band</p></div></div><div className="sb-margin-bands">{marginBands.map(b=><div className="sb-margin-band" key={b.name}><div className="sb-margin-band-top"><b>{b.name}</b><strong>{fmt(b.count)} buyers</strong></div><div className="sb-category-bar"><i style={{width:(buyers.length?b.count/buyers.length*100:0)+'%'}}/></div><small>{money(b.revenue)} revenue · {buyers.length?(b.count/buyers.length*100).toFixed(1):'0.0'}% of buyers</small></div>)}</div><div className="sb-frequency-summary"><b>Order frequency</b>{frequencyBands.map(b=><div key={b.name}><span>{b.name}</span><strong>{fmt(b.count)}</strong></div>)}</div></article>
  </div>
  </>}
 </section>;
}

function ModulePage({page,orders=[],live=false,marketingRows=[],supplierRows=[],marketRows=[],db,range,country}){
 const d=modules[page]||modules['Sales & Buyers'];
 const [showInterpretation,setShowInterpretation]=useState(false);
 if(page==='Marketing ROI')return <MarketingROIIntelligence marketingRows={marketingRows}/>;
 if(page==='Sales & Buyers')return <SalesBuyersDecisionPage orders={orders} live={live} db={db} range={range} country={country}/>;
 const sum=(rows,key)=>rows.reduce((s,r)=>s+Number(r[key]||0),0);
 const revenue=sum(orders,'revenue_inr'),profit=sum(orders,'profit_inr'),orderQty=sum(orders,'order_qty'),shippedQty=sum(orders,'shipped_qty');
 const buyers=new Set(orders.map(r=>r.buyer_id).filter(Boolean)),firstOrderByBuyer={};
 orders.forEach(r=>{if(!r.buyer_id||!r.order_date)return;if(!firstOrderByBuyer[r.buyer_id]||r.order_date<firstOrderByBuyer[r.buyer_id])firstOrderByBuyer[r.buyer_id]=r.order_date});
 const repeatBuyers=new Set(orders.filter(r=>r.buyer_id&&r.order_date&&r.order_date>firstOrderByBuyer[r.buyer_id]).map(r=>r.buyer_id));
 const dated=orders.filter(r=>r.actual_ship_date&&r.ship_due_date),onTime=dated.filter(r=>r.actual_ship_date<=r.ship_due_date).length;
 const orderCount=new Set(orders.map(r=>r.order_id).filter(Boolean)).size;
 const actualEfficiencyRows=orders.filter(r=>r.actual_efficiency!==null&&r.actual_efficiency!==undefined&&r.actual_efficiency!=='');
 const marketingSpend=sum(marketingRows,'marketing_spend_inr'),inquiries=sum(marketingRows,'inquiries'),samples=sum(marketingRows,'samples_sent'),won=sum(marketingRows,'orders_won'),attributedValue=sum(marketingRows,'order_value_won_inr');
 const linkedOrders=orders.filter(r=>r.supplier_id),supplierDays=supplierRows.filter(r=>r.avg_delay_days!==null&&r.avg_delay_days!==undefined),supplierQuality=supplierRows.filter(r=>r.quality_rating!==null&&r.quality_rating!==undefined);
 const marketSorted=[...marketRows].filter(r=>r.cotton_yarn_30s_inr_per_kg!==null&&r.cotton_yarn_30s_inr_per_kg!==undefined).sort((a,b)=>String(a.month).localeCompare(String(b.month)));
 const currentMarket=marketSorted[marketSorted.length-1],previousMarket=marketSorted[marketSorted.length-2];
 const kpiValues={
  'Sales & Buyers':[
   {value:revenue?((profit/revenue)*100).toFixed(2)+'%':'—',sub:inr(profit)+' profit on '+inr(revenue)+' revenue',note:'SUM(profit_inr) ÷ SUM(revenue_inr) × 100'},
   {value:orderQty?((shippedQty/orderQty)*100).toFixed(2)+'%':'—',sub:shippedQty.toLocaleString('en-IN')+' shipped / '+orderQty.toLocaleString('en-IN')+' ordered',note:'SUM(shipped_qty) ÷ SUM(order_qty) × 100'},
   {value:orderCount?inr(revenue/orderCount):'—',sub:orderCount.toLocaleString('en-IN')+' distinct orders',note:'SUM(revenue_inr) ÷ distinct order_id'},
   {value:buyers.size?((repeatBuyers.size/buyers.size)*100).toFixed(2)+'%':'—',sub:repeatBuyers.size+' repeat buyers',note:'Buyer has more than one dated order in selected history'}
  ],
  Production:[
   {value:actualEfficiencyRows.length?(sum(actualEfficiencyRows,'actual_efficiency')/actualEfficiencyRows.length).toFixed(1)+'%':'—',sub:'Efficiency values available',note:'Average actual efficiency'},
   {value:orderQty?((sum(orders,'rejection_qty')/orderQty)*100).toFixed(2)+'%':'—',sub:sum(orders,'rejection_qty').toLocaleString('en-IN')+' rejected units',note:'Rejection qty ÷ order qty; proxy, as produced qty is not available'},
   {value:dated.length?((onTime/dated.length)*100).toFixed(2)+'%':'—',sub:onTime+' on-time / '+dated.length+' dated shipments',note:'Actual ship date ≤ ship due date'},
   {value:shippedQty?inr(sum(orders,'rework_cost_inr')/shippedQty):'—',sub:'Per shipped unit',note:'Rework cost ÷ shipped_qty'}
  ],
  'Marketing ROI':[
   {value:inquiries?(samples/inquiries*100).toFixed(2)+'%':'—',sub:samples.toLocaleString('en-IN')+' samples from '+inquiries.toLocaleString('en-IN')+' inquiries',note:'SUM(samples_sent) ÷ SUM(inquiries) × 100'},
   {value:samples?(won/samples*100).toFixed(2)+'%':'—',sub:won.toLocaleString('en-IN')+' won orders',note:'SUM(orders_won) ÷ SUM(samples_sent) × 100'},
   {value:won?inr(marketingSpend/won):'—',sub:inr(marketingSpend)+' marketing spend',note:'SUM(marketing_spend_inr) ÷ SUM(orders_won)'},
   {value:marketingSpend?(attributedValue/marketingSpend).toFixed(2)+'×':'—',sub:inr(attributedValue)+' attributed order value',note:'SUM(order_value_won_inr) ÷ SUM(marketing_spend_inr)'}
  ],
  Procurement:[
   {value:supplierDays.length?(sum(supplierDays,'avg_delay_days')/supplierDays.length).toFixed(1)+' days':'—',sub:supplierDays.length+' suppliers with delay data',note:'Average supplier master delay'},
   {value:supplierQuality.length?(sum(supplierQuality,'quality_rating')/supplierQuality.length).toFixed(2):'—',sub:supplierQuality.length+' suppliers with quality data',note:'Average supplier master quality rating'},
   {value:linkedOrders.length?inr(sum(linkedOrders,'profit_inr')):'—',sub:'Supplier-linked orders',note:'net profit on orders with supplier_id'},
   {value:currentMarket&&previousMarket&&Number(previousMarket.cotton_yarn_30s_inr_per_kg)!==0?(((Number(currentMarket.cotton_yarn_30s_inr_per_kg)-Number(previousMarket.cotton_yarn_30s_inr_per_kg))/Number(previousMarket.cotton_yarn_30s_inr_per_kg))*100).toFixed(2)+'%':'—',sub:currentMarket?('Latest market month: '+String(currentMarket.month).slice(0,7)):'No market prices available',note:'Latest yarn price month-over-month change from dim_market'}
  ]
 };
 const computed=kpiValues[page];
 const hasRequiredRows=page==='Sales & Buyers'||page==='Production'?live:page==='Marketing ROI'?marketingRows.length>0:page==='Procurement'?(supplierRows.length>0&&marketRows.length>0):false;
 const unavailableMessage=page==='Marketing ROI'?(marketingRows.length?'No marketing metrics match these filters.':'Marketing metrics are currently unavailable.'):page==='Procurement'?(supplierRows.length||marketRows.length?'No supplier or market values are available for this selection.':'Supplier and market metrics are currently unavailable.'):'No matching metrics are available for these filters.';
 return <section className="module-page"><div className="panel module-intro"><div className="panel-top"><div><span className="panel-kicker">{d.kicker}</span><h2>{page} decision workspace</h2><p>{d.intro}</p></div><div className="panel-icon"><Target size={21}/></div></div></div><div className="formula-grid">{d.cards.map(([name,formula,source,note],i)=><div className="panel formula-card" key={name}><span className="panel-kicker">LIVE KPI</span><h2>{name}</h2><code>{formula}</code><div className="formula-source"><b>Source:</b> {source}</div><p>{note}</p>{hasRequiredRows&&computed?.[i]?<><strong className="live-kpi-value">{computed[i].value}</strong><span className="live-kpi-note">{computed[i].sub}</span><span className="ready-chip">Calculated from Supabase rows</span></>:<span className="not-ready">{unavailableMessage}</span>}</div>)}</div><button type="button" className="panel next-data interpretation-toggle" onClick={()=>setShowInterpretation(v=>!v)} aria-expanded={showInterpretation}><span className="action-icon teal"><Lightbulb size={18}/></span><span className="interpretation-summary"><span className="panel-kicker">DATA LIMITATIONS</span><strong>Interpretation notes</strong><span className="interpretation-description">{page==='Sales & Buyers'?'Repeat-buyer rate only identifies repeat purchases inside the rows currently selected; a complete historical window is needed for a lifetime repeat rate.':page==='Production'?'Rejection rate uses order quantity as a proxy because a separate produced quantity is not in this workbook.':page==='Marketing ROI'?'Marketing ROAS is attributed order value divided by spend; it is not profit ROI. The workbook contains monthly aggregates, not lead-level cohort IDs.':'Supplier quality and delay come from the imported supplier master; linked order profit indicates association, not proof of supplier causation. Market price change uses imported monthly reference data.'}</span><span className="interpretation-hint">{showInterpretation?'Hide KPI formulas and source details':'Click to view KPI formulas, calculation methods and source tables'}</span></span><ChevronDown size={18} className={showInterpretation?'interpretation-chevron open':'interpretation-chevron'}/></button>{showInterpretation&&<div className="panel interpretation-details"><div className="panel-top"><div><span className="panel-kicker">HOW THESE KPIs ARE CALCULATED</span><h2>{page} · KPI formula & data source</h2><p>These definitions describe the calculations used on this page. Values above come only from rows returned by Supabase.</p></div></div><div className="interpretation-kpi-list">{d.cards.map(([name,formula,source,note])=><div className="interpretation-kpi" key={name}><div><strong>{name}</strong><span className="interpretation-source">Source: {source}</span></div><code>{formula}</code><p>{note}</p></div>)}</div></div>}</section>}

function Kpi({icon:Icon,label,value,change,tone,note}){return <div className="kpi-card overview-kpi-card"><div className="kpi-head"><div className="kpi-icon"><Icon size={19}/></div><span className="kpi-label">{label}</span></div><div className="kpi-value">{value}</div><div className={'kpi-change '+tone}>{tone==='down'?<ArrowDownRight size={14}/>:tone==='up'?<ArrowUpRight size={14}/>:<Activity size={14}/>}<b>{change}</b><span>{note}</span></div></div>}
function Action({icon:Icon,tone,title,desc,tag,onClick}){return <button type="button" className="action-item action-clickable" onClick={onClick} aria-label={'Open '+title}><span className={'action-icon '+tone}><Icon size={17}/></span><span className="action-copy"><b>{title}</b><p>{desc}</p><small>{tag}</small></span><TrendingUp size={15} className="action-arrow"/></button>}
class AppErrorBoundary extends React.Component {
 constructor(props){super(props);this.state={hasError:false,error:null,componentStack:''};}
 static getDerivedStateFromError(error){return {hasError:true,error};}
 componentDidCatch(error,info){const componentStack=info?.componentStack||'';this.setState({componentStack});console.error('ThreadIQ dashboard render failed:',error,componentStack);}
 render(){
  if(this.state.hasError)return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#f7f8fa',color:'#182230',fontFamily:'Inter,Arial,sans-serif'}}><section style={{maxWidth:620,width:'100%',background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:28,boxShadow:'0 12px 40px rgba(15,23,42,.08)'}}><h1 style={{margin:'0 0 10px',fontSize:22}}>Dashboard hit an unexpected error</h1><p style={{color:'#64748b',lineHeight:1.6}}>The page is protected from a full white screen. Reload once; if the problem repeats, share the error below.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',padding:14,borderRadius:8,background:'#f1f5f9',fontSize:12}}>{String(this.state.error?.message||this.state.error||'Unknown rendering error')}{this.state.error?.stack?'\n\nJavaScript stack:\n'+this.state.error.stack:''}{this.state.componentStack?'\n\nComponent stack:\n'+this.state.componentStack:''}</pre><button type="button" onClick={()=>window.location.reload()} style={{padding:'10px 16px',border:0,borderRadius:8,background:'#172b4d',color:'#fff',fontWeight:700,cursor:'pointer'}}>Reload dashboard</button></section></main>;
  return this.props.children;
 }
}
createRoot(document.getElementById('root')).render(<AppErrorBoundary><App/></AppErrorBoundary>);
