(()=>{
  'use strict';

  // Load the modern Admin Dashboard enhancement without allowing the
  // expensive worker/customer DOM patch loops to run continuously.
  // Existing dashboard functions remain untouched.
  const nativeSetInterval=window.setInterval;
  const nativeSetTimeout=window.setTimeout;
  const blocked=(fn)=>{
    try{
      const s=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn||'');
      return s.includes('patchAvatars')||s.includes('patchCustomerProjects');
    }catch(e){return false}
  };

  window.setInterval=function(fn,ms,...args){
    if(blocked(fn)) return 0;
    return nativeSetInterval.call(window,fn,ms,...args);
  };
  window.setTimeout=function(fn,ms,...args){
    if(blocked(fn)) return 0;
    return nativeSetTimeout.call(window,fn,ms,...args);
  };

  const load=(src)=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=reject;
    document.body.appendChild(s);
  });

  load('worker-avatar-core.js')
    .then(()=>{
      // Keep the guards active: worker-avatar-core.js otherwise starts
      // repeated DOM/database patch work that can freeze the dashboard.
      let loaded=false;
      const loadEnquiry=()=>{
        if(loaded)return;
        loaded=true;
        const s=document.createElement('script');
        s.src='enquiry-status-fix.js?v=2';
        s.async=true;
        s.onerror=()=>{loaded=false};
        document.body.appendChild(s);
      };
      document.addEventListener('click',e=>{
        if(e.target?.closest?.('[data-page="enquiries"]')) loadEnquiry();
      },true);
    })
    .catch(e=>console.error('Admin dashboard enhancement loader:',e));
})();