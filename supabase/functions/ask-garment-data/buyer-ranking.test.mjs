import test from "node:test";
import assert from "node:assert/strict";
import { rankBuyerRows } from "./analytics-utils.mjs";

test("buyer ranking returns all 40 buyers in descending revenue order", () => {
 const rows = Array.from({length:40},(_,i)=>({buyer_id:String(i),buyer_name:`Buyer ${i+1}`,country:"UAE",order_count:40-i,revenue_inr:(40-i)*1000,profit_inr:(40-i)*125}));
 const result = rankBuyerRows(rows,"revenue_inr");
 assert.equal(result.length,40);
 assert.equal(result[0].buyer_name,"Buyer 1");
 assert.equal(result[39].buyer_name,"Buyer 40");
 for(let i=0;i<40;i++){assert.equal(result[i].order_count,40-i);assert.equal(result[i].rank,i+1);assert.equal(result[i].profit_margin_pct,12.5);if(i)assert.ok(result[i-1].revenue_inr>=result[i].revenue_inr);}
});

test("buyer ranking uses recorded profit when requested",()=>{
 const result=rankBuyerRows([{buyer_name:"Revenue leader",revenue_inr:1000,profit_inr:100,order_count:8},{buyer_name:"Profit leader",revenue_inr:500,profit_inr:150,order_count:4}],"profit_inr");
 assert.equal(result[0].buyer_name,"Profit leader");assert.equal(result[0].profit_margin_pct,30);assert.equal(result[0].order_count,4);
});

test("rejects unsupported ranking metric",()=>assert.throws(()=>rankBuyerRows([],"order_count"),/metric must be/));
