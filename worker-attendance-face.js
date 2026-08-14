(()=>{
'use strict';
const MODEL_URL='https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
let loaded=false,busy=false;
async function loadModels(){if(loaded)return;await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);loaded=true;}
function distance(a,b){let s=0;for(let i=0;i<Math.min(a.length,b.length);i++){const d=a[i]-b[i];s+=d*d;}return Math.sqrt(s);}
function setStatus(t,c='info'){const e=document.getElementById('faceStatus');if(e){e.textContent=t;e.style.background=c==='ok'?'#064e3b':c==='err'?'#7f1d1d':'#000b';}}
window.markAttendance=async function(){
 if(busy)return;
 if(!window.worker||!window.worker.id)return;
 if(!Array.isArray(window.worker.face_descriptor)||window.worker.face_descriptor.length!==128){
  if(typeof msg==='function')msg('attendanceMsg','❌ इस Worker का Face Admin Dashboard में registered नहीं है। पहले Admin में Face Register करें।','error');
  return;
 }
 const video=document.getElementById('video');
 if(!video||!video.srcObject){if(typeof msg==='function')msg('attendanceMsg','पहले Camera Start करें।','error');return;}
 try{
  busy=true;document.getElementById('markBtn').disabled=true;setStatus('🔐 Registered Face से matching हो रही है...');
  await loadModels();
  const detections=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.55})).withFaceLandmarks().withFaceDescriptors();
  if(detections.length!==1){if(typeof msg==='function')msg('attendanceMsg',detections.length>1?'एक समय में केवल एक चेहरा रखें।':'चेहरा साफ और सामने रखें।','error');return;}
  const live=Array.from(detections[0].descriptor);const saved=window.worker.face_descriptor.map(Number);const dist=distance(live,saved);const threshold=.52;
  if(!Number.isFinite(dist)||dist>threshold){setStatus('❌ Face Match नहीं हुआ','err');if(typeof msg==='function')msg('attendanceMsg','❌ Face Match नहीं हुआ। Attendance नहीं लगाई गई।','error');return;}
  setStatus('✅ Face Match सफल','ok');
  const d=new Date().toISOString().slice(0,10);
  const {data:existing}=await sb.from('worker_attendance').select('id').eq('worker_id',worker.id).eq('attendance_date',d).maybeSingle();
  if(existing){if(typeof msg==='function')msg('attendanceMsg','आज की attendance पहले ही लग चुकी है।','error');return;}
  const {error}=await sb.from('worker_attendance').insert({worker_id:worker.id,attendance_date:d,status:'present',check_in:new Date().toISOString(),verification_method:'face_recognition',verification_status:'verified',check_in_face_verified:true,face_verified:true,device_info:navigator.userAgent,created_by:worker.user_id||null});
  if(error){if(typeof msg==='function')msg('attendanceMsg','❌ Attendance save नहीं हुई: '+error.message,'error');return;}
  if(typeof msg==='function')msg('attendanceMsg','✅ Face Match सफल — आज की उपस्थिति दर्ज हो गई।','success');
  if(typeof checkToday==='function')await checkToday();
  if(window.stream){window.stream.getTracks().forEach(t=>t.stop());window.stream=null;}
  video.srcObject=null;setStatus('Attendance marked','ok');
 }catch(e){console.error(e);if(typeof msg==='function')msg('attendanceMsg','❌ Face verification में समस्या: '+e.message,'error');}finally{busy=false;document.getElementById('markBtn').disabled=false;}
};
})();