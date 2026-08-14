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
 const {data,error}=await FACE_SB.rpc('worker_login_by_phone',{p_phone:phone});
 const current=Array.isArray(data)?data[0]:data;
 if(error||!current){if(typeof msg==='function')msg('attendanceMsg','❌ Registered Worker नहीं मिला।','error');return;}
 if(!current.face_registered||!Array.isArray(current.face_descriptor)||current.face_descriptor.length!==128){if(typeof msg==='function')msg('attendanceMsg','❌ इस Worker का Face Admin Dashboard में registered नहीं है।','error');return;}
 const video=document.getElementById('video');
 if(!video||!video.srcObject){if(typeof msg==='function')msg('attendanceMsg','पहले Camera Start करें।','error');return;}
 try{
  busy=true;const btn=document.getElementById('markBtn');if(btn)btn.disabled=true;setStatus('🔐 Registered Face से matching हो रही है...');
  await loadModels();
  const detections=await faceapi.detectAllFaces(video,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.55})).withFaceLandmarks().withFaceDescriptors();
  if(detections.length!==1){if(typeof msg==='function')msg('attendanceMsg',detections.length>1?'एक समय में केवल एक चेहरा रखें।':'चेहरा साफ और सामने रखें।','error');return;}
  const live=Array.from(detections[0].descriptor);const saved=current.face_descriptor.map(Number);const dist=distance(live,saved);const threshold=.52;
  if(!Number.isFinite(dist)||dist>threshold){setStatus('❌ Face Match नहीं हुआ','err');if(typeof msg==='function')msg('attendanceMsg','❌ Face Match नहीं हुआ। Attendance नहीं लगाई गई।','error');return;}
  setStatus('✅ Face Match सफल','ok');
  const d=new Date().toISOString().slice(0,10);
  const {data:result,error:saveErr}=await FACE_SB.rpc('mark_worker_attendance_by_phone',{p_phone:current.phone,p_worker_id:current.id,p_attendance_date:d,p_check_in:new Date().toISOString(),p_verification_method:'face_recognition',p_verification_status:'verified',p_device_info:navigator.userAgent});
  if(saveErr){if(typeof msg==='function')msg('attendanceMsg','❌ Attendance save नहीं हुई: '+saveErr.message,'error');return;}
  if(!result?.ok){if(typeof msg==='function')msg('attendanceMsg',result?.reason==='already_marked'?'आज की attendance पहले ही लग चुकी है।':'Attendance save नहीं हुई।','error');return;}
  if(typeof msg==='function')msg('attendanceMsg','✅ Face Match सफल — आज की उपस्थिति दर्ज हो गई।','success');
  setStatus('Attendance marked','ok');
  if(video.srcObject){video.srcObject.getTracks().forEach(t=>t.stop());video.srcObject=null;}
  setTimeout(loadWorkerFinance,500);
 }catch(e){console.error(e);if(typeof msg==='function')msg('attendanceMsg','❌ Face verification में समस्या: '+e.message,'error');}finally{busy=false;const btn=document.getElementById('markBtn');if(btn)btn.disabled=false;}
};
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function addFinancePanel(){
 const box=document.getElementById('attendanceBox');if(!box||document.getElementById('workerFinancePanel'))return;
 const panel=document.createElement('section');panel.id='workerFinancePanel';panel.style.cssText='margin-top:22px;padding:18px;border:1px solid #e4e9f0;border-radius:18px;background:#fff;box-shadow:0 8px 25px #0000000a';
 panel.innerHTML=`<h2 style="margin:0 0 6px">💰 मेरी Attendance & Payment</h2><p style="margin:0 0 15px;color:#6b7788;font-size:13px">यह जानकारी केवल देखने के लिए है। Worker इसे edit नहीं कर सकता।</p><div id="financeCards" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"></div><div style="margin-top:18px"><h3 style="margin:0 0 8px">📅 Date-wise Attendance</h3><div id="financeAttendance" style="overflow:auto"></div></div><div style="margin-top:18px"><h3 style="margin:0 0 8px">💵 Payment History</h3><div id="financePayments" style="overflow:auto"></div></div>`;
 box.appendChild(panel);
}
async function loadWorkerFinance(){
 addFinancePanel();
 const phone=norm(document.getElementById('phone')?.value);if(phone.length!==10)return;
 const {data,error}=await FACE_SB.rpc('worker_financial_summary',{p_phone:phone});
 if(error||!data)return;
 const rate=Number(data.worker?.daily_rate||0),days=Number(data.present_days||0),earned=Number(data.earned||0),paid=Number(data.paid||0),pending=Number(data.pending||0);
 const cards=document.getElementById('financeCards');
 if(cards)cards.innerHTML=`<div style="padding:13px;border-radius:14px;background:#f8fafc"><small>💵 Daily Rate</small><div style="font-size:23px;font-weight:900">${money(rate)} <small>/ दिन</small></div></div><div style="padding:13px;border-radius:14px;background:#f8fafc"><small>📅 Present</small><div style="font-size:23px;font-weight:900">${days} दिन</div></div><div style="padding:13px;border-radius:14px;background:#f8fafc"><small>💰 कुल कमाई</small><div style="font-size:23px;font-weight:900">${money(earned)}</div></div><div style="padding:13px;border-radius:14px;background:#f8fafc"><small>✅ दिया गया</small><div style="font-size:23px;font-weight:900">${money(paid)}</div></div><div style="padding:13px;border-radius:14px;background:#fff7ed;grid-column:1/-1"><small>🟠 बाकी भुगतान</small><div style="font-size:28px;font-weight:900">${money(pending)}</div></div>`;
 const at=data.attendance||[];
 const ae=document.getElementById('financeAttendance');if(ae)ae.innerHTML=at.length?`<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">तारीख</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">स्थिति</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">दिन की मजदूरी</th></tr>${at.map(a=>`<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(a.date)}</td><td style="padding:8px;border-bottom:1px solid #eee">${a.status==='present'?'✅ Present':'❌ '+esc(a.status)}</td><td style="padding:8px;border-bottom:1px solid #eee">${a.status==='present'?money(rate):money(0)}</td></tr>`).join('')}</table>`:'<div style="padding:12px;background:#f8fafc;border-radius:10px">अभी attendance नहीं है।</div>';
 const ps=data.payments||[];const pe=document.getElementById('financePayments');if(pe)pe.innerHTML=ps.length?`<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">तारीख</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">राशि</th><th style="text-align:left;padding:8px;border-bottom:1px solid #ddd">तरीका</th></tr>${ps.map(p=>`<tr><td style="padding:8px;border-bottom:1px solid #eee">${esc(p.date)}</td><td style="padding:8px;border-bottom:1px solid #eee">${money(p.amount)}</td><td style="padding:8px;border-bottom:1px solid #eee">${esc(p.method||'—')}</td></tr>`).join('')}</table>`:'<div style="padding:12px;background:#f8fafc;border-radius:10px">अभी कोई payment record नहीं है।</div>';
}
window.loadWorkerFinance=loadWorkerFinance;
let tries=0;const timer=setInterval(()=>{const box=document.getElementById('attendanceBox');if(box&&!box.classList.contains('hidden')){loadWorkerFinance();clearInterval(timer);}if(++tries>60)clearInterval(timer);},500);
})();