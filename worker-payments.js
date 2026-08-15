/* BALAJI Construction — Worker Card Payment Add-on
   IMPORTANT:
   This file only adds worker-card payment / UPI / receipt / history UI.
   It does NOT change Worker Add, Worker Save, Face Registration/Verification,
   Edit Worker, or Attendance Details logic.
*/
(()=>{
'use strict';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const money=v=>'₹'+num(v).toLocaleString('en-IN');
const today=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};

let payments=[];
let workersCache=[];
let attendanceRows=[];
let started=false;

function getSB(){return window.sb||((typeof sb!=='undefined')?sb:null)}
function toastSafe(message){if(typeof window.toast==='function')window.toast(message);else alert(message)}

function styles(){
  if(document.getElementById('adminWorkerPaymentStyles'))return;
  const s=document.createElement('style');
  s.id='adminWorkerPaymentStyles';
  s.textContent=`
    .workerPaymentBox{margin-top:16px;padding:15px;border:1px solid #dfe7ef;border-radius:17px;background:linear-gradient(180deg,#f8fafc,#f3f7fb)}
    .workerPaymentTitle{font-size:18px;font-weight:900;color:#10233b;margin-bottom:11px}
    .workerPaymentStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
    .workerPaymentStat{background:#fff;border:1px solid #e5eaf0;border-radius:13px;padding:11px}
    .workerPaymentStat span{display:block;font-size:12px;font-weight:800;color:#64748b}
    .workerPaymentStat strong{display:block;margin-top:5px;font-size:19px}
    .workerPaymentStat.earned{background:#fffaf3}.workerPaymentStat.paid{background:#effcf3}.workerPaymentStat.pending{background:#fff1f1}
    .workerPaymentButtons{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
    .workerUpiBox{margin-top:10px;padding:10px 12px;background:#fff;border:1px dashed #cbd5e1;border-radius:11px;font-size:12px;color:#64748b}
    .workerUpiBox b{color:#10233b}
    .workerUpiPay{background:#16a34a!important;color:#fff!important}
    .workerPaymentHistory{margin-top:11px}
    .workerPaymentHistory details{background:#fff;border:1px solid #e5eaf0;border-radius:12px;padding:9px}
    .workerPaymentHistory summary{cursor:pointer;font-weight:900}
    .workerPaymentHistory .tableWrap{overflow-x:auto;margin-top:9px}
    .workerPaymentHistory table{width:100%;border-collapse:collapse;min-width:650px;font-size:12px}
    .workerPaymentHistory th,.workerPaymentHistory td{padding:8px;border-bottom:1px solid #edf1f4;text-align:left;vertical-align:middle}
    .workerPaymentHistory th{background:#f4f7fa;color:#60738a}
    .workerReceiptThumb{width:58px;height:45px;object-fit:cover;border-radius:7px;border:1px solid #dbe3ea;vertical-align:middle}
    .workerProfilePhoto{width:62px;height:62px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.12);display:block}
    .workerPaymentModal .modalBox{max-width:620px}
    .workerPaymentSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}
    .workerPaymentSummary div{background:#f6f8fb;border-radius:10px;padding:10px}
    .workerPaymentSummary span{display:block;font-size:11px;color:#64748b;font-weight:800}.workerPaymentSummary strong{font-size:16px}
    @media(max-width:700px){.workerPaymentStats,.workerPaymentSummary{grid-template-columns:1fr}.workerPaymentStat:last-child{grid-column:auto}}
  `;
  document.head.appendChild(s);
}

async function refreshData(){
  const sb=getSB();
  if(!sb)return;
  try{
    const r=await sb.from('workers').select('*').order('created_at',{ascending:false});
    if(!r.error)workersCache=r.data||[];
  }catch(e){console.warn('worker payment workers:',e)}
  try{
    const r=await sb.from('worker_attendance').select('*');
    attendanceRows=r.error?[]:(r.data||[]);
  }catch(e){attendanceRows=[]}
  try{
    const r=await sb.from('worker_payments').select('*').order('payment_date',{ascending:false}).order('created_at',{ascending:false});
    payments=r.error?[]:(r.data||[]);
  }catch(e){payments=[]}
  window.__workerAdminPaymentCache=payments;
}

function workerList(){
  if(workersCache.length)return workersCache;
  if(Array.isArray(window.__workerAdminCache))return window.__workerAdminCache;
  return [];
}
function getWorker(id){return workerList().find(w=>String(w.id)===String(id))||null}

function attendanceFor(w){
  const rows=attendanceRows.filter(x=>String(x.worker_id||x.workerId)===String(w.id));
  let present=0,total=0;
  rows.forEach(x=>{
    total++;
    const st=String(x.status||x.attendance||'').toLowerCase().trim();
    if(['present','p','yes','1','full day'].includes(st))present++;
    else if(['half','half day','0.5'].includes(st))present+=.5;
  });
  if(!rows.length&&window.workerAttendanceMap?.[w.id]){
    const a=window.workerAttendanceMap[w.id];
    return {present:Number(a.present||0),total:Number(a.total||0)};
  }
  return {present,total};
}

function wageFor(w){return num(w.daily_rate??w.daily_wage??w.wage??w.daily_salary)}
function earnedFor(w){return wageFor(w)*attendanceFor(w).present}
function paymentRowsFor(w){return payments.filter(p=>String(p.worker_id)===String(w.id))}
function paidFor(w){return paymentRowsFor(w).reduce((sum,p)=>sum+num(p.amount),0)}

function upiFor(w){return String(w.upi_id||w.upi||w.upi_number||w.payment_upi||'').trim()}
function upiUrl(w,pending){
  const pa=upiFor(w);
  if(!pa||pending<=0)return '';
  return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(w.name||w.worker_name||'Worker')}&am=${num(pending).toFixed(2)}&cu=INR`;
}

function imageFor(w){
  return String(w.photo_url||w.image_url||w.worker_image||w.profile_photo||w.avatar_url||w.photo||'').trim();
}

function receiptHTML(url){
  if(!url)return '—';
  const safe=esc(url);
  if(String(url).startsWith('data:image/'))return `<a href="${safe}" target="_blank" rel="noopener"><img class="workerReceiptThumb" src="${safe}" alt="Receipt"></a>`;
  return `<a class="btn btn-light btn-sm" href="${safe}" target="_blank" rel="noopener">🧾 Receipt</a>`;
}

function cardWorker(card,index){
  const edit=card.querySelector('button[onclick*="editWorker("]');
  const m=edit?.getAttribute('onclick')?.match(/editWorker\(['\"]([^'\"]+)/);
  if(m){const w=getWorker(m[1]);if(w)return w}
  return workerList()[index]||null;
}

function panelHTML(w){
  const a=attendanceFor(w);
  const wage=wageFor(w);
  const earned=earnedFor(w);
  const paid=paidFor(w);
  const pending=Math.max(0,earned-paid);
  const hist=paymentRowsFor(w);
  const upi=upiFor(w);
  const payLink=upiUrl(w,pending);

  return `<div class="workerPaymentBox" data-worker-payment="${esc(w.id)}">
    <div class="workerPaymentTitle">💰 Worker Payment</div>
    <div class="workerPaymentStats">
      <div class="workerPaymentStat earned"><span>💰 Total Earnings</span><strong>${money(earned)}</strong><small style="color:#64748b">${a.present} paid-work day${a.present===1?'':'s'} × ${money(wage)}</small></div>
      <div class="workerPaymentStat paid"><span>🟢 Paid / दिया हुआ</span><strong class="green">${money(paid)}</strong></div>
      <div class="workerPaymentStat pending"><span>🔴 Pending / बाकी</span><strong class="red">${money(pending)}</strong></div>
    </div>
    <div class="workerPaymentButtons">
      <button type="button" class="btn btn-primary btn-sm" onclick="adminWorkerPayment('${esc(w.id)}')">💸 Payment Update</button>
      <button type="button" class="btn btn-light btn-sm" onclick="adminSetWorkerUpi('${esc(w.id)}')">📲 ${upi?'UPI Edit':'UPI Set'}</button>
      ${payLink?`<a class="btn btn-sm workerUpiPay" href="${esc(payLink)}">📲 Pending ${money(pending)} Pay</a>`:''}
    </div>
    ${upi?`<div class="workerUpiBox">📲 UPI ID: <b>${esc(upi)}</b>${pending>0?` • <b style="color:#dc2626">${money(pending)} बाकी</b>`:''}</div>`:`<div class="workerUpiBox">📲 UPI ID अभी set नहीं है। <button type="button" class="btn btn-blue btn-sm" style="margin-left:6px" onclick="adminSetWorkerUpi('${esc(w.id)}')">UPI Set करें</button></div>`}
    <div class="workerPaymentHistory">
      <details>
        <summary>📜 Payment History (${hist.length})</summary>
        ${hist.length?`<div class="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Receipt</th><th>Action</th></tr></thead><tbody>${hist.map(p=>`<tr><td>${esc(p.payment_date||p.date||'—')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||p.method||'—')}</td><td>${esc(p.reference_no||p.utr||p.reference||'—')}</td><td>${receiptHTML(p.receipt_url)}</td><td><div class="actions"><button type="button" class="btn btn-blue btn-sm" onclick="adminEditWorkerPayment('${esc(p.id)}')">✏️ Edit</button><button type="button" class="btn btn-red btn-sm" onclick="adminDeleteWorkerPayment('${esc(p.id)}')">🗑️ Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="margin-top:10px">अभी कोई payment record नहीं है।</div>'}
      </details>
    </div>
  </div>`;
}

function patchCards(){
  const box=document.getElementById('workersList');
  if(!box)return;
  [...box.querySelectorAll('.workerCard')].forEach((card,index)=>{
    const w=cardWorker(card,index);
    if(!w)return;

    // Only replace the visual avatar; no worker-save/face/attendance code is touched.
    const avatar=card.querySelector('.workerHead .avatar');
    const img=imageFor(w);
    if(avatar&&img){
      const safe=esc(img);
      avatar.outerHTML=`<img class="workerProfilePhoto" src="${safe}" alt="${esc(w.name||w.worker_name||'Worker')}" loading="lazy" onerror="this.outerHTML='<div class=&quot;avatar&quot;>${esc((w.name||w.worker_name||'W').charAt(0).toUpperCase())}</div>'">`;
    }

    card.querySelector('[data-worker-payment]')?.remove();
    const actions=card.querySelector('.actions');
    if(actions)actions.insertAdjacentHTML('beforebegin',panelHTML(w));
  });
}

function showPaymentModal(worker,payment=null){
  document.getElementById('adminWorkerPaymentModal')?.remove();
  const oldAmount=payment?num(payment.amount):0;
  const earned=earnedFor(worker);
  const basePaid=paidFor(worker);
  const pending=Math.max(0,earned-(basePaid-oldAmount));

  const m=document.createElement('div');
  m.className='modal workerPaymentModal';
  m.id='adminWorkerPaymentModal';
  m.innerHTML=`<div class="modalBox">
    <div class="modalHead"><h3>${payment?'✏️ Edit Worker Payment':'💸 Worker Payment Update'}</h3><button class="close" type="button">×</button></div>
    <strong>${esc(worker.name||worker.worker_name||'Worker')}</strong>
    <div class="workerPaymentSummary"><div><span>Total Earnings</span><strong>${money(earned)}</strong></div><div><span>Paid</span><strong class="green">${money(basePaid-oldAmount)}</strong></div><div><span>Pending</span><strong class="red">${money(pending)}</strong></div></div>
    <form id="adminWorkerPaymentForm">
      <input type="hidden" id="adminPaymentId" value="${esc(payment?.id||'')}">
      <div class="formGrid">
        <div class="field"><label>Payment Amount (₹)</label><input id="adminPaymentAmount" type="number" min="1" step="0.01" required value="${payment?esc(payment.amount):(pending>0?esc(pending):'')}"></div>
        <div class="field"><label>Payment Date</label><input id="adminPaymentDate" type="date" required value="${esc(payment?.payment_date||today())}"></div>
        <div class="field"><label>Payment Method</label><select id="adminPaymentMethod"><option>UPI</option><option>Cash</option><option>Bank</option></select></div>
        <div class="field"><label>UTR / Reference</label><input id="adminPaymentReference" value="${esc(payment?.reference_no||payment?.utr||'')}"></div>
        <div class="field full"><label>Receipt / Screenshot</label><input id="adminPaymentReceipt" type="file" accept="image/*,.pdf"><span class="uploadHint">Payment receipt की photo/PDF Worker की history में save होगी।</span>${payment?.receipt_url?`<div style="margin-top:8px">Current: ${receiptHTML(payment.receipt_url)}</div>`:''}</div>
        <div class="field full"><label>Notes</label><textarea id="adminPaymentNotes">${esc(payment?.notes||'')}</textarea></div>
      </div>
      <div class="modalActions"><button type="button" class="btn btn-light" id="adminPaymentCancel">Cancel</button><button class="btn btn-green" type="submit">💾 ${payment?'Update Payment':'Save Payment'}</button></div>
    </form>
  </div>`;
  document.body.appendChild(m);
  m.classList.add('show');
  m.querySelector('.close').onclick=()=>m.remove();
  m.querySelector('#adminPaymentCancel').onclick=()=>m.remove();
  m.addEventListener('click',e=>{if(e.target===m)m.remove()});
  m.querySelector('#adminPaymentMethod').value=payment?.payment_method||payment?.method||'UPI';

  m.querySelector('form').onsubmit=async e=>{
    e.preventDefault();
    const sb=getSB();
    if(!sb)return toastSafe('❌ Supabase उपलब्ध नहीं है');
    const amount=num(document.getElementById('adminPaymentAmount').value);
    if(amount<=0)return toastSafe('❌ सही payment amount डालें');
    const file=document.getElementById('adminPaymentReceipt').files[0];
    let receipt=payment?.receipt_url||null;
    if(file){
      if(file.size>4*1024*1024)return toastSafe('❌ Receipt 4MB से छोटी रखें');
      try{receipt=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Receipt read failed'));r.readAsDataURL(file)})}
      catch(err){return toastSafe('❌ Receipt process नहीं हुई: '+err.message)}
    }
    const payload={worker_id:worker.id,amount,payment_date:document.getElementById('adminPaymentDate').value||today(),payment_method:document.getElementById('adminPaymentMethod').value,reference_no:document.getElementById('adminPaymentReference').value.trim()||null,notes:document.getElementById('adminPaymentNotes').value.trim(),receipt_url:receipt};
    const id=document.getElementById('adminPaymentId').value;
    const r=id?await sb.from('worker_payments').update(payload).eq('id',id):await sb.from('worker_payments').insert(payload);
    if(r.error)return toastSafe('❌ Worker payment save नहीं हुई: '+r.error.message);
    m.remove();
    toastSafe(id?'✅ Worker payment updated':'✅ Worker payment save हो गई');
    await refreshData();
    patchCards();
  };
}

window.adminWorkerPayment=workerId=>{const w=getWorker(workerId);if(w)showPaymentModal(w)};
window.adminEditWorkerPayment=paymentId=>{const p=payments.find(x=>String(x.id)===String(paymentId));const w=p?getWorker(p.worker_id):null;if(p&&w)showPaymentModal(w,p)};
window.adminDeleteWorkerPayment=async paymentId=>{
  const sb=getSB();
  if(!sb)return toastSafe('❌ Supabase उपलब्ध नहीं है');
  if(!confirm('क्या यह Worker payment permanently delete करना है?'))return;
  const r=await sb.from('worker_payments').delete().eq('id',paymentId);
  if(r.error)return toastSafe('❌ Payment delete नहीं हुई: '+r.error.message);
  toastSafe('🗑️ Worker payment deleted');
  await refreshData();
  patchCards();
};
window.adminSetWorkerUpi=async workerId=>{
  const sb=getSB(),w=getWorker(workerId);
  if(!sb||!w)return;
  const value=prompt(`Worker: ${w.name||w.worker_name||'Worker'}\nUPI ID डालें (जैसे 9876543210@upi):`,upiFor(w));
  if(value===null)return;
  const clean=value.trim();
  const r=await sb.from('workers').update({upi_id:clean||null}).eq('id',workerId);
  if(r.error)return toastSafe('❌ UPI save नहीं हुआ: '+r.error.message);
  w.upi_id=clean||null;
  if(Array.isArray(window.__workerAdminCache)){
    const c=window.__workerAdminCache.find(x=>String(x.id)===String(workerId));
    if(c)c.upi_id=clean||null;
  }
  toastSafe('✅ Worker UPI updated');
  await refreshData();
  patchCards();
};

async function boot(){
  if(started)return;
  started=true;
  styles();
  for(let i=0;i<100;i++){
    if(getSB()&&document.getElementById('workersList'))break;
    await wait(200);
  }
  if(!document.getElementById('workersList')){started=false;return}
  await refreshData();
  patchCards();

  const box=document.getElementById('workersList');
  new MutationObserver(()=>setTimeout(patchCards,60)).observe(box,{childList:true,subtree:true});

  const oldLoadAll=window.loadAll;
  if(oldLoadAll&&!oldLoadAll.__workerPaymentWrapped){
    const wrapped=async function(...args){
      const result=await oldLoadAll.apply(this,args);
      await wait(120);
      await refreshData();
      patchCards();
      return result;
    };
    wrapped.__workerPaymentWrapped=true;
    window.loadAll=wrapped;
  }

  patchCards();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
