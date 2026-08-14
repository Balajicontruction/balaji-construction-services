/* BALAJI Construction - Worker Payment Module
   Admin-only controls. Worker payment/attendance remains read-only for workers. */
(function(){
  'use strict';
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>'₹'+Number(v||0).toLocaleString('en-IN');
  const num=v=>Number(v||0);
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  let wpRows=[];

  function style(){
    if(document.getElementById('workerPaymentStyles'))return;
    const s=document.createElement('style');s.id='workerPaymentStyles';s.textContent=`
      .workerPayBox{margin-top:18px;padding:16px;border-radius:16px;background:#f7fafc;border:1px solid #e1e8ef}
      .workerPayGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .workerPayStat{background:#fff;border-radius:12px;padding:12px;border:1px solid #e5ebf0}
      .workerPayStat span{display:block;color:#60738a;font-size:12px;font-weight:700}.workerPayStat strong{display:block;margin-top:5px;font-size:19px}
      .workerPayActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.workerPayHistory{margin-top:12px;font-size:12px}.workerPayHistory details{background:#fff;border:1px solid #e5ebf0;border-radius:10px;padding:8px}.workerPayHistory table{min-width:0;font-size:12px}.workerPayHistory td,.workerPayHistory th{padding:7px}
      .upiPay{background:#16a34a!important;color:#fff!important}.receiptLink{display:inline-block;margin-left:6px}
      @media(max-width:700px){.workerPayGrid{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(s);
  }

  async function load(){
    if(!window.sb || !Array.isArray(window.workers)) return false;
    const {data,error}=await sb.from('worker_payments').select('*').order('payment_date',{ascending:false}).order('created_at',{ascending:false});
    if(error){console.warn('worker_payments load:',error);wpRows=[];} else wpRows=data||[];
    render(); return true;
  }

  function attendanceFor(w){
    const a=window.workerAttendanceMap?.[w.id];
    return a?Number(a.present||0):0;
  }
  function paidFor(w){return wpRows.filter(p=>String(p.worker_id)===String(w.id)).reduce((s,p)=>s+num(p.amount),0)}
  function render(){
    const box=document.getElementById('workersList'); if(!box||!Array.isArray(window.workers))return;
    const oldScroll=window.scrollY;
    box.innerHTML=workers.length?workers.map(workerHTML).join(''):'<div class="empty">कोई Worker नहीं मिला।</div>';
    window.scrollTo(0,oldScroll);
  }
  function workerHTML(w){
    const name=w.name||w.worker_name||'Worker',role=w.work_role||w.role||w.designation||'—';
    const wage=num(w.daily_rate??w.daily_wage??w.wage??w.daily_salary),present=attendanceFor(w),earned=wage*present,paid=paidFor(w),pending=Math.max(0,earned-paid);
    const phone=w.phone||w.mobile||'—',hist=wpRows.filter(p=>String(p.worker_id)===String(w.id));
    const upi=String(w.upi_id||'').trim();
    const upiLink=upi?`upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(pending.toFixed(2))}&cu=INR`:'#';
    return `<div class="workerCard"><div class="workerHead"><div class="avatar">${esc(name.charAt(0)).toUpperCase()}</div><div><h3>${esc(name)}</h3><p>${esc(role)}</p></div></div><div class="workerInfo">
      <div class="workerRow"><span>Mobile</span><strong>${esc(phone)}</strong></div>
      <div class="workerRow"><span>Daily Wage</span><strong>${money(wage)}</strong></div>
      <div class="workerRow"><span>Attendance</span><strong>${present} days</strong></div>
      <div class="workerRow"><span>Village</span><strong>${esc(w.village||'—')}</strong></div>
      <div class="workerPayBox"><strong style="font-size:17px">💰 Worker Payment</strong><div class="workerPayGrid" style="margin-top:10px">
        <div class="workerPayStat"><span>Total Earnings</span><strong>${money(earned)}</strong></div><div class="workerPayStat"><span>Paid</span><strong class="green">${money(paid)}</strong></div><div class="workerPayStat"><span>Pending</span><strong class="red">${money(pending)}</strong></div>
      </div><div class="workerPayActions"><button class="btn btn-primary btn-sm" onclick="openWorkerPayment('${esc(w.id)}')">💸 Payment Update</button>${pending>0&&upi?`<a class="btn btn-green btn-sm upiPay" href="${esc(upiLink)}">📲 UPI से ₹${Number(pending).toLocaleString('en-IN')} Pay</a>`:''}${upi?`<span class="uploadHint" style="align-self:center">UPI: ${esc(upi)}</span>`:''}</div>
      ${hist.length?`<div class="workerPayHistory"><details><summary>📜 Payment History (${hist.length})</summary><div class="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th></tr></thead><tbody>${hist.map(p=>`<tr><td>${esc(p.payment_date||'—')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||'—')}</td><td>${p.receipt_url?`<a class="btn btn-blue btn-sm receiptLink" href="${esc(p.receipt_url)}" target="_blank" rel="noopener">🧾 Receipt</a>`:'—'}</td></tr>`).join('')}</tbody></table></div></details></div>`:''}</div>
      <div class="actions" style="margin-top:15px"><button class="btn btn-blue btn-sm" onclick="editWorker('${esc(w.id)}')">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteWorker('${esc(w.id)}')">🗑️ Delete</button></div>
    </div></div>`;
  }

  window.openWorkerPayment=async function(workerId){
    const w=workers.find(x=>String(x.id)===String(workerId));if(!w)return;
    const earned=num(w.daily_rate??w.daily_wage??w.wage??0)*attendanceFor(w),paid=paidFor(w),pending=Math.max(0,earned-paid);
    const amount=prompt(`Worker: ${w.name||'Worker'}\nTotal earnings: ${money(earned)}\nAlready paid: ${money(paid)}\nPending: ${money(pending)}\n\nआज कितना भुगतान किया?`,pending>0?String(pending):'');
    if(amount===null)return; const val=num(amount); if(!(val>0)){alert('सही payment amount डालें।');return;}
    if(val>pending){if(!confirm(`Payment ${money(val)} है जबकि pending ${money(pending)} है। फिर भी save करना है?`))return;}
    const method=prompt('Payment method लिखें (UPI / Cash / Bank):','UPI');if(method===null)return;
    const ref=prompt('Reference / UTR number (optional):','');
    let receipt=null; const pick=document.createElement('input');pick.type='file';pick.accept='image/*,application/pdf';
    const file=await new Promise(resolve=>{pick.onchange=()=>resolve(pick.files[0]||null);pick.click();setTimeout(()=>{if(!pick.files.length)resolve(null)},120000)});
    if(file){try{receipt=await fileToDataUrl(file)}catch(e){alert('Receipt process नहीं हुई: '+e.message);return;}}
    const user=(await sb.auth.getUser()).data?.user;
    const payload={worker_id:workerId,payment_date:today(),amount:val,payment_method:method.trim(),notes:'Admin worker payment',created_by:user?.id||null,receipt_url:receipt,reference_no:ref?.trim()||null};
    const {error}=await sb.from('worker_payments').insert(payload);if(error){alert('Payment save नहीं हुई: '+error.message);return;}
    alert('✅ Worker payment save हो गई'); await load();
  };

  function fileToDataUrl(file){return new Promise((resolve,reject)=>{if(file.size>4*1024*1024)return reject(new Error('Receipt 4MB से छोटी रखें'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('File read failed'));r.readAsDataURL(file)})}

  async function boot(){
    style();
    for(let i=0;i<80;i++){if(window.sb&&window.workers&&document.getElementById('workersList'))break;await wait(250)}
    if(!window.sb)return;
    await load();
    const originalLoadAll=window.loadAll;
    if(originalLoadAll&&!originalLoadAll.__workerPaymentWrapped){window.loadAll=async function(){const r=await originalLoadAll.apply(this,arguments);await load();return r};window.loadAll.__workerPaymentWrapped=true}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
