(() => {
  'use strict';
  const UPI_ID = '9785438345@axl';
  const PAYEE = 'PRAKASH CHAND SWAMI';
  const KEY = 'balaji_pending_upi_payment';
  const AMOUNTS = [5000,10000,20000,50000,100000];
  const $ = id => document.getElementById(id);
  const moneyLocal = n => '₹' + Number(n || 0).toLocaleString('en-IN',{maximumFractionDigits:2});
  const getProject = () => (typeof selectedProject !== 'undefined' ? selectedProject : null);
  const getAmount = () => Number(typeof selectedAmount !== 'undefined' ? selectedAmount : 0);
  const setAmount = n => { try { selectedAmount = Number(n); } catch(e){} };
  function projectName(p){ return p?.project_name || p?.work_type || 'Project'; }
  function projectId(p){ return String(p?.id || ''); }
  function openSubmit(project, amount, method='UPI'){
    if (!project || !projectId(project) || !amount) { if(typeof toast==='function') toast('पहले project और amount select करें'); return; }
    setAmount(amount);
    try { selectedProject = project; } catch(e){}
    $('paymentProjectName').textContent = projectName(project);
    $('selectedAmountLabel').textContent = moneyLocal(amount);
    $('paymentMethod').value = method;
    $('paymentRef').value = '';
    $('paymentNote').value = '';
    $('paymentMsg').textContent = '';
    $('paymentModal').classList.add('show');
  }
  function launchUpi(project, amount){
    if (!project || !projectId(project)) { if(typeof toast==='function') toast('Project select नहीं है'); return; }
    amount = Number(amount || getAmount());
    if (!amount || amount <= 0) { if(typeof toast==='function') toast('Payment amount select करें'); return; }
    sessionStorage.setItem(KEY, JSON.stringify({projectId:projectId(project),projectName:projectName(project),amount,startedAt:Date.now()}));
    const upi = 'upi://pay?pa=' + encodeURIComponent(UPI_ID) + '&pn=' + encodeURIComponent(PAYEE) + '&am=' + encodeURIComponent(amount.toFixed(2)) + '&cu=INR&tn=' + encodeURIComponent('BALAJI Construction - ' + projectName(project));
    window.location.href = upi;
  }
  function resumeAfterUpi(){
    const raw = sessionStorage.getItem(KEY); if(!raw) return;
    let p; try { p=JSON.parse(raw); } catch(e){ sessionStorage.removeItem(KEY); return; }
    if(!p || !p.projectId || !p.amount || Date.now()-Number(p.startedAt||0) > 30*60*1000) { sessionStorage.removeItem(KEY); return; }
    const project = (typeof projects !== 'undefined' ? projects : []).find(x => String(x.id) === String(p.projectId));
    if(!project) return;
    sessionStorage.removeItem(KEY);
    setTimeout(() => openSubmit(project, Number(p.amount), 'UPI'), 350);
  }
  function ensureAmountButtons(){
    document.querySelectorAll('.amountOptions').forEach(box => {
      const existing = new Set([...box.querySelectorAll('.amountBtn')].map(b => Number(b.dataset.amount || (b.textContent||'').replace(/[^0-9]/g,''))));
      AMOUNTS.forEach(amount => {
        if(existing.has(amount)) return;
        const b=document.createElement('button'); b.type='button'; b.className='amountBtn'; b.dataset.amount=String(amount); b.textContent=moneyLocal(amount);
        b.addEventListener('click', () => { box.querySelectorAll('.amountBtn').forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); setAmount(amount); });
        box.appendChild(b);
      });
    });
  }
  document.addEventListener('click', (ev) => {
    const amountBtn = ev.target.closest?.('.amountBtn');
    if(amountBtn){ const amount=Number(amountBtn.dataset.amount || (amountBtn.textContent||'').replace(/[^0-9]/g,'')); if(amount){ setAmount(amount); const box=amountBtn.closest('.amountOptions'); box?.querySelectorAll('.amountBtn').forEach(x=>x.classList.remove('selected')); amountBtn.classList.add('selected'); } return; }
    const btn=ev.target.closest?.('button, a'); if(!btn) return;
    if(/Pay\s+via\s+UPI/i.test(btn.textContent||'')){ ev.preventDefault(); ev.stopImmediatePropagation(); launchUpi(getProject(),getAmount()); }
  }, true);
  const observer = new MutationObserver(ensureAmountButtons); observer.observe(document.body,{childList:true,subtree:true});
  setInterval(ensureAmountButtons,1200);
  window.addEventListener('pageshow',resumeAfterUpi);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resumeAfterUpi();});
  window.addEventListener('load',()=>{ensureAmountButtons();setTimeout(resumeAfterUpi,700);});
  setTimeout(ensureAmountButtons,300);
})();