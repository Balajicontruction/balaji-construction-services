const SUPABASE_URL='https://iefxfyjmyssuiuyncfqz.supabase.co';
const SUPABASE_KEY='sb_publishable_45zaRM5LLByFABddU5hm9g_4UwfnT7t';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET' || !u.pathname.endsWith('/dashboard.html')) return;
  event.respondWith((async()=>{
    const response=await fetch(event.request);
    const type=response.headers.get('content-type')||'';
    if(!type.includes('text/html')) return response;
    let html=await response.text();
    const fix=`<script>
(function(){
  try{
    const SUPABASE_URL=${JSON.stringify(SUPABASE_URL)};
    const SUPABASE_KEY=${JSON.stringify(SUPABASE_KEY)};
    const client=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'balaji-admin-auth'}});
    async function forceAdminSession(){
      try{
        const r=await client.auth.getSession();
        if(!r.data||!r.data.session) return;
        const session=r.data.session;
        const auth=document.getElementById('auth');
        const app=document.getElementById('app');
        if(auth) auth.classList.add('hidden');
        if(app) app.classList.remove('hidden');
        const email=document.getElementById('userEmail');
        if(email) email.textContent=session.user.email||'';
        if(typeof window.start==='function' && !(window.__balajiStarted)){window.__balajiStarted=true; await window.start(session.user);}
        if(typeof window.refreshAll==='function') await window.refreshAll();
      }catch(e){console.error('Admin session bootstrap failed',e);}
    }
    window.addEventListener('load',()=>setTimeout(forceAdminSession,50));
    setTimeout(forceAdminSession,250);
    setTimeout(forceAdminSession,1000);
  }catch(e){console.error(e)}
})();
</script>`;
    html=html.replace('</body>',fix+'</body>');
    return new Response(html,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  })());
});
