/* BALAJI Construction — Worker Face Registration + Verification
   New worker: full details + successful face registration are required before save.
   Existing worker: registered face is kept; re-registering is allowed from Edit.
   Worker payments remain isolated in worker-payments.js.
*/
(()=>{
'use strict';
const SB=window.sb;
let registerStream=null,verifyStream=null,modelsLoaded=false,faceBusy=false;
let registeredDescriptor=null,faceRegistered=false,workerCache=[];
const MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const normPhone=v=>String(v||'').replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'').replace(/^0(?=\d{10}$)/,'');
const getWorkers=()=>workerCache.length?workerCache:(Array.isArray(window.__workerAdminCache)?window.__workerAdminCache:[]);
const getWorker=id=>getWorkers().find(w=>String(w.id)===String(id))||null;
async function refreshWorkerCache(){if(!SB)return;try{const r=await SB.from('workers').select('*').order('created_at',{ascending:false});if(!r.error){workerCache=r.data||[];window.__workerAdminCache=workerCache}}catch(e){console.warn('face worker cache:',e)}}
function stopRegisterCamera(){if(registerStream){registerStream.getTracks().forEach(t=>t.stop());registerStream=null}const v=document.getElementById('workerFaceVideo');if(v)v.srcObject=null}
function stopVerifyCamera(){if(verifyStream){verifyStream.getTracks().forEach(t=>t.stop());verifyStream=null}const v=document.getElementById('workerVerifyVideo');if(v)v.srcObject=null}
async function loadModels(){if(modelsLoaded)return;if(!window.faceapi)throw new Error('Face library load नहीं हुई');await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);modelsLoaded=true}
function setFaceStatus(t,type='info'){const e=document.getElementById('workerFaceStatus');if(!e)return;e.textContent=t;e.style.background=type==='ok'?'#ecfdf5':type==='err'?'#fff1f2':'#eff6ff';e.style.color=type==='ok'?'#166534':type==='err'?'#9f1239':'#1d4ed8'}
function ensureFaceUI(){
 const form=document.getElementById('workerForm');if(!form||document.getElementById('workerFaceBox'))return;const grid=form.querySelector('.formGrid');if(!grid)return;
 const box=document.createElement('div');box.id='workerFaceBox';box.className='field full';box.innerHTML=`<label>📷 Worker Face Registration <span style="color:#dc2626">* New Worker के लिए जरूरी</span></label><div style="padding:14px;border:1px solid #e3e9f0;border-radius:14px;background:#f8fafc"><div id="workerFaceStatus" style="padding:10px;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-weight:800;margin-bottom:10px">Worker की पूरी details भरें, फिर Face Register करें।</div><div id="workerFaceCamera" style="display:none;max-width:430px;aspect-ratio:4/3;background:#081827;border-radius:16px;overflow:hidden;margin:10px auto"><video id="workerFaceVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="workerFaceStart" class="btn btn-blue">📷 Face Camera Start</button><button type="button" id="workerFaceCapture" class="btn btn-green" disabled>✅ Face Register</button><button type="button" id="workerFaceStop" class="btn btn-light" style="display:none">Stop Camera</button></div><div class="uploadHint" style="margin-top:8px">एक समय में केवल एक साफ चेहरा रखें। Face capture सफल होने के बाद ही Save Worker काम करेगा।</div></div>`;grid.appendChild(box);
 document.getElementById('workerFaceStart').onclick=startRegister;document.getElementById('workerFaceCapture').onclick=captureRegister;document.getElementById('workerFaceStop').onclick=()=>{stopRegisterCamera();document.getElementById('workerFaceCamera').style.display='none';document.getElementById('workerFaceStop').style.display='none';document.getElementById('workerFaceCapture').disabled=true;setFaceStatus('Camera बंद है।','info')};
}
async function startRegister(){if(faceBusy)return;try{faceBusy=true;await loadModels();registerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});const v=document.getElementById('workerFaceVideo');v.srcObject=registerStream;document.getElementById('workerFaceCamera').style.display='block';document.getElementById('workerFaceStop').style.display='inline-block';document.getElementById('workerFaceCapture').disabled=false;setFaceStatus('Camera तैयार है। चेहरा सामने और साफ रखें।','ok')}catch(e){setFaceStatus('❌ Camera शुरू नहीं हुआ: '+e.message,'err')}finally{faceBusy=false}}
async function captureRegister(){if(faceBusy)return;try{faceBusy=true;setFaceStatus('🔎 Face scan हो रहा है...');const v=document.getElementById('workerFaceVideo');const ds=await faceapi.detectAllFaces(v,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.55})).withFaceLandmarks().withFaceDescriptors();if(ds.length!==1){setFaceStatus(ds.length>1?'❌ एक समय में केवल एक चेहरा रखें।':'❌ चेहरा साफ और camera के सामने रखें।','err');return}registeredDescriptor=Array.from(ds[0].descriptor);faceRegistered=true;setFaceStatus('✅ Face registration सफल। अब Save Worker दबाएँ।','ok');document.getElementById('workerFaceCapture').disabled=true;stopRegisterCamera();document.getElementById('workerFaceCamera').style.display='none';document.getElementById('workerFaceStop').style.display='none'}catch(e){setFaceStatus('❌ Face registration failed: '+e.message,'err')}finally{faceBusy=false}}
function currentId(){return document.getElementById('workerId')?.value||''}
function setupFaceState(){ensureFaceUI();stopRegisterCamera();registeredDescriptor=null;faceRegistered=false;const w=getWorker(currentId());if(w?.face_registered&&Array.isArray(w.face_descriptor)&&w.face_descriptor.length===128){faceRegistered=true;registeredDescriptor=w.face_descriptor;setFaceStatus('🔐 इस Worker का Face पहले से registered है। जरूरत हो तो नया Face Register कर सकते हैं।','ok')}else setFaceStatus('⚠️ इस Worker का Face registered नहीं है। Save करने से पहले Face Register करना जरूरी है।','info')}
function validateWorkerDetails(){const name=document.getElementById('workerName')?.value.trim();const role=document.getElementById('workerRole')?.value.trim();const phone=normPhone(document.getElementById('workerMobile')?.value);const wage=Number(document.getElementById('workerWage')?.value||0);const village=document.getElementById('workerVillage')?.value.trim();if(!name)return 'Worker name जरूरी है';if(!role)return 'Work role / काम जरूरी है';if(phone.length!==10)return 'सही 10 अंकों का mobile number डालें';if(!Number.isFinite(wage)||wage<=0)return 'Daily Wage सही डालें';if(!village)return 'Village जरूरी है';return ''}
async function saveWorkerWithFace(){const err=validateWorkerDetails();if(err)return toast('❌ '+err);const id=currentId();if(!faceRegistered||!Array.isArray(registeredDescriptor)||registeredDescriptor.length!==128)return toast('❌ पहले Face Register सफल करें, फिर Worker Save करें');const payload={name:document.getElementById('workerName').value.trim(),work_role:document.getElementById('workerRole').value.trim(),phone:document.getElementById('workerMobile').value.trim(),daily_rate:Number(document.getElementById('workerWage').value||0),village:document.getElementById('workerVillage').value.trim(),upi_id:document.getElementById('workerUpi')?.value.trim()||null,face_descriptor:registeredDescriptor,face_registered:true,face_registered_at:new Date().toISOString()};let result;if(id)result=await SB.from('workers').update(payload).eq('id',id);else result=await SB.from('workers').insert(payload);if(result.error){console.error(result.error);toast('❌ Worker save नहीं हुआ: '+result.error.message);return}const attendanceStatus=document.getElementById('workerAttendanceStatus')?.value;if(id&&attendanceStatus&&typeof window.saveWorkerAttendance==='function')await window.saveWorkerAttendance(id,attendanceStatus);closeModal('workerModal');stopRegisterCamera();toast(id?'✅ Worker updated + Face registered':'✅ Worker added + Face registered');await refreshWorkerCache();if(typeof window.loadAll==='function')await window.loadAll()}
function installSaveGuard(){const form=document.getElementById('workerForm');if(!form||form.__faceSaveGuard)return;form.__faceSaveGuard=true;form.addEventListener('submit',async e=>{const id=currentId(),w=getWorker(id),needsFace=!id||!w?.face_registered;if(!needsFace&&faceRegistered)return;e.preventDefault();e.stopImmediatePropagation();await saveWorkerWithFace()},true)}
function patchOpen(){if(typeof window.openWorkerModal!=='function'||window.openWorkerModal.__facePatched)return;const original=window.openWorkerModal;const wrapped=function(id=''){if(id&&!document.getElementById('workerUpi')){const h=document.createElement('input');h.type='hidden';h.id='workerUpi';h.value=getWorker(id)?.upi_id||'';document.body.appendChild(h)}original(id);setTimeout(setupFaceState,30);setTimeout(installSaveGuard,30)};wrapped.__facePatched=true;window.openWorkerModal=wrapped}
function setVerifyStatus(t,type='info'){const e=document.getElementById('workerVerifyStatus');if(!e)return;e.textContent=t;e.style.background=type==='ok'?'#ecfdf5':type==='err'?'#fff1f2':'#eff6ff';e.style.color=type==='ok'?'#166534':type==='err'?'#9f1239':'#1d4ed8'}
function closeVerify(){stopVerifyCamera();document.getElementById('workerVerifyModal')?.classList.remove('show')}
function ensureVerifyModal(){if(document.getElementById('workerVerifyModal'))return;const m=document.createElement('div');m.className='modal';m.id='workerVerifyModal';m.innerHTML=`<div class="modalBox" style="max-width:560px"><div class="modalHead"><h3 id="workerVerifyTitle">🔐 Face Verification</h3><button class="close" type="button">×</button></div><div id="workerVerifyStatus" style="padding:12px;border-radius:12px;background:#eff6ff;color:#1d4ed8;font-weight:800">Camera शुरू करें और Worker का चेहरा सामने रखें।</div><div id="workerVerifyCamera" style="display:none;max-width:430px;aspect-ratio:4/3;background:#081827;border-radius:16px;overflow:hidden;margin:14px auto"><video id="workerVerifyVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video></div><div class="actions" style="margin-top:14px"><button class="btn btn-blue" id="workerVerifyStart" type="button">📷 Camera Start</button><button class="btn btn-green" id="workerVerifyScan" type="button" disabled>🔎 Verify Face</button><button class="btn btn-light" id="workerVerifyCancel" type="button">Cancel</button></div></div>`;document.body.appendChild(m);m.querySelector('.close').onclick=closeVerify;m.querySelector('#workerVerifyCancel').onclick=closeVerify;m.querySelector('#workerVerifyStart').onclick=startVerify;m.querySelector('#workerVerifyScan').onclick=scanVerify;m.addEventListener('click',e=>{if(e.target===m)closeVerify()})}
async function startVerify(){if(faceBusy)return;try{faceBusy=true;setVerifyStatus('Face model load हो रहा है...');await loadModels();verifyStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});const v=document.getElementById('workerVerifyVideo');v.srcObject=verifyStream;document.getElementById('workerVerifyCamera').style.display='block';document.getElementById('workerVerifyScan').disabled=false;setVerifyStatus('Camera तैयार है। अब Verify Face दबाएँ।','ok')}catch(e){setVerifyStatus('❌ Camera/Face model error: '+e.message,'err')}finally{faceBusy=false}}
async function scanVerify(){if(faceBusy)return;const id=document.getElementById('workerVerifyModal')?.dataset.workerId,w=getWorker(id);if(!w)return setVerifyStatus('❌ Worker नहीं मिला।','err');if(!w.face_registered||!Array.isArray(w.face_descriptor)||w.face_descriptor.length!==128)return setVerifyStatus('❌ Registered face नहीं है। पहले Edit → Face Register करें।','err');try{faceBusy=true;setVerifyStatus('🔎 Face verify हो रहा है...');await loadModels();const v=document.getElementById('workerVerifyVideo');const d=await faceapi.detectSingleFace(v,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.55})).withFaceLandmarks().withFaceDescriptor();if(!d)return setVerifyStatus('❌ चेहरा detect नहीं हुआ।','err');const distance=faceapi.euclideanDistance(d.descriptor,new Float32Array(w.face_descriptor));if(distance>.50)return setVerifyStatus(`❌ Face match नहीं हुआ। दूरी ${distance.toFixed(3)} है।`,'err');setVerifyStatus(`✅ Face Verified — ${w.name||w.worker_name||'Worker'} | Match ${distance.toFixed(3)}`,'ok');if(typeof window.saveWorkerAttendance==='function'){await window.saveWorkerAttendance(w.id,'present');toast(`✅ ${w.name||'Worker'} की आज की attendance Face Verification से Present कर दी गई।`)}else toast('⚠️ Face verified, लेकिन attendance function उपलब्ध नहीं है।');await refreshWorkerCache();setTimeout(closeVerify,900)}catch(e){setVerifyStatus('❌ Verification error: '+e.message,'err')}finally{faceBusy=false}}
window.openWorkerFaceVerification=function(workerId){ensureVerifyModal();const w=getWorker(workerId);const m=document.getElementById('workerVerifyModal');m.dataset.workerId=workerId;document.getElementById('workerVerifyTitle').textContent=`🔐 Face Verification — ${w?.name||w?.worker_name||'Worker'}`;document.getElementById('workerVerifyCamera').style.display='none';document.getElementById('workerVerifyScan').disabled=true;setVerifyStatus('Camera शुरू करें और Worker का चेहरा सामने रखें।');openModal('workerVerifyModal')}
function addVerifyButtons(){const cards=[...document.querySelectorAll('#workersList .workerCard')];cards.forEach((card,i)=>{const edit=card.querySelector('button[onclick*="editWorker("]');const m=edit?.getAttribute('onclick')?.match(/editWorker\(['\"]([^'\"]+)/);const w=m?getWorker(m[1]):getWorkers()[i];if(!w)return;const actions=card.querySelector('.actions');if(!actions||actions.querySelector('.workerFaceVerifyBtn'))return;const b=document.createElement('button');b.type='button';b.className='btn btn-dark btn-sm workerFaceVerifyBtn';b.textContent='🔐 Verify Face';b.onclick=()=>window.openWorkerFaceVerification(w.id);actions.insertBefore(b,actions.firstChild)})}
async function refreshAdminAttendanceDisplay(){if(!SB)return;try{const r=await SB.from('worker_attendance').select('worker_id,status,attendance_date');if(r.error){console.warn('Admin worker attendance:',r.error);return}const map={};(r.data||[]).forEach(a=>{const id=String(a.worker_id||'');if(!id)return;if(!map[id])map[id]={present:0,total:0};map[id].total++;const s=String(a.status||'').toLowerCase();if(['present','p','yes','1','full day','half day'].includes(s))map[id].present++});document.querySelectorAll('#workersList .workerCard').forEach(card=>{const btn=card.querySelector('button[onclick*="editWorker("]');const m=btn?.getAttribute('onclick')?.match(/editWorker\(['\"]([^'\"]+)/);const id=m?.[1];if(!id)return;const row=[...card.querySelectorAll('.workerRow')].find(x=>x.querySelector('span')?.textContent.trim().toLowerCase()==='attendance');if(!row)return;const a=map[String(id)];row.querySelector('strong').textContent=a?`${a.present}/${a.total} days`:'0/0 days'});}catch(e){console.warn('Admin attendance display:',e)}}
function patchRenderWorkers(){if(typeof window.renderWorkers!=='function'||window.renderWorkers.__faceRenderPatched)return;const original=window.renderWorkers;const wrapped=function(){original();setTimeout(addVerifyButtons,60);setTimeout(refreshAdminAttendanceDisplay,80)};wrapped.__faceRenderPatched=true;window.renderWorkers=wrapped}

/* =========================================================
   DATE-WISE WORKER ATTENDANCE DETAILS
   Attendance row in Admin Workers is clickable. This is an
   add-on only; Worker Add/Save/Face Registration is untouched.
========================================================= */
function attendanceDate(a){
  return a?.attendance_date || a?.date || a?.work_date || a?.day || '';
}
function attendanceIsPresent(a){
  const s=String(a?.status||'').trim().toLowerCase();
  return ['present','p','yes','1','full day'].includes(s);
}
function attendanceIsAbsent(a){
  const s=String(a?.status||'').trim().toLowerCase();
  return ['absent','a','no','0'].includes(s);
}
function attendanceLabel(a){
  if(attendanceIsPresent(a)) return '🟢 Present';
  if(attendanceIsAbsent(a)) return '🔴 Absent';
  return a?.status ? String(a.status) : '—';
}
function attendancePrettyDate(value){
  if(!value)return 'Date नहीं मिली';
  const d=new Date(String(value).slice(0,10)+'T00:00:00');
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function ensureAttendanceDetailModal(){
  if(document.getElementById('workerAttendanceDetailModal'))return;
  const m=document.createElement('div');
  m.className='modal';
  m.id='workerAttendanceDetailModal';
  m.innerHTML=`<div class="modalBox" style="max-width:900px"><div class="modalHead"><div><h3 id="workerAttendanceDetailTitle">📅 Worker Attendance</h3><div id="workerAttendanceDetailSub" style="color:#60738a;margin-top:5px"></div></div><button class="close" type="button">×</button></div><div id="workerAttendanceSummary" class="grid grid3" style="margin-bottom:18px"></div><div class="tableWrap"><table style="min-width:620px"><thead><tr><th>Date</th><th>Status</th><th>Day</th></tr></thead><tbody id="workerAttendanceDetailBody"><tr><td colspan="3"><div class="empty">Attendance load हो रही है...</div></td></tr></tbody></table></div></div>`;
  document.body.appendChild(m);
  m.querySelector('.close').onclick=()=>m.classList.remove('show');
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});
}
async function openWorkerAttendanceDetails(workerId){
  ensureAttendanceDetailModal();
  const w=getWorker(workerId)||getWorkers().find(x=>String(x.id)===String(workerId));
  const modal=document.getElementById('workerAttendanceDetailModal');
  const title=document.getElementById('workerAttendanceDetailTitle');
  const sub=document.getElementById('workerAttendanceDetailSub');
  const summary=document.getElementById('workerAttendanceSummary');
  const body=document.getElementById('workerAttendanceDetailBody');
  const name=w?.name||w?.worker_name||'Worker';
  title.textContent=`📅 ${name} — Attendance Details`;
  sub.textContent='Date-wise पूरी attendance';
  summary.innerHTML=`<div class="stat" style="min-height:105px;padding:16px"><div class="statTitle">कुल दिन</div><div class="statValue blue" style="font-size:27px;margin-top:12px">—</div></div><div class="stat" style="min-height:105px;padding:16px"><div class="statTitle">🟢 Present</div><div class="statValue green" style="font-size:27px;margin-top:12px">—</div></div><div class="stat" style="min-height:105px;padding:16px"><div class="statTitle">🔴 Absent</div><div class="statValue red" style="font-size:27px;margin-top:12px">—</div></div>`;
  body.innerHTML='<tr><td colspan="3"><div class="empty">Attendance load हो रही है...</div></td></tr>';
  modal.classList.add('show');
  if(!SB){body.innerHTML='<tr><td colspan="3"><div class="empty">Supabase उपलब्ध नहीं है।</div></td></tr>';return;}
  try{
    const r=await SB.from('worker_attendance').select('*').eq('worker_id',workerId);
    if(r.error)throw r.error;
    const rows=(r.data||[]).filter(a=>attendanceDate(a)).sort((a,b)=>String(attendanceDate(b)).localeCompare(String(attendanceDate(a))));
    const present=rows.filter(attendanceIsPresent).length;
    const absent=rows.filter(attendanceIsAbsent).length;
    const total=rows.length;
    summary.innerHTML=`<div class="stat" style="min-height:105px;padding:16px"><div class="statTitle">कुल Attendance Days</div><div class="statValue blue" style="font-size:27px;margin-top:12px">${total}</div></div><div class="stat" style="min-height:105px;padding:16px"><div class="statTitle">🟢 Present / Attended</div><div class="statValue green" style="font-size:27px;margin-top:12px">${present}</div></div><div class="stat" style="min-height:105px;padding:16px"><div class="statTitle">🔴 Absent</div><div class="statValue red" style="font-size:27px;margin-top:12px">${absent}</div></div>`;
    if(!rows.length){body.innerHTML='<tr><td colspan="3"><div class="empty">इस Worker की attendance अभी दर्ज नहीं है।</div></td></tr>';return;}
    body.innerHTML=rows.map((a,i)=>{const d=attendanceDate(a);const dayName=new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'});const cls=attendanceIsPresent(a)?'completed':attendanceIsAbsent(a)?'cancelled':'pending';return `<tr><td><strong>${esc(attendancePrettyDate(d))}</strong></td><td><span class="status ${cls}">${esc(attendanceLabel(a))}</span></td><td>${esc(dayName)}</td></tr>`}).join('');
  }catch(e){console.error('Worker attendance details:',e);body.innerHTML=`<tr><td colspan="3"><div class="empty">❌ Attendance details नहीं मिली: ${esc(e.message||'Unknown error')}</div></td></tr>`;}
}
function installAttendanceClick(){
  const box=document.getElementById('workersList');
  if(!box||box.__attendanceClickInstalled)return;
  box.__attendanceClickInstalled=true;
  box.addEventListener('click',e=>{
    const row=e.target.closest('.workerRow');
    if(!row||!box.contains(row))return;
    const label=row.querySelector('span')?.textContent.trim().toLowerCase();
    if(label!=='attendance')return;
    const card=row.closest('.workerCard');
    const edit=card?.querySelector('button[onclick*="editWorker("]');
    const m=edit?.getAttribute('onclick')?.match(/editWorker\(['\"]([^'\"]+)/);
    if(m?.[1]){e.preventDefault();openWorkerAttendanceDetails(m[1]);}
  });
  box.addEventListener('mousemove',e=>{const row=e.target.closest('.workerRow');if(row&&row.querySelector('span')?.textContent.trim().toLowerCase()==='attendance')row.style.cursor='pointer';});
}
function addAttendanceHint(){
  document.querySelectorAll('#workersList .workerCard .workerRow').forEach(row=>{if(row.querySelector('span')?.textContent.trim().toLowerCase()==='attendance'){row.title='Click करके date-wise attendance देखें';row.style.cursor='pointer';}});
}
function patchRenderWorkersAttendance(){
  if(typeof window.renderWorkers!=='function'||window.renderWorkers.__attendancePatched)return;
  const original=window.renderWorkers;
  const wrapped=function(){original();setTimeout(installAttendanceClick,30);setTimeout(addAttendanceHint,50)};
  wrapped.__attendancePatched=true;
  window.renderWorkers=wrapped;
}
async function boot(){for(let i=0;i<80;i++){if(window.sb&&document.getElementById('workerForm'))break;await new Promise(r=>setTimeout(r,100))}await refreshWorkerCache();ensureFaceUI();installSaveGuard();patchOpen();ensureVerifyModal();patchRenderWorkers();patchRenderWorkersAttendance();setTimeout(()=>{patchOpen();patchRenderWorkers();patchRenderWorkersAttendance();addVerifyButtons();setupFaceState();refreshAdminAttendanceDisplay();installAttendanceClick();addAttendanceHint()},300);const old=window.loadAll;if(old&&!old.__faceLoadWrapped){const wrapped=async function(...args){const r=await old.apply(this,args);await new Promise(r=>setTimeout(r,80));await refreshWorkerCache();addVerifyButtons();await refreshAdminAttendanceDisplay();installAttendanceClick();addAttendanceHint();return r};wrapped.__faceLoadWrapped=true;window.loadAll=wrapped}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();window.addEventListener('beforeunload',()=>{stopRegisterCamera();stopVerifyCamera()});
})();