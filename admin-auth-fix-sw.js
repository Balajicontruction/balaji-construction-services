const SUPABASE_URL='https://iefxfyjmyssuiuyncfqz.supabase.co';
const SUPABASE_KEY='sb_publishable_45zaRM5LLByFABddU5hm9g_4UwfnT7t';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET' || !u.pathname.endsWith('/dashboard.html')) return;
  event.respondWith((async()=>{
    const response=await fetch(event.request,{cache:'no-store'});
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html')) return response;
    let html=await response.text();
    const fix=`<script>
(function(){
  try{
    if(!window.supabase || !window.supabase.createClient) return;
    const originalCreateClient=window.supabase.createClient;
    window.supabase.createClient=function(url,key,options){
      const client=originalCreateClient.call(this,url,key,options);
      if(url!==${JSON.stringify('https://iefxfyjmyssuiuyncfqz.supabase.co')}) return client;
      const originalGetSession=client.auth.getSession.bind(client.auth);
      const originalGetUser=client.auth.getUser.bind(client.auth);
      const saved=localStorage.getItem('balaji_admin_session');
      let restorePromise=null;
      if(saved){
        try{
          const s=JSON.parse(saved);
          if(s&&s.access_token&&s.refresh_token){
            restorePromise=client.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token}).then(r=>r.data&&r.data.session||null).catch(()=>null);
          }
        }catch(e){}
      }
      client.auth.getSession=async function(){
        if(restorePromise){const restored=await restorePromise;if(restored)return {data:{session:restored},error:null};}
        return originalGetSession();
      };
      client.auth.getUser=async function(){
        if(restorePromise){const restored=await restorePromise;if(restored)return {data:{user:restored.user},error:null};}
        return originalGetUser();
      };
      return client;
    };
  }catch(e){console.error('BALAJI auth bootstrap',e)}
})();
</script>`;
    html=html.replace('</head>',fix+'</head>');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  })());
});
