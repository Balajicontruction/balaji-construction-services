(()=>{
  const load=(src)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});
  load('worker-avatar-core.js').then(()=>load('enquiry-status-fix.js')).catch(e=>console.error('Admin enquiry fix loader:',e));
})();