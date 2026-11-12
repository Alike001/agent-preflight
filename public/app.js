(() => {
  "use strict";
  const get=(id)=>document.getElementById(id);
  let items=[],current="LAB-502-001";
  const clear=(node)=>{while(node.firstChild)node.removeChild(node.firstChild);};
  const put=(parent,tag,className,text)=>{
    const child=document.createElement(tag);
    if(className)child.className=className;
    child.textContent=String(text??"");
    parent.appendChild(child);
    return child;
  };
  async function api(path,options) {
    const response=await fetch(path,options);
    let data;
    try {data=await response.json();}catch{throw new Error("Invalid API response.");}
    if(!response.ok)throw new Error(data.error??"Request failed.");
    return data;
  }
  function notice(message,isError=false) {
    get("feedback").textContent=message;
    get("feedback").className=isError?"error":"success";
  }
  function drawQueue(){
    const host=get("queue");clear(host);
    for(const item of items){
      const button=document.createElement("button");
      button.type="button";
      button.className="queueitem"+(item.id===current?" chosen":"");
      put(button,"span","severity",item.severity.toUpperCase());
      put(button,"strong","",item.title);
      put(button,"small","",item.service+" · "+item.id);
      button.addEventListener("click",()=>load(item.id));
      host.appendChild(button);
    }
  }
  function drawReport(report,mode,trace){
    get("summary").textContent=report.summary;
    get("hypothesis").textContent=report.hypothesis;
    get("next").textContent=report.next_check;
    get("mode").textContent=mode==="prewritten-demo-no-serv-call"?"Prewritten demo · no SERV request":"Live SERV + local lab tools";
    get("trace-mode").textContent=mode==="prewritten-demo-no-serv-call"?"DEMO · NO SERV REQUEST":"REAL SERV COMPLETION";
    get("trace").textContent=JSON.stringify(trace,null,2);
    const host=get("citations");clear(host);
    report.citations.forEach((cite)=>put(host,"span","ref",cite.id));
  }
  async function load(id){
    current=id;drawQueue();notice("");
    try{
      const data=await api("/api/demo?id="+encodeURIComponent(id));
      get("title").textContent=data.incident.title;
      get("description").textContent=data.incident.description;
      get("case-id").textContent=data.incident.id;
      get("service").textContent=data.incident.service;
      const host=get("evidence");clear(host);
      for(const item of data.incident.evidence){
        const card=put(host,"article","evidencecard","");
        const top=put(card,"div","evidencemeta","");
        put(top,"strong","",item.kind.toUpperCase());
        put(top,"span","",item.id+" · "+item.time);
        put(card,"p","",item.text);
        put(card,"small","",item.source);
      }
      drawReport(data.report,data.mode,data.trace);
    }catch(error){notice(error.message,true);}
  }
  async function runProbe(){
    const button=get("run-probe");
    button.disabled=true;button.textContent="Probing…";
    notice("Making a real HTTP request against our deliberately faulty lab service.");
    try{
      const result=await api("/api/probe?id="+encodeURIComponent(current));
      await load(current);
      notice("Observed HTTP "+result.observation.details.status+
        " from the controlled local lab. This does NOT mean a production service failed.");
    }catch(error){notice("Probe failed: "+error.message,true);}
    finally{button.disabled=false;button.textContent="Run lab HTTP probe";}
  }
  async function run(){
    const button=get("run"),token=get("staging-token").value;
    if(!token)return notice("Enter the staging token to authorize one real SERV investigation.",true);
    button.disabled=true;button.textContent="Investigating…";
    notice("SERV is selecting a read-only lab tool. No production systems are accessed.");
    try{
      const data=await api("/api/investigate",{
        method:"POST",
        headers:{"Content-Type":"application/json","X-Staging-Access-Token":token},
        body:JSON.stringify({id:current})
      });
      drawReport(data.report,data.mode,data.trace);
      notice("Live SERV completed. The diagnosis remains a hypothesis, and recovery is not verified.");
    }catch(error){notice(error.message,true);}
    finally{button.disabled=false;button.textContent="Run SERV investigation";}
  }
  async function init(){
    get("run").addEventListener("click",run);
    get("run-probe").addEventListener("click",runProbe);
    try{
      const [health,list]=await Promise.all([api("/healthz"),api("/api/incidents")]);
      get("serv-ready").textContent=health.live_configured?"Ready · gated":"Not configured";
      items=list.incidents;
      await load(current);
    }catch(error){notice("Could not initialize: "+error.message,true);}
  }
  init();
})();
