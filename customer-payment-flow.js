(() => {
  'use strict';

  const UPI_ID = '9785438345@axl';
  const PAYEE = 'PRAKASH CHAND SWAMI';
  const SEEN_KEY = 'balaji_customer_notifications_seen_at';
  const $ = id => document.getElementById(id);
  const moneyLocal = n => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits:2});
  const escLocal = v => String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const projectName = p => p?.project_name || p?.work_type || 'Project';

  function projectFromCard(card){
    if(!card || typeof projects==='undefined') return null;
    const title=card.querySelector('h3')?.textContent?.replace(/^🏗️\s*/,'').trim();
    return projects.find(p=>projectName(p)===title) || null;
  }

  function removeOldSelectors(){
    document.querySelectorAll('.amountOptions').forEach(el=>el.remove());
  }

  function patchPaymentCards(){
    removeOldSelectors();
    document.querySelectorAll('.payCard').forEach(card=>{
      const project=projectFromCard(card);
      if(!project) return;
      const method=card.querySelector('.method');
      if(!method) return;
      if(!method.querySelector('[data-customer-payment-amount]')){
        const wrap=document.createElement('div');
        wrap.setAttribute('data-customer-payment-amount','1');
        wrap.style.cssText='margin-top:12px';
        wrap.innerHTML='<label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">Payment Amount</label><input data-payment-amount-input type="number" min="1" step="0.01" placeholder="₹ Amount" style="margin-bottom:9px"><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-pay-upi>📲 Pay via UPI</button><button type="button" class="btn secondary" data-pay-bank>🏦 Bank Transfer Payment</button></div><div class="muted" style="margin-top:7px">Payment करने के बाद reference/UTR डालकर history में तुरंत Paid/Received record होगा।</div>';
        method.appendChild(wrap);
        wrap.querySelector('[data-pay-upi]').addEventListener('click',()=>launchUpi(project,wrap.querySelector('[data-payment-amount-input]').value));
        wrap.querySelector('[data-pay-bank]').addEventListener('click',()=>openSubmit(project,wrap.querySelector('[data-payment-amount-input]').value,'Bank Transfer'));
      }
      const oldLink=method.querySelector('a[href^="upi://pay"]');
      if(oldLink) oldLink.remove();
    });
  }

  function validateAmount(project,raw){
    const amount=Number(String(raw??'').replace(/[^0-9.]/g,''));
    const due=Math.max(0,Number(project?.agreed_amount||0)-Number(typeof projectPaid==='function'?projectPaid(project.id):0));
    if(!Number.isFinite(amount)||amount<=0){toastSafe('सही payment amount दर्ज करें');return 0;}
    if(due>0 && amount>due){toastSafe('Payment amount बाकी balance से अधिक नहीं हो सकता।');return 0;}
    return amount;
  }

  function toastSafe(msg){if(typeof toast==='function')toast(msg);else alert(msg);}

  function openSubmit(project, rawAmount, method='UPI'){
    const amount=validateAmount(project,rawAmount);
    if(!amount)return;
    window.selectedProject=project;
    window.selectedAmount=amount;
    if($('paymentProjectName')) $('paymentProjectName').textContent=projectName(project);
    if($('selectedAmountLabel')) $('selectedAmountLabel').textContent=moneyLocal(amount);
    if($('paymentMethod')) $('paymentMethod').value=method;
    if($('paymentRef')) $('paymentRef').value='';
    if($('paymentNote')) $('paymentNote').value='';
    if($('paymentMsg')) $('paymentMsg').textContent='';
    const notice=document.querySelector('#paymentModal .notice');
    if(notice) notice.innerHTML='<b>Payment record:</b> UPI/Bank से payment करने के बाद अपना UTR/Reference Number डालें। Submit होते ही इस project की payment <b>🟢 Paid / Received</b> में save होगी। Admin approval की जरूरत नहीं होगी।';
    if($('paymentModal')) $('paymentModal').classList.add('show');
  }

  function launchUpi(project, rawAmount){
    const amount=validateAmount(project,rawAmount);
    if(!amount)return;
    sessionStorage.setItem('balaji_upi_payment',JSON.stringify({projectId:String(project.id),amount,startedAt:Date.now()}));
    const upi='upi://pay?pa='+encodeURIComponent(UPI_ID)+'&pn='+encodeURIComponent(PAYEE)+'&am='+encodeURIComponent(amount.toFixed(2))+'&cu=INR&tn='+encodeURIComponent('BALAJI Construction - '+projectName(project));
    window.location.href=upi;
  }

  async function submitPaymentDirect(){
    const project=window.selectedProject || (typeof selectedProject!=='undefined'?selectedProject:null);
    const amount=Number(window.selectedAmount || (typeof selectedAmount!=='undefined'?selectedAmount:0));
    if(!project||!amount){toastSafe('Project और payment amount जरूरी है।');return;}
    const ref=$('paymentRef')?.value.trim();
    if(!ref){if($('paymentMsg'))$('paymentMsg').textContent='Transaction / UTR / Reference Number जरूरी है।';return;}
    const method=$('paymentMethod')?.value||'UPI';
    const note=$('paymentNote')?.value.trim()||'';
    const customerId=typeof customer!=='undefined'?customer?.id:null;
    const currentUser=typeof user!=='undefined'?user:null;
    const sbClient=typeof sb!=='undefined'?sb:null;
    if(!sbClient||!customerId||!currentUser){toastSafe('Customer session उपलब्ध नहीं है।');return;}
    const {error}=await sbClient.from('payments').insert({
      project_id:project.id,
      customer_id:customerId,
      payment_date:new Date().toISOString().slice(0,10),
      amount,
      payment_method:method,
      reference_no:ref,
      notes:note||'Customer payment recorded as received.',
      created_by:currentUser.id,
      status:'received'
    });
    if(error){if($('paymentMsg'))$('paymentMsg').textContent='❌ Payment record save नहीं हुई: '+error.message;return;}
    sessionStorage.removeItem('balaji_upi_payment');
    toastSafe('✅ Payment Paid / Received के रूप में save हो गई।');
    if(typeof closePaymentModal==='function')closePaymentModal();
    if(typeof loadPayments==='function')await loadPayments();
    if(typeof renderPayments==='function')renderPayments();
    if(typeof renderHome==='function')renderHome();
    if(typeof renderNotifications==='function')renderNotifications();
  }

  function installPaymentOverrides(){
    const oldRender=window.renderPayments;
    if(typeof oldRender==='function' && !oldRender.__latestPaymentWrapped){
      const wrapped=function(){const r=oldRender.apply(this,arguments);setTimeout(patchPaymentCards,0);return r;};
      wrapped.__latestPaymentWrapped=true;
      window.renderPayments=wrapped;
      setTimeout(patchPaymentCards,0);
    }
    window.submitPayment=submitPaymentDirect;
  }

  function installNotificationReadState(){
    const oldToggle=window.toggleNotifications;
    if(typeof oldToggle==='function' && !oldToggle.__readStateWrapped){
      const wrapped=function(){
        const panel=$('notifyPanel');
        const wasHidden=panel?.classList.contains('hidden');
        const r=oldToggle.apply(this,arguments);
        if(wasHidden){
          localStorage.setItem(SEEN_KEY,String(Date.now()));
          if($('notifyBadge')){$('notifyBadge').textContent='';$('notifyBadge').style.display='none';}
        }
        return r;
      };
      wrapped.__readStateWrapped=true;
      window.toggleNotifications=wrapped;
    }
    const oldRender=window.renderNotifications;
    if(typeof oldRender==='function' && !oldRender.__readStateWrapped){
      const wrapped=function(){
        const r=oldRender.apply(this,arguments);
        const seen=Number(localStorage.getItem(SEEN_KEY)||0);
        const badge=$('notifyBadge');
        if(badge && seen){badge.textContent='';badge.style.display='none';}
        return r;
      };
      wrapped.__readStateWrapped=true;
      window.renderNotifications=wrapped;
    }
  }

  function resumeAfterUpi(){
    const raw=sessionStorage.getItem('balaji_upi_payment');
    if(!raw)return;
    let p;try{p=JSON.parse(raw)}catch(e){sessionStorage.removeItem('balaji_upi_payment');return;}
    if(!p||!p.projectId||!p.amount||Date.now()-Number(p.startedAt||0)>30*60*1000){sessionStorage.removeItem('balaji_upi_payment');return;}
    const list=typeof projects!=='undefined'?projects:[];
    const project=list.find(x=>String(x.id)===String(p.projectId));
    if(!project)return;
    sessionStorage.removeItem('balaji_upi_payment');
    setTimeout(()=>openSubmit(project,p.amount,'UPI'),350);
  }

  function boot(){
    installPaymentOverrides();
    installNotificationReadState();
    patchPaymentCards();
    setTimeout(patchPaymentCards,700);
    setTimeout(patchPaymentCards,1600);
    setTimeout(resumeAfterUpi,900);
  }

  window.addEventListener('load',boot,{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();