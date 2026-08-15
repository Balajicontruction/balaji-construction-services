(() => {
  'use strict';

  const UPI_ID = '9785438345@axl';
  const PAYEE = 'PRAKASH CHAND SWAMI';
  const KEY = 'balaji_pending_upi_payment';
  const $ = id => document.getElementById(id);
  const moneyLocal = n => '₹' + Number(n || 0).toLocaleString('en-IN', {maximumFractionDigits:2});
  const getProject = () => (typeof selectedProject !== 'undefined' ? selectedProject : null);
  const getAmount = () => Number(typeof selectedAmount !== 'undefined' ? selectedAmount : 0);
  const setAmount = n => { try { selectedAmount = Number(n); } catch(e) {} };
  function projectName(p){ return p?.project_name || p?.work_type || 'Project'; }
  function projectId(p){ return String(p?.id || ''); }

  function askAmount(){
    const raw = prompt('Payment amount दर्ज करें (₹):');
    if(raw === null) return 0;
    const amount = Number(String(raw).replace(/[^0-9.]/g,''));
    if(!amount || amount <= 0){
      if(typeof toast === 'function') toast('सही payment amount दर्ज करें');
      return 0;
    }
    setAmount(amount);
    return amount;
  }

  function removeOldSelectors(){
    document.querySelectorAll('.amountOptions').forEach(el => el.remove());
  }

  function openSubmit(project, amount, method='UPI'){
    if (!project || !projectId(project) || !amount) {
      if(typeof toast === 'function') toast('पहले project और payment amount select करें');
      return;
    }
    setAmount(amount);
    try { selectedProject = project; } catch(e) {}
    if($('paymentProjectName')) $('paymentProjectName').textContent = projectName(project);
    if($('selectedAmountLabel')) $('selectedAmountLabel').textContent = moneyLocal(amount);
    if($('paymentMethod')) $('paymentMethod').value = method;
    if($('paymentRef')) $('paymentRef').value = '';
    if($('paymentNote')) $('paymentNote').value = '';
    if($('paymentMsg')) $('paymentMsg').textContent = '';
    if($('paymentModal')) $('paymentModal').classList.add('show');
  }

  function launchUpi(project, amount){
    if (!project || !projectId(project)) {
      if(typeof toast === 'function') toast('Project select नहीं है');
      return;
    }
    amount = Number(amount || getAmount());
    if (!amount || amount <= 0) amount = askAmount();
    if (!amount || amount <= 0) return;

    sessionStorage.setItem(KEY, JSON.stringify({
      projectId: projectId(project),
      projectName: projectName(project),
      amount,
      startedAt: Date.now()
    }));

    const upi = 'upi://pay?pa=' + encodeURIComponent(UPI_ID) +
      '&pn=' + encodeURIComponent(PAYEE) +
      '&am=' + encodeURIComponent(amount.toFixed(2)) +
      '&cu=INR&tn=' + encodeURIComponent('BALAJI Construction - ' + projectName(project));
    window.location.href = upi;
  }

  function resumeAfterUpi(){
    const raw = sessionStorage.getItem(KEY);
    if(!raw) return;
    let p;
    try { p = JSON.parse(raw); } catch(e) { sessionStorage.removeItem(KEY); return; }
    if(!p || !p.projectId || !p.amount || Date.now() - Number(p.startedAt || 0) > 30*60*1000){
      sessionStorage.removeItem(KEY);
      return;
    }
    const list = (typeof projects !== 'undefined' ? projects : []);
    const project = list.find(x => String(x.id) === String(p.projectId));
    if(!project) return;
    sessionStorage.removeItem(KEY);
    setTimeout(() => openSubmit(project, Number(p.amount), 'UPI'), 350);
  }

  // One delegated click handler only. No MutationObserver is used here;
  // the previous observer repeatedly watched the whole dashboard DOM and
  // could make the laptop/browser freeze while sections were rendering.
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('button, a');
    if(!btn) return;
    if(/Pay\s+via\s+UPI/i.test(btn.textContent || '')){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      launchUpi(getProject(), getAmount());
    }
  }, true);

  function start(){
    removeOldSelectors();
    setTimeout(removeOldSelectors, 500);
    setTimeout(resumeAfterUpi, 700);
  }

  window.addEventListener('pageshow', resumeAfterUpi);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') resumeAfterUpi(); });
  window.addEventListener('load', start, {once:true});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else setTimeout(start, 0);
})();