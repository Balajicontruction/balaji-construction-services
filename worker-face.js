(()=>{
'use strict';
let faceStream=null,faceModelsLoaded=false,registeredDescriptor=null,faceRegistered=false,faceBusy=false,installed=false;
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
   <div class="uploadHint" style="margin-top:8px">पहली बार Worker add करते समय एक साफ चेहरा register होगा। बाद में इसी registered face से attendance verification होगी।</div>
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
function currentWorker(){
 const id=currentWorkerId();
 if(!id)return null;
 return Array.isArray(window.__balajiWorkers)?window.__balajiWorkers.find(w=>String(w.id)===String(id)):null;
}
async function setupFaceState(){
 ensureFaceUI();stopCamera();registeredDescriptor=null;faceRegistered=false;
 const id=currentWorkerId();
 let w=currentWorker();
 if(id&&!w){const r=await sb.from('workers').select('id,face_registered,face_descriptor').eq('id',id).maybeSingle();if(!r.error)w=r.data;}
 if(w?.face_registered && Array.isArray(w.face_descriptor)){
  faceRegistered=true;registeredDescriptor=w.face_descriptor;
  setFaceStatus('🔐 Face पहले से registered है। दोबारा register करने की जरूरत नहीं।','ok');
 }else setFaceStatus('⚠️ इस Worker का Face अभी registered नहीं है। Face Register करें।','info');
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
 if(normPhone(phone).length!==10){toast('❌ सही 10 अंकों का mobile number डालें');return;}
 if(!faceRegistered||!Array.isArray(registeredDescriptor)||registeredDescriptor.length!==128){toast('❌ पहले Face Register करें');return;}
 const payload={name,work_role:role,phone,daily_rate:wage,village,face_descriptor:registeredDescriptor,face_registered:true,face_registered_at:new Date().toISOString()};
 let result=id?await sb.from('workers').update(payload).eq('id',id):await sb.from('workers').insert(payload).select('id').single();
 if(result.error){toast('❌ Worker save नहीं हुआ: '+result.error.message);return;}
 const workerId=id||result.data?.id;
 if(workerId){
  const rr=await sb.from('worker_face_registrations').upsert({worker_id:workerId,face_descriptor:registeredDescriptor,registered_at:new Date().toISOString()},{onConflict:'worker_id'});
  if(rr.error){toast('⚠️ Worker save हो गया लेकिन Face registration record save नहीं हुआ: '+rr.error.message);return;}
  if(attendanceStatus)await window.saveWorkerAttendance(workerId,attendanceStatus);
 }
 closeModal('workerModal');stopCamera();toast(id?'✅ Worker updated + Face registered':'✅ Worker added + Face registered');await loadAll();
}
function install(){
 if(installed)return;
 if(!window.sb||!window.openWorkerModal||!window.faceapi)return;
 installed=true;
 ensureFaceUI();
 const originalOpen=window.openWorkerModal;
 window.openWorkerModal=function(id=''){originalOpen(id);setTimeout(()=>setupFaceState(),50);};
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
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else setTimeout(install,0);
})();