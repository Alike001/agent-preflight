import test from "node:test";
import assert from "node:assert/strict";
import {createApp} from "../server.mjs";

async function withApp(env,fn){
  const app=createApp({env});
  await new Promise((resolve)=>app.listen(0,"127.0.0.1",resolve));
  try{await fn("http://127.0.0.1:"+app.address().port);}
  finally{await new Promise((resolve)=>app.close(resolve));}
}

test("health is available without SERV credentials and reports disabled live mode",async()=>{
  await withApp({},async(url)=>{
    const r=await fetch(url+"/healthz");
    assert.equal(r.status,200);
    assert.equal((await r.json()).live_configured,false);
    assert.equal(r.headers.get("x-content-type-options"),"nosniff");
  });
});

test("public demo is explicitly marked as synthetic and never calls SERV",async()=>{
  await withApp({},async(url)=>{
    const r=await fetch(url+"/api/demo?id=LAB-502-001");
    const body=await r.json();
    assert.equal(r.status,200);
    assert.equal(body.mode,"prewritten-demo-no-serv-call");
    assert.equal(body.trace.serv_called,false);
    assert.equal(body.report.recovery_status,"not_verified");
  });
});

test("no one can spend credits before staging secrets are configured",async()=>{
  await withApp({},async(url)=>{
    const r=await fetch(url+"/api/investigate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:"LAB-502-001"})});
    assert.equal(r.status,503);
  });
});

test("incorrect staging token is rejected",async()=>{
  await withApp({SERV_API_KEY:"demo-server-key-with-sufficient-length",STAGING_ACCESS_TOKEN:"correct-token"},async(url)=>{
    const r=await fetch(url+"/api/investigate",{method:"POST",headers:{"content-type":"application/json","x-staging-access-token":"wrong-token"},body:JSON.stringify({id:"LAB-502-001"})});
    assert.equal(r.status,401);
  });
});

test("public file handler never exposes server code",async()=>{
  await withApp({},async(url)=>{
    const r=await fetch(url+"/");
    assert.equal(r.status,200);
    assert.match(await r.text(),/SERV Incident Lab/);
    const denied=await fetch(url+"/lib/serv.mjs");
    assert.equal(denied.status,404);
  });
});

test("controlled self-probe records an ACTUAL HTTP failure and retains source labels",async()=>{
  await withApp({},async(url)=>{
    const first=await fetch(url+"/api/probe?id=LAB-502-001");
    assert.equal(first.status,200);
    const result=await first.json();
    assert.equal(result.mode,"observed-real-http-controlled-lab");
    assert.equal(result.observation.details.status,502);
    assert.equal(result.observation.details.expected_fault_observed,true);
    assert.equal(result.observation.production_monitoring,false);
    const record=await (await fetch(url+"/api/demo?id=LAB-502-001")).json();
    assert.ok(record.incident.evidence.some((item)=>item.id==="ev-actual-http-probe"));
    assert.equal(record.trace.controlled_http_probe_recorded,true);
    assert.equal(record.report.recovery_status,"not_verified");
  });
});
test("public cannot make network requests to arbitrary external probe URLs",async()=>{
  await withApp({},async(url)=>{
    const response=await fetch(url+"/api/probe?id=http%3A%2F%2F169.254.169.254%2F");
    assert.equal(response.status,404);
  });
});
