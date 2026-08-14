(()=>{
'use strict';
const MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const FACE_SB=window.supabase.createClient('https://iefxfyjmyssuiuyncfqz.supabase.co','sb_publishable_45zaRM5LLByFABddU5hm9g_4UwfnT7t');
let loaded=false,busy=false;
async function loadModels(){if(loaded)return;await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);loaded=true;}
function distance(a,b){let s=0;for(let i=0;i<Math.min(a.length,b.length);i++){const d=a[i]-b[i];s+=d*d;}return Math.sqrt(s);}
function setStatus(t,c='info'){const e=document.getElementById('faceStatus');if(e){e.textContent=t;e.style.background=c==='ok'?'#064e3b':c==='err'?'#7f1d1d':'#000b';}}
function norm(v){return String(v||'').replace(/\D/g,'').replace(/^91(?=\d{10}$)/,'').replace(/^0(?=\d{10}$)/,'');}
window.markAttendance=async function(){
 if(busy)return;
 const phone=norm(document.getElementById('phone')?.value);
 if(phone.length!==10){if(typeof msg==='function')msg('attendanceMsg','❌ Registered mobile number नहीं मिला।','error');return;}
 const {data:list,error:workerErr}=await FACE_SB.from('workers').select('id,name,phone,user_id,active,face_registered,face_descriptor').eq('active',true);
 if(workerErr){if(typeof msg==='function')msg('attendanceMsg','❌ Worker data नहीं मिला: '+workerErr.message,'error');return;}
 const current=list?.find(x=>norm(x.phone)===phone);
 if(!current){if(typeof msg==='function')msg('attendanceMsg','❌ Registered Worker नहीं मिला।','error');return;}
 if(!current.face_registered||!Array.isArray(current.face_descriptor)||current.face_descriptor.length!==128){if(typeof msg==='function')msg('attendanceMsg','❌ इस Worker का Face Admin Dashboard में registered नहीं है।','error');return;}
 const video=document.getElementById('video');
 if(!video||!video.srcObject){if(typeof msg==='function')msg('attendanceMsg','पहले Camera Start करें।','error');return;}
 try{
  busy=true;document.getElementById('markBtn').disabled=true;setStatus('🔐 Registered Face से matching हो रही है...');
  await loadModels();
  const detections=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.55})).withFaceLandmarks().withFaceDescriptors();
  if(detections.length!==1){if(typeof msg==='function')msg('attendanceMsg',detections.length>1?'एक समय में केवल एक चेहरा रखें।':'चेहरा साफ और सामने रखें।','error');return;}
  const live=Array.from(detections[0].descriptor);const saved=current.face_descriptor.map(Number);const dist=distance(live,saved);const threshold=.52;
  if(!Number.isFinite(dist)||dist>threshold){setStatus('❌ Face Match नहीं हुआ','err');if(typeof msg==='function')msg('attendanceMsg','❌ Face Match नहीं हुआ। Attendance नहीं लगाई गई।','error');return;}
  setStatus('✅ Face Match सफल','ok');
  const d=new Date().toISOString().slice(0,10);
  const {data:existing}=await FACE_SB.from('worker_attendance').select('id').eq('worker_id',current.id).eq('attendance_date',d).maybeSingle();
  if(existing){if(typeof msg==='function')msg('attendanceMsg','आज की attendance पहले ही लग चुकी है।','error');return;}
  const {error}=await FACE_SB.from('worker_attendance').insert({worker_id:current.id,attendance_date:d,status:'present',check_in:new Date().toISOString(),verification_method:'face_recognition',verification_status:'verified',check_in_face_verified:true,face_verified:true,device_info:navigator.userAgent,created_by:current.user_id||null});
  if(error){if(typeof msg==='function')msg('attendanceMsg','❌ Attendance save नहीं हुई: '+error.message,'error');return;}
  if(typeof msg==='function')msg('attendanceMsg','✅ Face Match सफल — आज की उपस्थिति दर्ज हो गई।','success');
  setStatus('Attendance marked','ok');
  video.srcObject.getTracks().forEach(t=>t.stop());video.srcObject=null;
 }catch(e){console.error(e);if(typeof msg==='function')msg('attendanceMsg','❌ Face verification में समस्या: '+e.message,'error');}finally{busy=false;document.getElementById('markBtn').disabled=false;}
};
})();