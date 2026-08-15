/* BALAJI Construction — Admin Worker Management
   Worker card keeps Attendance + Face Verification and adds:
   Total Earnings / Paid / Pending / Payment Update / UPI / direct UPI Pay / History / Receipt
*/
(()=>{
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const money=v=>'₹'+num(v).toLocaleString('en-IN');
const today=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`};
let rows=[];
let workerCache=[];
let attendanceRows=[];
let booted=false;

function styles(){
 if(document.getElementById('adminWorkerManagementStyles'))return;
 const s=document.createElement('style');s.id='adminWorkerManagementStyles';s.textContent=`
 .adminWorkerPanel{margin-top:18px;padding:16px;border:1px solid #dfe7ef;border-radius:17px;background:linear-gradient(180deg,#f8fafc,#f3f7fb)}
 .adminWorkerPanelTitle{font-size:18px;font-weight:900;margin-bottom:12px;color:#10233b}
 .adminWorkerStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
 .adminWorkerStat{background:#fff;border:1px solid #e5eaf0;border-radius:13px;padding:12px}
 .adminWorkerStat span{display:block;font-size:12px;font-weight:800;color:#64748b}.adminWorkerStat strong{display:block;margin-top:5px;font-size:20px}
 .adminWorkerStat.earned{background:#fffaf3}.adminWorkerStat.paid{background:#effcf3}.adminWorkerStat.pending{background:#fff1f1}
 .adminWorkerButtons{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
 .adminWorkerUpi{margin-top:10px;padding:10px 12px;background:#fff;border:1px dashed #cbd5e1;border-radius:11px;font-size:12px;color:#64748b}
 .adminWorkerUpi b{color:#10233b}.adminUpiPay{background:#16a34a!important;color:#fff!important;border-color:#16a34a!important}
 .adminWorkerHistory{margin-top:12px}.adminWorkerHistory details{background:#fff;border:1px solid #e5eaf0;border-radius:12px;padding:9px}.adminWorkerHistory summary{cursor:pointer;font-weight:900}
 .adminWorkerHistory table{width:100%;border-collapse:collapse;min-width:650px;margin-top:9px;font-size:12px}.adminWorkerHistory th,.adminWorkerHistory td{padding:8px;border-bottom:1px solid #edf1f4;text-align:left;vertical-align:middle}.adminWorkerHistory th{background:#f4f7fa;color:#60738a}
 .adminReceiptThumb{width:58px;height:45px;object-fit:cover;border-radius:7px;border:1px solid #dbe3ea;vertical-align:middle}
 .adminWorkerPaymentModal .modalBox{max-width:620px}.adminWorkerSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.adminWorkerSummary div{background:#f6f8fb;border-radius:10px;padding:10px}.adminWorkerSummary span{display:block;font-size:11px;color:#64748b;font-weight:800}.adminWorkerSummary strong{font-size:16px}
 @media(max-width:700px){.adminWorkerStats{grid-template-columns:1fr 1fr}.adminWorkerStat:last-child{grid-column:1/-1}.adminWorkerSummary{grid-template-columns:1fr}}
 `;document.head.appendChild(s);
}
async function refreshWorkerCache(){
 const sb=window.sb;if(!sb)return;
 try{const r=await sb.from('workers').select('*').order('created_at',{ascending:false});if(!r.error)workerCache=r.data||[]}catch(e){console.warn('workers cache:',e)}
 try{const r=await sb.from('worker_attendance').select('*');attendanceRows=r.error?[]:(r.data||[])}catch(e){attendanceRows=[]}
 window.__workerAdminCache=workerCache;
 window.__workerAttendanceRows=attendanceRows;
}
function getWorkers(){return workerCache}
function getWorker(id){return getWorkers().find(w=>String(w.id)===String(id))||null}
function attendanceFor(w){
 const rows=attendanceRows.filter(x=>String(x.worker_id||x.workerId)===String(w.id));
 let present=0,total=0;rows.forEach(x=>{total++;const st=String(x.status||x.attendance||'').toLowerCase();if(['present','p','yes','1','full day'].includes(st))present++;else if(['half','half day','0.5'].includes(st))present+=.5});
 if(!rows.length&&window.workerAttendanceMap?.[w.id]){const a=window.workerAttendanceMap[w.id];return {present:Number(a.present||0),total:Number(a.total||0)}}
 return {present,total};
}
function paidFor(w){return rows.filter(p=>String(p.worker_id)===String(w.id)).reduce((s,p)=>s+num(p.amount),0)}
function earnedFor(w){const wage=num(w.daily_rate??w.daily_wage??w.wage??w.daily_salary);return wage*attendanceFor(w).present}
function paymentRows(w){return rows.filter(p=>String(p.worker_id)===String(w.id))}
function upiUrl(w,pending){const pa=String(w.upi_id||'').trim();if(!pa||pending<=0)return '';return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(w.name||w.worker_name||'Worker')}&am=${num(pending).toFixed(2)}&cu=INR`}
function receiptHTML(url){if(!url)return '—';const safe=esc(url);if(String(url).startsWith('data:image/'))return `<a href="${safe}" target="_blank" rel="noopener"><img class="adminReceiptThumb" src="${safe}" alt="Receipt"></a>`;return `<a class="btn btn-light btn-sm" href="${safe}" target="_blank" rel="noopener">🧾 Receipt</a>`}
function workerFromCard(card,index){const edit=card.querySelector('button[onclick*="editWorker("]');const m=edit?.getAttribute('onclick')?.match(/editWorker\(['\"]([^'\"]+)/);if(m){const w=getWorker(m[1]);if(w)return w}return getWorkers()[index]||null}
function panelHTML(w){
 const a=attendanceFor(w),wage=num(w.daily_rate??w.daily_wage??w.wage??w.daily_salary),earned=wage*a.present,paid=paidFor(w),pending=Math.max(0,earned-paid),hist=paymentRows(w),upi=String(w.upi_id||'').trim(),payLink=upiUrl(w,pending);
 return `<div class="adminWorkerPanel" data-worker-payment-panel="${esc(w.id)}"><div class="adminWorkerPanelTitle">💰 Worker Payment</div><div class="adminWorkerStats"><div class="adminWorkerStat earned"><span>💰 Total Earnings</span><strong>${money(earned)}</strong><small style="color:#64748b">${a.present} paid-work day${a.present===1?'':'s'} × ${money(wage)}</small></div><div class="adminWorkerStat paid"><span>🟢 Paid / दिया हुआ</span><strong class="green">${money(paid)}</strong></div><div class="adminWorkerStat pending"><span>🔴 Pending / बाकी</span><strong class="red">${money(pending)}</strong></div></div><div class="adminWorkerButtons"><button type="button" class="btn btn-primary btn-sm" onclick="adminWorkerPayment('${esc(w.id)}')">💸 Payment Update</button><button type="button" class="btn btn-light btn-sm" onclick="adminSetWorkerUpi('${esc(w.id)}')">📲 ${upi?'UPI Edit':'UPI Set'}</button>${payLink?`<a class="btn btn-sm adminUpiPay" href="${esc(payLink)}">📲 Pending ${money(pending)} Pay</a>`:''}</div>${upi?`<div class="adminWorkerUpi">📲 UPI ID: <b>${esc(upi)}</b>${pending>0?' • <b style="color:#dc2626">'+money(pending)+' बाकी</b>':''}</div>`:`<div class="adminWorkerUpi">📲 UPI ID अभी set नहीं है। <button type="button" class="btn btn-blue btn-sm" style="margin-left:6px" onclick="adminSetWorkerUpi('${esc(w.id)}')">UPI Set करें</button></div>`}<div class="adminWorkerHistory"><details><summary>📜 Payment History (${hist.length})</summary>${hist.length?`<div class="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Receipt</th><th>Action</th></tr></thead><tbody>${hist.map(p=>`<tr><td>${esc(p.payment_date||p.date||'—')}</td><td><strong>${money(p.amount)}</strong></td><td>${esc(p.payment_method||p.method||'—')}</td><td>${esc(p.reference_no||p.utr||p.reference||'—')}</td><td>${receiptHTML(p.receipt_url)}</td><td><div class="actions"><button type="button" class="btn btn-blue btn-sm" onclick="adminEditWorkerPayment('${esc(p.id)}')">✏️ Edit</button><button type="button" class="btn btn-red btn-sm" onclick="adminDeleteWorkerPayment('${esc(p.id)}')">🗑️ Delete</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="margin-top:10px">अभी कोई payment record नहीं है।</div>'}</details></div></div>`;
}
function patchCards(){const box=document.getElementById('workersList');if(!box)return;[...box.querySelectorAll('.workerCard')].forEach((card,i)=>{const w=workerFromCard(card,i);if(!w)return;card.querySelector('[data-worker-payment-panel]')?.remove();const actions=card.querySelector('.actions');if(actions)actions.insertAdjacentHTML('beforebegin',panelHTML(w))})}
async function loadRows(){const sb=window.sb;if(!sb)return;try{const r=await sb.from('worker_payments').select('*').order('payment_date',{ascending:false}).order('created_at',{ascending:false});rows=r.error?[]:(r.data||[])}catch(e){rows=[]}patchCards()}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{if(!file)return resolve(null);if(file.size>4*1024*1024)return reject(new Error('Receipt 4MB से छोटी रखें'));const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Receipt read failed'));r.readAsDataURL(file)})}
function showPaymentModal(worker,payment=null){
 document.getElementById('adminWorkerPaymentModal')?.remove();
 const basePaid=paidFor(worker),oldAmount=payment?num(payment.amount):0,earned=earnedFor(worker),pending=Math.max(0,earned-(basePaid-oldAmount));
 const m=document.createElement('div');m.className='modal adminWorkerPaymentModal';m.id='adminWorkerPaymentModal';m.innerHTML=`<div class="modalBox"><div class="modalHead"><h3>${payment?'✏️ Edit Worker Payment':'💸 Worker Payment Update'}</h3><button class="close" type="button">×</button></div><div><strong>${esc(worker.name||worker.worker_name||'Worker')}</strong></div><div class="adminWorkerSummary"><div><span>Total Earnings</span><strong>${money(earned)}</strong></div><div><span>Paid</span><strong class="green">${money(basePaid-oldAmount)}</strong></div><div><span>Pending</span><strong class="red">${money(pending)}</strong></div></div><form id="adminWorkerPaymentForm"><input type="hidden" id="adminPaymentId" value="${esc(payment?.id||'')}"><div class="formGrid"><div class="field"><label>Payment Amount (₹)</label><input id="adminPaymentAmount" type="number" min="1" step="0.01" required value="${payment?esc(payment.amount):pending>0?esc(pending):''}"></div><div class="field"><label>Payment Date</label><input id="adminPaymentDate" type="date" required value="${esc(payment?.payment_date||today())}"></div><div class="field"><label>Payment Method</label><select id="adminPaymentMethod"><option>UPI</option><option>Cash</option><option>Bank</option></select></div><div class="field"><label>UTR / Reference</label><input id="adminPaymentReference" value="${esc(payment?.reference_no||payment?.utr||'')}"></div><div class="field full"><label>Receipt / Screenshot</label><input id="adminPaymentReceipt" type="file" accept="image/*,.pdf"><span class="uploadHint">Payment receipt की photo/PDF Worker की history में save होगी। ${payment?'नई receipt चुनने पर पुरानी replace होगी।':''}</span>${payment?.receipt_url?`<div style="margin-top:8px">Current: ${receiptHTML(payment.receipt_url)}</div>`:''}</div><div class="field full"><label>Notes</label><textarea id="adminPaymentNotes">${esc(payment?.notes||'')}</textarea></div></div><div class="modalActions"><button type="button" class="btn btn-light" id="adminPaymentCancel">Cancel</button><button class="btn btn-green" type="submit">💾 ${payment?'Update Payment':'Save Payment'}</button></div></form></div>`;
 document.body.appendChild(m);m.classList.add('show');m.querySelector('.close').onclick=()=>m.remove();m.querySelector('#adminPaymentCancel').onclick=()=>m.remove();m.addEventListener('click',e=>{if(e.target===m)m.remove()});m.querySelector('#adminPaymentMethod').value=payment?.payment_method||payment?.method||'UPI';
 m.querySelector('form').onsubmit=async e=>{e.preventDefault();const sb=window.sb,amount=num(document.getElementById('adminPaymentAmount').value);if(amount<=0)return toast('❌ सही payment amount डालें');const file=document.getElementById('adminPaymentReceipt').files[0];let receipt=payment?.receipt_url||null;try{const fresh=await fileToDataUrl(file);if(fresh)receipt=fresh}catch(err){return toast('❌ Receipt process नहीं हुई: '+err.message)}const payload={worker_id:worker.id,amount,payment_date:document.getElementById('adminPaymentDate').value||today(),payment_method:document.getElementById('adminPaymentMethod').value,reference_no:document.getElementById('adminPaymentReference').value.trim()||null,notes:document.getElementById('adminPaymentNotes').value.trim(),receipt_url:receipt};const id=document.getElementById('adminPaymentId').value;const r=id?await sb.from('worker_payments').update(payload).eq('id',id):await sb.from('worker_payments').insert(payload);if(r.error){toast('❌ Worker payment save नहीं हुई: '+r.error.message);return}m.remove();toast(id?'✅ Worker payment updated':'✅ Worker payment save हो गई');await refreshWorkerCache();await loadRows()};
}
window.adminWorkerPayment=workerId=>{const w=getWorker(workerId);if(w)showPaymentModal(w)};
window.adminEditWorkerPayment=paymentId=>{const p=rows.find(x=>String(x.id)===String(paymentId)),w=p?getWorker(p.worker_id):null;if(p&&w)showPaymentModal(w,p)};
window.adminDeleteWorkerPayment=async paymentId=>{if(!confirm('क्या यह Worker payment permanently delete करना है?'))return;const r=await window.sb.from('worker_payments').delete().eq('id',paymentId);if(r.error)return toast('❌ Payment delete नहीं हुई: '+r.error.message);toast('🗑️ Worker payment deleted');await loadRows()};
window.adminSetWorkerUpi=async workerId=>{const sb=window.sb,w=getWorker(workerId);if(!sb||!w)return;const value=prompt(`Worker: ${w.name||'Worker'}\nUPI ID डालें (जैसे 9876543210@upi):`,w.upi_id||'');if(value===null)return;const clean=value.trim();const r=await sb.from('workers').update({upi_id:clean||null}).eq('id',workerId);if(r.error)return toast('❌ UPI save नहीं हुआ: '+r.error.message);w.upi_id=clean||null;toast('✅ Worker UPI updated');await loadRows()};
async function boot(){if(booted)return;booted=true;styles();for(let i=0;i<100;i++){if(window.sb&&document.getElementById('workersList'))break;await wait(200)}if(!document.getElementById('workersList')){booted=false;return}await refreshWorkerCache();await loadRows();const box=document.getElementById('workersList');new MutationObserver(()=>setTimeout(patchCards,50)).observe(box,{childList:true,subtree:true});const old=window.loadAll;if(old&&!old.__adminWorkerManagementWrapped){const wrapped=async function(...args){const r=await old.apply(this,args);await wait(100);await refreshWorkerCache();await loadRows();return r};wrapped.__adminWorkerManagementWrapped=true;window.loadAll=wrapped}patchCards()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();