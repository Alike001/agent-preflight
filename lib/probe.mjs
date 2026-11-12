// A controlled HTTP probe records a REAL request to this very server.
// The intentionally failing lab endpoints are not customer infrastructure.
const TARGETS=Object.freeze({
  "LAB-502-001":Object.freeze({path:"/lab/checkout",expectedStatus:502}),
  "LAB-DB-002":Object.freeze({path:"/lab/orders",expectedStatus:503})
});
export function getLabTarget(id){
  return TARGETS[id]??null;
}
export async function probeLocalLab({id,port,fetchImpl=fetch}){
  const target=getLabTarget(id);
  if(!target)throw new Error("Unsupported lab incident.");
  if(!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535)
    throw new Error("No valid local lab port available.");
  // No user-supplied URL or host is ever accepted (SSRF cannot redirect to arbitrary targets).
  const url="http://127.0.0.1:"+Number(port)+target.path;
  const start=performance.now();
  const response=await fetchImpl(url,{redirect:"error",signal:AbortSignal.timeout(3500)});
  const elapsedMs=Math.round((performance.now()-start)*10)/10;
  const json=await response.json();
  if(json?.mode!=="intentionally-broken-controlled-lab")
    throw new Error("Unexpected local probe origin.");
  const status=response.status;
  const passed=status===target.expectedStatus;
  return {
    id:"ev-actual-http-probe",
    kind:"active-http-probe",
    time:new Date().toISOString(),
    source:"Actual HTTP request to a deliberately faulty local lab endpoint",
    text:"GET "+target.path+" returned HTTP "+status+" in "+elapsedMs+
      " ms. This is a real HTTP response from a controlled fault, NOT a production outage.",
    details:{status,elapsed_ms:elapsedMs,expected_status:target.expectedStatus,expected_fault_observed:passed},
    actual_http_request:true,
    production_monitoring:false
  };
}
