import http from "node:http";
import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { INCIDENTS, getIncident, demoReport } from "./lib/core.mjs";
import { servInvestigation } from "./lib/serv.mjs";
import { probeLocalLab } from "./lib/probe.mjs";

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const ASSETS={
  "/":["index.html","text/html; charset=utf-8"],
  "/styles.css":["styles.css","text/css; charset=utf-8"],
  "/app.js":["app.js","text/javascript; charset=utf-8"]
};

function send(res,status,body) {
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(body));
}

function tokenMatches(given,expected) {
  if (typeof given!=="string"||!expected) return false;
  const a=Buffer.from(given),b=Buffer.from(expected);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}

async function getJson(req) {
  if (req.headers["content-type"]?.split(";")[0]!=="application/json")
    throw new Error("Expected application/json request.");
  let body="";
  for await (const chunk of req) {
    body+=chunk.toString("utf8");
    if (Buffer.byteLength(body)>2048) throw new Error("Request size limit exceeded.");
  }
  try { return JSON.parse(body); }
  catch { throw new Error("Malformed request JSON."); }
}

export function createApp({env=process.env,fetchImpl=fetch}={}) {
  const recentCalls=new Map();
  const recentProbes=new Map();
  const probeHistory=new Map();
  function withProbeEvidence(incident) {
    if(!incident) return null;
    const observed=probeHistory.get(incident.id);
    return observed?{...incident,evidence:[...incident.evidence,observed]}:incident;
  }
  const liveConfigured=Boolean(env.SERV_API_KEY&&env.STAGING_ACCESS_TOKEN);
  const server=http.createServer(async (req,res)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Referrer-Policy","no-referrer");
    res.setHeader("Content-Security-Policy","default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'");
    const pathname=new URL(req.url??"/","http://localhost").pathname;
    if(req.method==="GET"&&pathname==="/healthz") {
      return send(res,200,{status:"ok",service:"serv-incident-lab",live_configured:liveConfigured,phase:"milestone-2-read-only-lab-probes"});
    }
    // Deliberately broken local endpoints, never real customer infrastructure.
    if(req.method==="GET"&&(pathname==="/lab/checkout"||pathname==="/lab/orders")) {
      const upstream=pathname==="/lab/checkout";
      return send(res,upstream?502:503,{
        mode:"intentionally-broken-controlled-lab",
        scenario:upstream?"wrong-upstream-port":"database-unavailable",
        source:"controlled local server",
        remediation:"none"
      });
    }
    if(req.method==="GET"&&pathname==="/api/probe") {
      const id=new URL(req.url,"http://localhost").searchParams.get("id");
      const incident=getIncident(id);
      if(!incident)return send(res,404,{error:"Unknown controlled lab incident."});
      const ip=req.socket.remoteAddress??"unknown";
      const now=Date.now();
      if(now-(recentProbes.get(ip)??0)<1500)
        return send(res,429,{error:"Probe limit: retry after a short interval."});
      recentProbes.set(ip,now);
      try {
        const observation=await probeLocalLab({id,port:server.address()?.port});
        probeHistory.set(id,observation);
        return send(res,200,{mode:"observed-real-http-controlled-lab",observation,
          note:"Real HTTP response from intentionally faulty local endpoint, not production monitoring."});
      } catch(error) {
        return send(res,502,{error:"Controlled lab probe failed: "+String(error.message).slice(0,150)});
      }
    }
    if(req.method==="GET"&&pathname==="/api/incidents") {
      return send(res,200,{source:"controlled-synthetic-lab",incidents:INCIDENTS.map((i)=>({
        id:i.id,title:i.title,service:i.service,severity:i.severity,state:i.state
      }))});
    }
    if(req.method==="GET"&&pathname==="/api/demo") {
      const id=new URL(req.url,"http://localhost").searchParams.get("id")??INCIDENTS[0].id;
      const incident=withProbeEvidence(getIncident(id));
      if(!incident) return send(res,404,{error:"Unknown lab incident."});
      return send(res,200,{mode:"prewritten-demo-no-serv-call",incident,report:demoReport(incident),
        trace:{source:"synthetic fixture",serv_called:false,real_infrastructure_access:false,
          controlled_http_probe_recorded:Boolean(probeHistory.get(id))}});
    }
    if(req.method==="POST"&&pathname==="/api/investigate") {
      if(!liveConfigured)
        return send(res,503,{error:"Live SERV calls are disabled until server-side secrets are configured."});
      if(!tokenMatches(req.headers["x-staging-access-token"],env.STAGING_ACCESS_TOKEN))
        return send(res,401,{error:"Valid staging access token required."});
      const ip=req.socket.remoteAddress??"unknown";
      const now=Date.now();
      const history=(recentCalls.get(ip)??[]).filter((t)=>now-t<600000);
      if(history.length>=4) return send(res,429,{error:"Rate limit: maximum four paid calls per ten minutes."});
      history.push(now); recentCalls.set(ip,history);
      try {
        const data=await getJson(req);
        const incident=withProbeEvidence(getIncident(data?.id));
        if(!incident) return send(res,400,{error:"Only documented lab incident IDs are supported."});
        const result=await servInvestigation({incident,apiKey:env.SERV_API_KEY,model:env.SERV_MODEL??"gpt-5.4-mini",fetchImpl});
        return send(res,200,result);
      } catch(err) {
        return send(res,502,{error:"Investigation failed closed: "+String(err.message).slice(0,200)});
      }
    }
    if(req.method==="GET"&&ASSETS[pathname]) {
      try {
        const [filename,type]=ASSETS[pathname];
        const data=await readFile(path.join(ROOT,"public",filename));
        res.writeHead(200,{"Content-Type":type,"Cache-Control":"public, max-age=60"});
        res.end(data);
      } catch { send(res,500,{error:"Static asset unavailable."}); }
      return;
    }
    return send(res,404,{error:"Not found."});
  });
  return server;
}
