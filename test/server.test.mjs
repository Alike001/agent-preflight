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
