import test from "node:test";
import assert from "node:assert/strict";
import {INCIDENTS,getIncident,labGatewayCall,verifyReport,demoReport} from "../lib/core.mjs";

test("lab incidents are visibly synthetic",()=>{
  assert.equal(INCIDENTS.length,2);
  assert.ok(INCIDENTS.every((i)=>i.source_label.includes("SYNTHETIC")));
  assert.equal(getIncident("not-found"),null);
});

test("runbook search executes locally with source label",()=>{
  const result=labGatewayCall({tool_name:"runbooks.search",args:{query:"HTTP 502 deployment"}},INCIDENTS[0]);
  assert.equal(result.tool,"runbooks.search");
  assert.equal(result.source,"local-synthetic-runbooks");
  assert.ok(result.results.length>0);
});

test("write tools and made-up instances fail closed",()=>{
  assert.throws(()=>labGatewayCall({tool_name:"ssh.execute_command",args:{command:"whoami"}},INCIDENTS[0]),/allowlist/);
  assert.throws(()=>labGatewayCall({tool_name:"runbooks.search",args:{query:"HTTP 502"},instance:"fake"},INCIDENTS[0]),/instance/);
});

test("malformed and overlong tool queries fail",()=>{
  assert.throws(()=>labGatewayCall({tool_name:"runbooks.search",args:{query:""}},INCIDENTS[0]),/Query/);
  assert.throws(()=>labGatewayCall({tool_name:"runbooks.search",args:{query:"a".repeat(250)}},INCIDENTS[0]),/Query/);
});

test("fabricated source IDs are never accepted",()=>{
  const report=demoReport(INCIDENTS[0]);
  assert.throws(()=>verifyReport({...report,evidence_ids:["fake-source"]},INCIDENTS[0]),/nonexistent/);
});

test("recovery can never be certified from model output",()=>{
  const report=demoReport(INCIDENTS[0]);
  assert.equal(report.recovery_status,"not_verified");
  assert.throws(()=>verifyReport({...report,recovery_status:"recovered"},INCIDENTS[0]),/cannot certify/);
});

test("reports are labeled as hypotheses and reference real fixture evidence",()=>{
  const report=demoReport(INCIDENTS[0]);
  assert.equal(report.report_type,"hypothesis_not_confirmed");
  assert.ok(report.citations.every((cite)=>INCIDENTS[0].evidence.some((e)=>e.id===cite.id)));
});
