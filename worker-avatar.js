(()=>{
  'use strict';

  // Keep the modern Admin Dashboard UI, but block the legacy 5-second
  // polling loops for the lifetime of the dashboard. The main dashboard
  // functions continue to use their own normal timers.
  const nativeSetInterval=window.setInterval;
  const nativeClearInterval=window.clearInterval;
  window.setInterval=function(fn,ms,...args){
    if(Number(ms)===5000) return 0;
    return nativeSetInterval.call(window,fn,ms,...args);
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
      // IMPORTANT: do not restore setInterval here. worker-avatar-core.js
      // contains two 5-second DOM/database polling loops which can make the
      // dashboard unresponsive. Other dashboard timers remain untouched.
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
    .catch(e=>{
      // Keep the interval guard active even if the enhancement fails.
      console.error('Admin dashboard enhancement loader:',e);
    });
})();