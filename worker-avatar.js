(()=>{
  'use strict';
  const load=(src)=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.async=true;
    s.onload=resolve;
    s.onerror=reject;
    document.body.appendChild(s);
  });
  // Load only the lightweight enquiry status fix here.
  // Do not start the heavy worker-avatar polling layer on the Admin Dashboard.
  load('enquiry-status-fix.js').catch(e=>console.error('Enquiry status loader:',e));
})();