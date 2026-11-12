import test from "node:test";
import assert from "node:assert/strict";
import {INCIDENTS} from "../lib/core.mjs";
import {servInvestigation} from "../lib/serv.mjs";

const first={
  id:"serv-call-1",model:"gpt-5.4-mini",usage:{prompt_tokens:35,completion_tokens:15},
  choices:[{finish_reason:"tool_calls",message:{content:null,tool_calls:[{
    id:"call-1",type:"function",function:{name:"gateway_call",
      arguments:JSON.stringify({tool_name:"runbooks.search",args:{query:"HTTP 502 deployment"}})}
  }]}}]
};
const second={
  id:"serv-call-2",model:"gpt-5.4-mini",usage:{prompt_tokens:45,completion_tokens:25},
  choices:[{finish_reason:"stop",message:{content:JSON.stringify({
    summary:"Gateway port changes align with HTTP 502 errors and connection refused logs.",
    hypothesis:"A mismatched upstream port may explain why the backend is unavailable from the gateway.",
    next_check:"Compare the configured gateway upstream port to the healthy backend service listener.",
    confidence:"medium",recovery_status:"not_verified",evidence_ids:["ev-deploy","ev-connection"]
  })}}]
};
const response=(body,status=200)=>({ok:status===200,status,json:async()=>body});
const key="local-test-key-no-secrets-used";

test("SERV tool-calling protocol and report validation, using stubbed HTTP",async()=>{
  const calls=[];
  const fetchImpl=async (url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});
    return response(calls.length===1?first:second);
  };
  const result=await servInvestigation({incident:INCIDENTS[0],apiKey:key,fetchImpl});
  assert.equal(calls.length,2);
  assert.equal(calls[0].body.tool_choice,"auto");
  assert.equal(calls[1].body.messages.at(-2).role,"tool");
  assert.equal(result.trace.tool,"runbooks.search");
  assert.equal(result.trace.prompt_tokens,80);
  assert.equal(result.report.recovery_status,"not_verified");
  assert.equal(result.mode,"real-serv-synthetic-local-gateway");
});

test("SERV failing to call a tool is a failure",async()=>{
  const fetchImpl=async()=>response({choices:[{finish_reason:"stop",message:{content:"Just read the logs."}}]});
  await assert.rejects(()=>servInvestigation({incident:INCIDENTS[0],apiKey:key,fetchImpl}),/exactly one/);
});

test("upstream SERV rate-limit error is explicit",async()=>{
  const fetchImpl=async()=>response({},429);
  await assert.rejects(()=>servInvestigation({incident:INCIDENTS[0],apiKey:key,fetchImpl}),/429/);
});

test("unsanctioned tool is never executed",async()=>{
  const modified=structuredClone(first);
  modified.choices[0].message.tool_calls[0].function.arguments=JSON.stringify({tool_name:"ssh.execute_command",args:{command:"uptime"}});
  await assert.rejects(()=>servInvestigation({incident:INCIDENTS[0],apiKey:key,fetchImpl:async()=>response(modified)}),/allowlist/);
});

test("model-fabricated evidence IDs are refused",async()=>{
  const modified=structuredClone(second);
  const body=JSON.parse(modified.choices[0].message.content);
  body.evidence_ids=["not-a-real-evidence-id"];
  modified.choices[0].message.content=JSON.stringify(body);
  let count=0;
  await assert.rejects(()=>servInvestigation({incident:INCIDENTS[0],apiKey:key,fetchImpl:async()=>response(++count===1?first:modified)}),/nonexistent/);
});
