import test from "node:test";
import assert from "node:assert/strict";
import {getLabTarget,probeLocalLab} from "../lib/probe.mjs";

test("only two fixed lab paths can be probed",()=>{
 assert.deepEqual(getLabTarget("LAB-502-001"),{path:"/lab/checkout",expectedStatus:502});
 assert.equal(getLabTarget("http://169.254.169.254/latest/meta-data"),null);
});

test("probe emits a real-request observation without claiming customer monitoring",async()=>{
 const observed=[];
 const fetchImpl=async(url,options)=>{
   observed.push({url,options});
   return {status:502,json:async()=>({mode:"intentionally-broken-controlled-lab"})};
 };
 const item=await probeLocalLab({id:"LAB-502-001",port:12345,fetchImpl});
 assert.equal(item.id,"ev-actual-http-probe");
 assert.equal(item.details.status,502);
 assert.equal(item.details.expected_fault_observed,true);
 assert.equal(item.actual_http_request,true);
 assert.equal(item.production_monitoring,false);
 assert.equal(observed[0].url,"http://127.0.0.1:12345/lab/checkout");
 assert.equal(observed[0].options.redirect,"error");
});

test("probe rejects unexpected response origin before recording evidence",async()=>{
 const fetchImpl=async()=>({status:502,json:async()=>({mode:"fake-external-output"})});
 await assert.rejects(()=>probeLocalLab({id:"LAB-502-001",port:12345,fetchImpl}),/Unexpected local probe/);
});

test("invalid ports and incident identifiers are refused",async()=>{
 await assert.rejects(()=>probeLocalLab({id:"LAB-502-001",port:0}),/port/);
 await assert.rejects(()=>probeLocalLab({id:"bad-id",port:1234}),/Unsupported/);
});
