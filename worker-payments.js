/* BALAJI Construction — Admin Worker Payments
   Stable overlay module: never replaces worker cards, so Face Verification and Attendance stay intact.
   v4: payment panel + paid/pending + UPI + receipt history
*/
(()=>{
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const money=v=>'₹'+num(v).toLocaleString('en-IN');
const today=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};
let rows=[];
let observerStarted=false;

function styles(){
 if(document.getElementById('workerPaymentOverlayStyles'))return;
 const s=document.createElement('style');s.id='workerPaymentOverlayStyles';
 s.textContent=`
 .adminWorkerPay{margin:16px 0 4px;padding:15px;border:1px solid #e2e8f0;border-radius:15px;background:#f8fafc}
 .adminWorkerPayTitle{font-size:17px;font-weight:900;margin-bottom:10px}
 .adminWorkerPayGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
 .adminWorkerPayStat{background:#fff;border:1px solid #e5eaf0;border-radius:11px;padding:10px}
 .adminWorkerPayStat span{display:block;font-size:11px;font-weight:800;color:#64748b}
 .adminWorkerPayStat strong{display:block;margin-top:4px;font-size:18px}
 .adminWorkerPayActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
 .adminWorkerPayHistory{margin-top:10px}
 .adminWorkerPayHistory details{background:#fff;border:1px solid #e5eaf0;border-radius:10px;padding:8px}
 .adminWorkerPayHistory table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
 .adminWorkerPayHistory th,.adminWorkerPayHistory td{padding:7px;border-bottom:1px solid #edf0f3;text-align:left}
 .adminUpi{background:#16a34a!important;color:#fff!important;border-color:#16a34a!important}
 .adminReceipt{display:inline-block;margin-top:4px}
 @media(max-width:700px){.adminWorkerPayGrid{grid-template-columns:1fr 1fr}.adminWorkerPayStat:last-child{grid-column:1/-1}}
 `;
 document.head.appendChild(s);
}

function attendanceDays(w){
 const a=window.workerAttendanceMap?.[w.id];
 if(a&&Number.isFinite(Number(a.present)))return Number(a.present);
 const rows=window.__workerAttendanceRows||[];
 let d=0;rows.filter(x=>String(x.worker_id)===String(w.id)).forEach(x=>{const st=String(x.status||'').toLowerCase();if(['present','p','yes','1','full day'].includes(st))d++;else if(['half','half day','0.5'].includes(st))d+=.5});
 return d;
}
function paid(w){return rows.filter(p=>String(p.worker_id)===String(w.id)).reduce((s,p)=>s+num(p.amount),0)}
function workerByCard(card,index){
 const ws=window.workers||[];
 const edit=card.querySelector('button[onclick*="editWorker("]');
 const m=edit?.getAttribute('onclick')?.match(/editWorker\(['\"]([^'\"]+)/);
 if(m){const w=ws.find(x=>String(x.id)===String(m[1]));if(w)return w}
 return ws[index]||null;
}
function paymentRows(w){return rows.filter(p=>String(p.worker_id)===String(w.id))}
function upiUrl(w,pending){
 const pa=String(w.upi_id||'').trim();if(!pa||pending<=0)return '';
 return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(w.name||w.worker_name||'Worker')}&am=${pending.toFixed(2)}&cu=INR`;
}
function panelHTML(w){
 const wage=num(w.daily_rate??w.daily_wage??w.wage??w.daily_salary);
 const days=attendanceDays(w),earned=wage*days,already=paid(w),pending=Math.max(0,earned-already),hist=paymentRows(w),upi=String(w.upi_id||'').trim(),link=upiUrl(w,pending);
 return `<div class="adminWorkerPay" data-worker-payment-panel="${esc(w.id)}">
   <div class="adminWorkerPayTitle">💰 Worker Payment</div>
   <div class="adminWorkerPayGrid">
    <div class="adminWorkerPayStat"><span>Total Earnings</span><strong>${money(earned)}</strong></div>
    <div class="adminWorkerPayStat"><span>Paid / दिया हुआ</span><strong class="green">${money(already)}</strong></div>
    <div class="adminWorkerPayStat"><span>Pending / बाकी</span><strong class="red">${money(pending)}</strong></div>
   </div>
   <div class="adminWorkerPayActions">
    <button type="button" class="btn btn-primary btn-sm" onclick="adminWorkerPayment('${esc(w.id)}')">💸 Payment Update</button>
    ${link?`<a class="btn btn-sm adminUpi" href="${esc(link)}">📲 UPI से ${money(pending)} Pay</a>`:''}
    <button type="button" class="btn btn-light btn-sm" onclick="adminSetWorkerUpi('${esc(w.id)}')">📲 ${upi?'UPI Edit':'UPI Set'}</button>
   </div>
   ${upi?`<div style="font-size:12px;margin-top:7px;color:#64748b">UPI: <strong>${esc(upi)}</strong></div>`:''}
   ${hist.length?`<div class="adminWorkerPayHistory"><details><summary>📜 Payment History (${hist.length})</summary><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Receipt</th></tr></thead><tbody>${hist.map(p=>`<tr><td>${esc(p.payment_date||p.date||'—')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||p.method||'—')}</td><td>${p.receipt_url?`<a class="btn btn-light btn-sm adminReceipt" href="${esc(p.receipt_url)}" target="_blank" rel="noopener">🧾 Receipt</a>`:'—'}</td></tr>`).join('')}</tbody></table></details></div>`:''}
 </div>`;
}
function patchCards(){
 const box=document.getElementById('workersList');
 const ws=window.workers;
 if(!box||!Array.isArray(ws))return;
 const cards=[...box.querySelectorAll('.workerCard')];
 cards.forEach((card,i)=>{
  const w=workerByCard(card,i);if(!w)return;
  const old=card.querySelector('[data-worker-payment-panel]');
  if(old)old.remove();
  const actions=card.querySelector('.actions');
  if(!actions)return;
  actions.insertAdjacentHTML('beforebegin',panelHTML(w));
 });
}
async function loadRows(){
 const sb=window.sb;if(!sb)return false;
 try{
  const r=await sb.from('worker_payments').select('*').order('payment_date',{ascending:false}).order('created_at',{ascending:false});
  if(r.error){console.warn('worker_payments:',r.error);rows=[]}else rows=r.data||[];
 }catch(e){console.warn('worker_payments load failed',e);rows=[]}
 patchCards();return true;
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{if(!file)return resolve(null);if(file.size>4*1024*1024)return reject(new Error('Receipt 4MB से छोटी रखें'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('File read failed'));r.readAsDataURL(file)})}
window.adminSetWorkerUpi=async function(workerId){
 const sb=window.sb,w=(window.workers||[]).find(x=>String(x.id)===String(workerId));if(!sb||!w)return;
 const current=w.upi_id||'';const value=prompt(`Worker: ${w.name||'Worker'}\nUPI ID डालें (जैसे 9876543210@upi):`,current);if(value===null)return;
 const r=await sb.from('workers').update({upi_id:value.trim()||null}).eq('id',workerId);
 if(r.error){toast('❌ UPI save नहीं हुआ: '+r.error.message);return}
 w.upi_id=value.trim()||null;toast('✅ Worker UPI updated');await loadRows();
};
window.adminWorkerPayment=async function(workerId){
 const sb=window.sb,w=(window.workers||[]).find(x=>String(x.id)===String(workerId));if(!sb||!w)return;
 const wage=num(w.daily_rate??w.daily_wage??w.wage??w.daily_salary),days=attendanceDays(w),earned=wage*days,already=paid(w),pending=Math.max(0,earned-already);
 const amount=prompt(`Worker: ${w.name||'Worker'}\nTotal earnings: ${money(earned)}\nAlready paid: ${money(already)}\nPending: ${money(pending)}\n\nआज कितना payment दिया?`,pending>0?String(pending):'');
 if(amount===null)return;const val=num(amount);if(val<=0)return toast('❌ सही payment amount डालें');
 if(val>pending&&pending>0&&!confirm(`यह payment ${money(val)} है और pending ${money(pending)} है। फिर भी save करें?`))return;
 const method=prompt('Payment method: UPI / Cash / Bank','UPI');if(method===null)return;
 const ref=prompt('UTR / Reference number (optional)','');
 const pick=document.createElement('input');pick.type='file';pick.accept='image/*,.pdf';
 const file=await new Promise(resolve=>{let done=false;const finish=x=>{if(done)return;done=true;resolve(x)};pick.onchange=()=>finish(pick.files?.[0]||null);pick.click();setTimeout(()=>finish(null),120000)});
 let receipt=null;try{receipt=await fileToDataUrl(file)}catch(e){return toast('❌ Receipt process नहीं हुई: '+e.message)}
 const user=await sb.auth.getUser();
 const payload={worker_id:workerId,payment_date:today(),amount:val,payment_method:method.trim(),notes:'Admin worker payment',created_by:user.data?.user?.id||null,receipt_url:receipt,reference_no:ref?.trim()||null};
 const r=await sb.from('worker_payments').insert(payload);
 if(r.error){toast('❌ Worker payment save नहीं हुई: '+r.error.message);return}
 toast('✅ Worker payment save हो गई और receipt भी save हो गई');await loadRows();
};
async function boot(){
 styles();
 for(let i=0;i<100;i++){
  if(window.sb&&document.getElementById('workersList'))break;
  await wait(200);
 }
 if(!document.getElementById('workersList'))return;
 await loadRows();
 if(!observerStarted){
  observerStarted=true;
  const box=document.getElementById('workersList');
  new MutationObserver(()=>{setTimeout(patchCards,30)}).observe(box,{childList:true,subtree:true});
 }
 // Dashboard loadAll is defined before this script, but wrap it without replacing its rendering.
 const old=window.loadAll;
 if(old&&!old.__adminWorkerPaymentWrapped){
  const wrapped=async function(...args){const r=await old.apply(this,args);await wait(50);await loadRows();return r};
  wrapped.__adminWorkerPaymentWrapped=true;window.loadAll=wrapped;
 }
 patchCards();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
