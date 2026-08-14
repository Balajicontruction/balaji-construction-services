(()=>{
'use strict';
const SB=window.sb;
let faceStream=null,faceModelsLoaded=false,registeredDescriptor=null,faceRegistered=false,faceBusy=false;
const MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const escText=s=>String(s??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
function normPhone(v){return String(v||'').replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'').replace(/^0(?=\d{10}$)/,'');}
function stopCamera(){if(faceStream){faceStream.getTracks().forEach(t=>t.stop());faceStream=null;}const v=document.getElementById('workerFaceVideo');if(v)v.srcObject=null;}
async function loadFaceModels(){
 if(faceModelsLoaded)return;
 setFaceStatus('Face model load हो रहा है...','info');
 await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
 await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
 await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
 faceModelsLoaded=true;
}
function setFaceStatus(text,type='info'){
 const el=document.getElementById('workerFaceStatus');if(!el)return;
 el.textContent=text;
 el.style.background=type==='ok'?'#ecfdf5':type==='err'?'#fff1f2':'#eff6ff';
 el.style.color=type==='ok'?'#166534':type==='err'?'#9f1239':'#1d4ed8';
}
function ensureFaceUI(){
 const form=document.getElementById('workerForm');if(!form)return;
 let box=document.getElementById('workerFaceBox');
 if(box)return;
 box=document.createElement('div');box.id='workerFaceBox';box.className='field full';
 box.innerHTML=`<label>📷 Worker Face Registration</label>
 <div style="padding:14px;border:1px solid #e3e9f0;border-radius:14px;background:#f8fafc">
   <div id="workerFaceStatus" style="padding:10px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-weight:800;margin-bottom:10px">पहले Worker details भरें, फिर Face Register करें।</div>
   <div id="workerFaceCamera" style="display:none;position:relative;max-width:430px;aspect-ratio:4/3;background:#081827;border-radius:16px;overflow:hidden;margin:10px auto">
     <video id="workerFaceVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
   </div>
   <div style="display:flex;gap:8px;flex-wrap:wrap">
     <button type="button" id="workerFaceStart" class="btn btn-blue">📷 Face Camera Start</button>
     <button type="button" id="workerFaceCapture" class="btn btn-green" disabled>✅ Face Register</button>
     <button type="button" id="workerFaceStop" class="btn btn-light" style="display:none">Stop Camera</button>
   </div>
   <div class="uploadHint" style="margin-top:8px">पहली बार Worker add करते समय एक ही साफ चेहरा register होगा। बाद में इसी registered face से attendance verification होगी।</div>
 </div>`;
 const grid=form.querySelector('.formGrid');grid.appendChild(box);
 document.getElementById('workerFaceStart').onclick=startFaceCamera;
 document.getElementById('workerFaceCapture').onclick=captureAndPrepare;
 document.getElementById('workerFaceStop').onclick=()=>{stopCamera();document.getElementById('workerFaceCamera').style.display='none';document.getElementById('workerFaceStop').style.display='none';document.getElementById('workerFaceCapture').disabled=true;setFaceStatus('Camera बंद है।','info');};
}
async function startFaceCamera(){
 if(faceBusy)return;
 try{
  faceBusy=true;
  await loadFaceModels();
  faceStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
  const v=document.getElementById('workerFaceVideo');v.srcObject=faceStream;
  document.getElementById('workerFaceCamera').style.display='block';
  document.getElementById('workerFaceStop').style.display='inline-block';
  document.getElementById('workerFaceCapture').disabled=false;
  setFaceStatus('Camera तैयार है। चेहरा सामने और साफ रखें।','ok');
 }catch(e){setFaceStatus('Camera शुरू नहीं हुआ: '+e.message,'err');}finally{faceBusy=false;}
}
async function captureAndPrepare(){
 if(faceBusy)return;
 try{
  faceBusy=true;setFaceStatus('Face scan हो रहा है...','info');
  const v=document.getElementById('workerFaceVideo');
  const detections=await faceapi.detectAllFaces(v,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.55})).withFaceLandmarks().withFaceDescriptors();
  if(detections.length!==1){setFaceStatus(detections.length>1?'एक समय में केवल एक चेहरा रखें।':'चेहरा साफ और camera के सामने रखें।','err');return;}
  registeredDescriptor=Array.from(detections[0].descriptor);
  faceRegistered=true;
  setFaceStatus('✅ Face capture सफल। अब Save Worker दबाएँ।','ok');
  document.getElementById('workerFaceCapture').disabled=true;
 }catch(e){setFaceStatus('Face registration failed: '+e.message,'err');}finally{faceBusy=false;}
}
function currentWorkerId(){return document.getElementById('workerId')?.value||'';}
function currentWorker(){const id=currentWorkerId();return id?(window.workers||[]).find(w=>String(w.id)===String(id)):null;}
function setupFaceState(){
 ensureFaceUI();stopCamera();registeredDescriptor=null;faceRegistered=false;
 const w=currentWorker();
 if(w?.face_registered && Array.isArray(w.face_descriptor)){
  faceRegistered=true;registeredDescriptor=w.face_descriptor;
  setFaceStatus('🔐 Face पहले से registered है। दोबारा register करने की जरूरत नहीं।','ok');
 }else setFaceStatus('⚠️ इस Worker का Face अभी registered नहीं है। Add/Save करने से पहले Face Register करें।','info');
}
async function saveWorkerWithFace(){
 const id=currentWorkerId();
 const name=document.getElementById('workerName').value.trim();
 const role=document.getElementById('workerRole').value.trim();
 const phone=document.getElementById('workerMobile').value.trim();
 const wage=Number(document.getElementById('workerWage').value||0);
 const village=document.getElementById('workerVillage').value.trim();
 const attendanceStatus=document.getElementById('workerAttendanceStatus').value;
 if(!name){toast('❌ Worker name जरूरी है');return;}
 if(!normPhone(phone)||normPhone(phone).length!==10){toast('❌ सही 10 अंकों का mobile number डालें');return;}
 if(!faceRegistered||!Array.isArray(registeredDescriptor)||registeredDescriptor.length!==128){toast('❌ पहले Face Register करें');return;}
 const payload={name,work_role:role,phone,daily_rate:wage,village,face_descriptor:registeredDescriptor,face_registered:true,face_registered_at:new Date().toISOString()};
 let result;
 if(id) result=await SB.from('workers').update(payload).eq('id',id);
 else result=await SB.from('workers').insert(payload);
 if(result.error){toast('❌ Worker save नहीं हुआ: '+result.error.message);return;}
 if(attendanceStatus&&id&&typeof window.saveWorkerAttendance==='function')await window.saveWorkerAttendance(id,attendanceStatus);
 closeModal('workerModal');stopCamera();toast(id?'✅ Worker updated + Face registered':'✅ Worker added + Face registered');await loadAll();
}
function install(){
 if(!window.sb||!window.openWorkerModal)return;
 ensureFaceUI();
 const originalOpen=window.openWorkerModal;
 window.openWorkerModal=function(id=''){originalOpen(id);setTimeout(setupFaceState,0);};
 const form=document.getElementById('workerForm');
 form.addEventListener('submit',async e=>{
   const id=currentWorkerId();const w=currentWorker();
   const needsFace=!id || !w?.face_registered;
   if(!needsFace)return;
   e.preventDefault();e.stopImmediatePropagation();
   await saveWorkerWithFace();
 },true);
 window.addEventListener('beforeunload',stopCamera);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

/* =========================================================
   WORKER PAYMENTS / UPI / RECEIPTS
========================================================= */
(()=>{
'use strict';
const SB=window.sb;
let workerPaymentRows=[];
let workerPayReady=false;
const payMoney=v=>typeof money==='function'?money(v):('₹'+Number(v||0).toLocaleString('en-IN'));
const payEsc=v=>String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const payNum=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0;};
function todayLocal(){const d=new Date();const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;}
async function loadWorkerPaymentRows(){
 if(!SB)return;
 const r=await SB.from('worker_payments').select('*').order('payment_date',{ascending:false}).order('created_at',{ascending:false});
 if(r.error){console.warn('worker payments:',r.error);workerPaymentRows=[];return;}
 workerPaymentRows=r.data||[];
}
function workerPaymentTotal(workerId){return workerPaymentRows.filter(p=>String(p.worker_id)===String(workerId)).reduce((s,p)=>s+payNum(p.amount),0);}
function workerEarned(workerId,dailyRate){
 const rows=(window.__workerAttendanceRows||[]).filter(a=>String(a.worker_id||a.workerId)===String(workerId));
 let days=0;
 rows.forEach(a=>{const st=String(a.status||a.attendance||'').toLowerCase();if(['present','p','yes','1','full day'].includes(st))days+=1;else if(['half day','half','0.5'].includes(st))days+=.5;});
 return {days,total:days*payNum(dailyRate)};
}
async function loadAttendanceForPay(){
 const r=await SB.from('worker_attendance').select('worker_id,attendance_date,status');
 window.__workerAttendanceRows=r.error?[]:(r.data||[]);
}
function upiLink(w,pending){
 const pa=String(w.upi_id||'').trim();if(!pa)return '';
 const pn=encodeURIComponent(w.name||w.worker_name||'Worker');
 return `upi://pay?pa=${encodeURIComponent(pa)}&pn=${pn}&am=${payNum(pending).toFixed(2)}&cu=INR`;
}
function receiptPreview(url){
 if(!url)return '';
 if(String(url).startsWith('data:image/'))return `<img src="${payEsc(url)}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #ddd" alt="Receipt">`;
 return `<a class="btn btn-light btn-sm" href="${payEsc(url)}" target="_blank" rel="noopener">📄 Receipt</a>`;
}
function ensureUpiField(){
 const form=document.getElementById('workerForm');if(!form||document.getElementById('workerUpiId'))return;
 const grid=form.querySelector('.formGrid');const d=document.createElement('div');d.className='field full';d.innerHTML=`<label>📲 Worker UPI ID</label><input id="workerUpiId" placeholder="जैसे 9876543210@upi"><span class="uploadHint">Payment बाकी होने पर इसी UPI ID से सीधे भुगतान खुलेगा।</span>`;grid.appendChild(d);
 const oldOpen=window.openWorkerModal;
 if(oldOpen&&!oldOpen.__upiWrapped){const wrapped=function(id=''){oldOpen(id);setTimeout(()=>{const w=(window.__lastWorkers||[]).find(x=>String(x.id)===String(id));document.getElementById('workerUpiId').value=w?.upi_id||'';},0);};wrapped.__upiWrapped=true;window.openWorkerModal=wrapped;}
}
async function saveUpiFromWorkerForm(){
 const id=document.getElementById('workerId')?.value;if(!id)return;
 const el=document.getElementById('workerUpiId');if(!el)return;
 const r=await SB.from('workers').update({upi_id:el.value.trim()||null}).eq('id',id);
 if(r.error)console.warn('UPI save:',r.error);
}
function makePaymentModal(){
 if(document.getElementById('workerPaymentModal'))return;
 const m=document.createElement('div');m.className='modal';m.id='workerPaymentModal';m.innerHTML=`<div class="modalBox"><div class="modalHead"><h3 id="workerPaymentTitle">Worker Payment</h3><button class="close" type="button" onclick="closeModal('workerPaymentModal')">×</button></div><form id="workerPaymentForm"><input type="hidden" id="workerPaymentId"><input type="hidden" id="workerPaymentWorkerId"><div class="formGrid"><div class="field full"><label>Worker</label><input id="workerPaymentWorkerName" readonly></div><div class="field"><label>Payment Amount (₹)</label><input id="workerPaymentAmount" type="number" min="1" step="0.01" required></div><div class="field"><label>Payment Date</label><input id="workerPaymentDate" type="date" required></div><div class="field full"><label>Receipt / Screenshot</label><input id="workerPaymentReceipt" type="file" accept="image/*,.pdf"><span class="uploadHint">Payment receipt की photo/PDF यहीं save होगी।</span><div id="workerPaymentReceiptPreview"></div></div><div class="field full"><label>Notes</label><textarea id="workerPaymentNotes" placeholder="जैसे cash / UPI / advance"></textarea></div></div><div id="workerPaymentSummary" style="margin-top:15px"></div><div class="modalActions"><button type="button" class="btn btn-light" onclick="closeModal('workerPaymentModal')">Cancel</button><button class="btn btn-green" type="submit">💾 Payment Save</button></div></form></div>`;document.body.appendChild(m);
 m.querySelector('form').addEventListener('submit',saveWorkerPayment);
 m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');});
}
async function fileDataUrl(file){if(!file)return null;return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('File read failed'));r.readAsDataURL(file);});}
async function saveWorkerPayment(e){
 e.preventDefault();
 const id=document.getElementById('workerPaymentId').value;const workerId=document.getElementById('workerPaymentWorkerId').value;const amount=payNum(document.getElementById('workerPaymentAmount').value);
 if(!workerId||amount<=0)return toast('❌ सही payment amount डालें');
 const file=document.getElementById('workerPaymentReceipt').files[0];let receipt=null;
 try{receipt=await fileDataUrl(file);}catch(err){return toast('❌ Receipt read नहीं हुई');}
 const payload={worker_id:workerId,amount,payment_date:document.getElementById('workerPaymentDate').value||todayLocal(),notes:document.getElementById('workerPaymentNotes').value.trim()};
 if(receipt)payload.receipt_url=receipt;
 let r=id?await SB.from('worker_payments').update(payload).eq('id',id):await SB.from('worker_payments').insert(payload);
 if(r.error)return toast('❌ Worker payment save नहीं हुआ: '+r.error.message);
 closeModal('workerPaymentModal');toast(id?'✅ Worker payment updated':'✅ Worker payment saved');await refreshWorkerPayments();
}
async function refreshWorkerPayments(){await loadWorkerPaymentRows();await loadAttendanceForPay();workerPayReady=true;try{renderWorkers();}catch(e){console.warn(e);}}
async function openWorkerPayment(workerId,paymentId=''){
 makePaymentModal();await loadWorkerPaymentRows();await loadAttendanceForPay();
 const workersNow=window.__lastWorkers||[];const w=workersNow.find(x=>String(x.id)===String(workerId));if(!w)return;
 document.getElementById('workerPaymentId').value='';document.getElementById('workerPaymentWorkerId').value=w.id;document.getElementById('workerPaymentWorkerName').value=w.name||w.worker_name||'Worker';document.getElementById('workerPaymentDate').value=todayLocal();document.getElementById('workerPaymentAmount').value='';document.getElementById('workerPaymentNotes').value='';document.getElementById('workerPaymentReceipt').value='';document.getElementById('workerPaymentReceiptPreview').innerHTML='';
 if(paymentId){const p=workerPaymentRows.find(x=>String(x.id)===String(paymentId));if(p){document.getElementById('workerPaymentId').value=p.id;document.getElementById('workerPaymentAmount').value=p.amount;document.getElementById('workerPaymentDate').value=p.payment_date||todayLocal();document.getElementById('workerPaymentNotes').value=p.notes||'';document.getElementById('workerPaymentReceiptPreview').innerHTML=receiptPreview(p.receipt_url);}}
 const earned=workerEarned(w.id,w.daily_rate);const paid=workerPaymentTotal(w.id);const pending=Math.max(0,earned.total-paid+(paymentId?payNum(workerPaymentRows.find(x=>String(x.id)===String(paymentId))?.amount):0));document.getElementById('workerPaymentSummary').innerHTML=`<div style="padding:14px;border-radius:14px;background:#f8fafc"><b>कुल मजदूरी:</b> ${payMoney(earned.total)} &nbsp; • &nbsp; <b>पहले दिया:</b> ${payMoney(paid)} &nbsp; • &nbsp; <b style="color:#dc2626">बाकी:</b> ${payMoney(pending)}</div>`;
 openModal('workerPaymentModal');
}
window.openWorkerPayment=openWorkerPayment;
window.editWorkerPayment=(wid,pid)=>openWorkerPayment(wid,pid);
window.deleteWorkerPayment=async pid=>{if(!confirm('क्या यह worker payment delete करना है?'))return;const r=await SB.from('worker_payments').delete().eq('id',pid);if(r.error)return toast('❌ Payment delete नहीं हुआ: '+r.error.message);toast('🗑️ Worker payment deleted');await refreshWorkerPayments();};
window.openWorkerPaymentHistory=async workerId=>{await loadWorkerPaymentRows();const rows=workerPaymentRows.filter(p=>String(p.worker_id)===String(workerId));const w=(window.__lastWorkers||[]).find(x=>String(x.id)===String(workerId));if(!w)return;const earned=workerEarned(w.id,w.daily_rate),paid=workerPaymentTotal(w.id),pending=Math.max(0,earned.total-paid);makePaymentModal();const box=document.getElementById('workerPaymentSummary');box.innerHTML=`<div style="padding:14px;background:#f8fafc;border-radius:14px"><b>${payEsc(w.name||'Worker')}</b><br>कुल मजदूरी: ${payMoney(earned.total)} • दिया: ${payMoney(paid)} • बाकी: <span class="red"><b>${payMoney(pending)}</b></span><hr>${rows.length?rows.map(p=>`<div style="padding:10px 0;border-bottom:1px solid #e5e7eb"><b>${payMoney(p.amount)}</b> • ${payEsc(p.payment_date||'')} ${receiptPreview(p.receipt_url)} <div style="margin-top:6px">${payEsc(p.notes||'')}</div><div class="actions" style="margin-top:7px"><button class="btn btn-blue btn-sm" onclick="editWorkerPayment('${payEsc(w.id)}','${payEsc(p.id)}')">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteWorkerPayment('${payEsc(p.id)}')">🗑️ Delete</button></div></div>`).join(''):'कोई payment नहीं'} </div>`;document.getElementById('workerPaymentTitle').textContent='💰 Worker Payment History';document.getElementById('workerPaymentForm').style.display='none';openModal('workerPaymentModal');setTimeout(()=>{const m=document.getElementById('workerPaymentModal');m.querySelector('.modalActions')?.remove();},0);};
function enhanceWorkerCards(){
 const cards=[...document.querySelectorAll('#workersList .workerCard')];const workersNow=window.__lastWorkers||[];cards.forEach((card,i)=>{const w=workersNow[i];if(!w)return;card.dataset.workerId=w.id;card.querySelector('.workerPaymentBox')?.remove();const earned=workerEarned(w.id,w.daily_rate),paid=workerPaymentTotal(w.id),pending=Math.max(0,earned.total-paid);const upi=upiLink(w,pending);const box=document.createElement('div');box.className='workerPaymentBox';box.style.cssText='margin-top:15px;padding:14px;border-radius:14px;background:#f8fafc;border:1px solid #e5e7eb';box.innerHTML=`<div style="font-weight:900;margin-bottom:8px">💰 Payment</div><div class="workerRow"><span>कुल मजदूरी</span><strong>${payMoney(earned.total)}</strong></div><div class="workerRow"><span>दिया हुआ</span><strong class="green">${payMoney(paid)}</strong></div><div class="workerRow"><span>बाकी</span><strong class="red">${payMoney(pending)}</strong></div><div class="actions" style="margin-top:10px"><button class="btn btn-green btn-sm" onclick="openWorkerPayment('${payEsc(w.id)}')">💸 Payment Update</button><button class="btn btn-blue btn-sm" onclick="openWorkerPaymentHistory('${payEsc(w.id)}')">📜 History</button>${pending>0&&upi?`<a class="btn btn-primary btn-sm" href="${payEsc(upi)}">📲 UPI Pay ${payMoney(pending)}</a>`:''}</div>${w.upi_id?`<div class="uploadHint" style="margin-top:8px">UPI: ${payEsc(w.upi_id)}</div>`:''}`;const info=card.querySelector('.workerInfo');info.appendChild(box);});}
function patchRender(){
 if(typeof window.renderWorkers!=='function'||window.renderWorkers.__paymentPatched)return;
 const original=window.renderWorkers;const patched=function(){original();setTimeout(enhanceWorkerCards,0);};patched.__paymentPatched=true;window.renderWorkers=patched;
}
function installPayments(){
 if(!SB)return;
 makePaymentModal();ensureUpiField();
 window.__lastWorkers=(typeof workers!=='undefined'&&Array.isArray(workers))?workers:[];
 patchRender();
 const form=document.getElementById('workerForm');if(form&&!form.__upiSave){form.__upiSave=true;form.addEventListener('submit',()=>setTimeout(saveUpiFromWorkerForm,700),false);}
 refreshWorkerPayments();
 setTimeout(()=>{window.__lastWorkers=(typeof workers!=='undefined'&&Array.isArray(workers))?workers:[];patchRender();enhanceWorkerCards();},1200);
}
window.addEventListener('beforeunload',()=>{});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installPayments,300));else setTimeout(installPayments,300);
})();