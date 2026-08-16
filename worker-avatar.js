(()=>{
  'use strict';

  // Keep the modern Admin Dashboard UI, but prevent the old 5-second
  // background polling loops from making the page unresponsive.
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
      window.setInterval=nativeSetInterval;
      window.clearInterval=nativeClearInterval;
      // Enquiry enhancement is loaded only when its section is opened.
      let loaded=false;
      const loadEnquiry=()=>{
        if(loaded)return;
        loaded=true;
        const s=document.createElement('script');
        s.src='enquiry-status-fix.js?v=2';
        s.onerror=()=>{loaded=false};
        document.body.appendChild(s);
      };
      document.addEventListener('click',e=>{
        if(e.target?.closest?.('[data-page="enquiries"]')) loadEnquiry();
      },true);
    })
    .catch(e=>{
      window.setInterval=nativeSetInterval;
      window.clearInterval=nativeClearInterval;
      console.error('Admin dashboard enhancement loader:',e);
    });
})();