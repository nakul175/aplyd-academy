/** Every intercept guards its first request; redirects are never followed or sent. */
export async function withReadOnlyRoute(route,allowedOrigin,forbidden,handle){
 const request=route.request(),url=new URL(request.url()),method=request.method();
 if(url.origin!==allowedOrigin||!['GET','HEAD'].includes(method)){
  forbidden.push({method,path:url.pathname,origin:url.origin,kind:'forbidden-request'});
  await route.abort('blockedbyclient');return null;
 }
 return handle(route);
}

/** page.route may not inspect redirect hops: use one fetch with redirects disabled. */
export async function fetchReadOnlyResponse(route,allowedOrigin,forbidden){
 return withReadOnlyRoute(route,allowedOrigin,forbidden,async safe=>{
  const request=safe.request(),requestUrl=new URL(request.url()),response=await safe.fetch({maxRedirects:0}),status=response.status(),headers=response.headers();
  const hasLocation=Object.keys(headers).some(key=>key.toLowerCase()==='location');
  let responseOrigin=null;try{responseOrigin=new URL(response.url()).origin;}catch{}
  if((status>=300&&status<400)||hasLocation||responseOrigin!==allowedOrigin){
   forbidden.push({method:request.method(),path:requestUrl.pathname,origin:requestUrl.origin,kind:'forbidden-response',status,hasLocation,responseOrigin});
   await safe.abort('blockedbyclient');return null;
  }
  return response;
 });
}
