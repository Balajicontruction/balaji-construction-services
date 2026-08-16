(()=>{
  'use strict';
  // Keep the Admin Dashboard completely lightweight on login/load.
  // Enquiry enhancement is loaded only when the Enquiries section is opened.
  let enquiryLoaded=false;
  function loadEnquiryFix(){
    if(enquiryLoaded)return;
    enquiryLoaded=true;
    const s=document.createElement('script');
    s.src='enquiry-status-fix.js?v=1';
    s.async=true;
    s.onerror=()=>{console.error('Enquiry status loader failed');enquiryLoaded=false};
    document.body.appendChild(s);
  }
  document.addEventListener('click',e=>{
    const b=e.target?.closest?.('[data-page="enquiries"]');
    if(b)loadEnquiryFix();
  },true);
})();
