/* BALAJI Construction — Worker Payment UI
   This file ONLY adds worker-card payment/UPI/receipt/history UI.
   It does NOT modify Worker Add/Save, Face Registration/Verification,
   Edit Worker, or Attendance logic.
*/
(function(){
  'use strict';

  var state={workers:[],payments:[],attendance:[],faces:[]};
  var booted=false;

  function sb(){ return (typeof sb !== 'undefined' ? sb : (window.sb || null)); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];}); }
  function num(v){ var n=Number(String(v==null?'':v).replace(/[^0-9.-]/g,'')); return Number.isFinite(n)?n:0; }
  function money(v){ return '₹'+num(v).toLocaleString('en-IN'); }
  function today(){ var d=new Date(),z=function(n){return String(n).padStart(2,'0')}; return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); }
  function toastMsg(m){ if(typeof window.toast==='function') window.toast(m); else alert(m); }
  function workerName(w){ return w.name||w.worker_name||'Worker'; }
  function wage(w){ return num(w.daily_rate!=null?w.daily_rate:(w.daily_wage!=null?w.daily_wage:(w.wage!=null?w.wage:w.daily_salary))); }
  function upi(w){ return String(w.upi_id||w.upi||w.upi_number||w.payment_upi||'').trim(); }
  function getWorker(id){ return state.workers.find(function(w){return String(w.id)===String(id);})||null; }
  function paymentsFor(w){ return state.payments.filter(function(p){return String(p.worker_id)===String(w.id);}); }
  function paid(w){ return paymentsFor(w).reduce(function(a,p){return a+num(p.amount);},0); }
  function attendanceFor(w){
    var rows=state.attendance.filter(function(a){return String(a.worker_id||a.workerId)===String(w.id);});
    var present=0;
    rows.forEach(function(a){
      var s=String(a.status||a.attendance||'').toLowerCase().trim();
      if(['present','p','yes','1','full day'].indexOf(s)>=0) present++;
      else if(['half','half day','0.5'].indexOf(s)>=0) present+=0.5;
    });
    return {present:present,total:rows.length};
  }
  function photoFor(w){ return String(w.face_photo_url||w.photo_url||w.image_url||w.worker_image||w.profile_photo||w.avatar_url||w.photo||w.face_image_url||w.snapshot_url||w.image_data||'').trim(); }

  function addStyles(){
    if(document.getElementById('balajiWorkerPaymentStyles')) return;
    var s=document.createElement('style'); s.id='balajiWorkerPaymentStyles';
    s.textContent=''
      +'.workerPaymentBox{margin-top:16px;padding:15px;border:1px solid #dfe7ef;border-radius:17px;background:linear-gradient(180deg,#f8fafc,#f3f7fb)}'
      +'.workerPaymentTitle{font-size:18px;font-weight:900;color:#10233b;margin-bottom:11px}'
      +'.workerPaymentStats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}'
      +'.workerPaymentStat{background:#fff;border:1px solid #e5eaf0;border-radius:13px;padding:11px}'
      +'.workerPaymentStat span{display:block;font-size:12px;font-weight:800;color:#64748b}'
      +'.workerPaymentStat strong{display:block;margin-top:5px;font-size:19px}'
      +'.workerPaymentStat.earned{background:#fffaf3}.workerPaymentStat.paid{background:#effcf3}.workerPaymentStat.pending{background:#fff1f1}'
      +'.workerPaymentButtons{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}'
      +'.workerUpiBox{margin-top:10px;padding:10px 12px;background:#fff;border:1px dashed #cbd5e1;border-radius:11px;font-size:12px;color:#64748b}'
      +'.workerUpiBox b{color:#10233b}.workerUpiPay{background:#16a34a!important;color:#fff!important}'
      +'.workerPaymentHistory{margin-top:11px}.workerPaymentHistory details{background:#fff;border:1px solid #e5eaf0;border-radius:12px;padding:9px}'
      +'.workerPaymentHistory summary{cursor:pointer;font-weight:900}.workerPaymentHistory .tableWrap{overflow-x:auto;margin-top:9px}'
      +'.workerPaymentHistory table{width:100%;border-collapse:collapse;min-width:650px;font-size:12px}'
      +'.workerPaymentHistory th,.workerPaymentHistory td{padding:8px;border-bottom:1px solid #edf1f4;text-align:left;vertical-align:middle}'
      +'.workerPaymentHistory th{background:#f4f7fa;color:#60738a}'
      +'.workerReceiptThumb{width:58px;height:45px;object-fit:cover;border-radius:7px;border:1px solid #dbe3ea;vertical-align:middle}'
      +'.workerProfilePhoto{width:62px;height:62px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.12);display:block}'
      +'.workerNamePaymentBtn{display:inline-flex;align-items:center;justify-content:center;margin-top:7px;padding:7px 15px;border:0;border-radius:10px;background:#ff7f1f;color:#fff;font-weight:900;font-size:12px;cursor:pointer}'
      +'.workerPaymentModal .modalBox{max-width:620px}.workerUpiModal .modalBox{max-width:460px}'
      +'.workerPaymentSummary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}'
      +'.workerPaymentSummary div{background:#f6f8fb;border-radius:10px;padding:10px}.workerPaymentSummary span{display:block;font-size:11px;color:#64748b;font-weight:800}.workerPaymentSummary strong{font-size:16px}'
      +'@media(max-width:700px){.workerPaymentStats,.workerPaymentSummary{grid-template-columns:1fr}}';
    document.head.appendChild(s);
  }

  async function loadData(){
    var s=sb(); if(!s) return false;
    try{
      var wr=await s.from('workers').select('*').order('created_at',{ascending:false});
      if(wr.error){console.warn('worker payments workers load:',wr.error);return false;}
      state.workers=wr.data||[];
    }catch(e){console.warn(e);return false;}
    try{
      var ar=await s.from('worker_attendance').select('*'); state.attendance=ar.error?[]:(ar.data||[]);
    }catch(e){state.attendance=[];}
    try{
      var pr=await s.from('worker_payments').select('*').order('payment_date',{ascending:false}).order('created_at',{ascending:false}); state.payments=pr.error?[]:(pr.data||[]);
    }catch(e){state.payments=[];}
    try{
      var fr=await s.from('worker_face_registrations').select('*'); state.faces=fr.error?[]:(fr.data||[]);
      var map={}; state.faces.forEach(function(x){var id=x.worker_id||x.workerId;var photo=x.photo_url||x.image_url||x.photo||x.face_image||x.face_image_url||x.snapshot_url||x.image_data||x.face_data||'';if(id&&photo)map[String(id)]=photo;});
      state.workers.forEach(function(w){if(map[String(w.id)])w.face_photo_url=map[String(w.id)];});
    }catch(e){state.faces=[];}
    window.__workerAdminCache=state.workers;
    window.__workerAdminPaymentCache=state.payments;
    window.__workerAdminAttendanceCache=state.attendance;
    return true;
  }

  function receiptHTML(url){
    if(!url) return '—';
    var safe=esc(url);
    if(String(url).indexOf('data:image/')===0) return '<a href="'+safe+'" target="_blank" rel="noopener"><img class="workerReceiptThumb" src="'+safe+'" alt="Receipt"></a>';
    return '<a class="btn btn-light btn-sm" href="'+safe+'" target="_blank" rel="noopener">🧾 Receipt</a>';
  }

  function paymentPanel(w){
    var a=attendanceFor(w), earned=wage(w)*a.present, p=paid(w), pending=Math.max(0,earned-p), hist=paymentsFor(w), u=upi(w);
    var payLink=u&&pending>0?'upi://pay?pa='+encodeURIComponent(u)+'&pn='+encodeURIComponent(workerName(w))+'&am='+pending.toFixed(2)+'&cu=INR':'';
    return '<div class="workerPaymentBox" data-worker-payment="'+esc(w.id)+'">'
      +'<div class="workerPaymentTitle">💰 Worker Payment</div>'
      +'<div class="workerPaymentStats">'
      +'<div class="workerPaymentStat earned"><span>💰 Total Earnings</span><strong>'+money(earned)+'</strong><small style="color:#64748b">'+a.present+' paid-work day'+(a.present===1?'':'s')+' × '+money(wage(w))+'</small></div>'
      +'<div class="workerPaymentStat paid"><span>🟢 Paid / दिया हुआ</span><strong class="green">'+money(p)+'</strong></div>'
      +'<div class="workerPaymentStat pending"><span>🔴 Pending / बाकी</span><strong class="red">'+money(pending)+'</strong></div>'
      +'</div>'
      +'<div class="workerPaymentButtons">'
      +'<button type="button" class="btn btn-primary btn-sm" onclick="adminWorkerPayment(\''+esc(w.id)+'\')">💸 Payment Update</button>'
      +'<button type="button" class="btn btn-light btn-sm" onclick="adminSetWorkerUpi(\''+esc(w.id)+'\')">📲 '+(u?'UPI Edit':'UPI Set')+'</button>'
      +(payLink?'<a class="btn btn-sm workerUpiPay" href="'+esc(payLink)+'">📲 Pending '+money(pending)+' Pay</a>':'')
      +'</div>'
      +(u?'<div class="workerUpiBox">📲 UPI ID: <b>'+esc(u)+'</b>'+(pending>0?' • <b style="color:#dc2626">'+money(pending)+' बाकी</b>':'')+'</div>':'<div class="workerUpiBox">📲 UPI ID अभी set नहीं है। <button type="button" class="btn btn-blue btn-sm" onclick="adminSetWorkerUpi(\''+esc(w.id)+'\')">UPI Set करें</button></div>')
      +'<div class="workerPaymentHistory"><details><summary>📜 Payment History ('+hist.length+')</summary>'
      +(hist.length?'<div class="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Receipt</th><th>Action</th></tr></thead><tbody>'+hist.map(function(x){return '<tr><td>'+esc(x.payment_date||x.date||'—')+'</td><td><strong>'+money(x.amount)+'</strong></td><td>'+esc(x.payment_method||x.method||'—')+'</td><td>'+esc(x.reference_no||x.utr||x.reference||'—')+'</td><td>'+receiptHTML(x.receipt_url)+'</td><td><div class="actions"><button type="button" class="btn btn-blue btn-sm" onclick="adminEditWorkerPayment(\''+esc(x.id)+'\')">✏️ Edit</button><button type="button" class="btn btn-red btn-sm" onclick="adminDeleteWorkerPayment(\''+esc(x.id)+'\')">🗑️ Delete</button></div></td></tr>';}).join('')+'</tbody></table></div>':'<div class="empty" style="margin-top:10px">अभी कोई payment record नहीं है।</div>')
      +'</details></div></div>';
  }

  function cardWorker(card,index){
    var b=card.querySelector('button[onclick*="editWorker("]');
    var m=b&&b.getAttribute('onclick')?b.getAttribute('onclick').match(/editWorker\(['"]([^'"]+)/):null;
    return m?(getWorker(m[1])||state.workers[index]):(state.workers[index]||null);
  }

  function patchCards(){
    var box=document.getElementById('workersList'); if(!box) return;
    var cards=box.querySelectorAll('.workerCard');
    Array.prototype.forEach.call(cards,function(card,index){
      var w=cardWorker(card,index); if(!w) return;
      var av=card.querySelector('.workerHead .avatar'), photo=photoFor(w);
      if(av&&photo&&!av.dataset.workerPhotoApplied){
        var img=document.createElement('img');img.className='workerProfilePhoto';img.src=photo;img.alt=workerName(w);img.loading='lazy';img.dataset.workerPhotoApplied='1';av.replaceWith(img);
      }
      var head=card.querySelector('.workerHead');
      if(head&&!head.querySelector('.workerNamePaymentBtn')){
        var h3=head.querySelector('h3'); if(h3) h3.insertAdjacentHTML('afterend','<button type="button" class="workerNamePaymentBtn" onclick="adminWorkerPayment(\''+esc(w.id)+'\')">💰 PAYMENT</button>');
      }
      var old=card.querySelector('[data-worker-payment]'); if(old) old.remove();
      var actions=card.querySelector('.actions'); if(actions) actions.insertAdjacentHTML('beforebegin',paymentPanel(w));
    });
  }

  function modal(id,title,body){
    var old=document.getElementById(id); if(old) old.remove();
    var m=document.createElement('div');m.className='modal';m.id=id;
    m.innerHTML='<div class="modalBox"><div class="modalHead"><h3>'+title+'</h3><button class="close" type="button">×</button></div>'+body+'</div>';
    document.body.appendChild(m);m.classList.add('show');
    m.querySelector('.close').onclick=function(){m.remove();};
    m.addEventListener('click',function(e){if(e.target===m)m.remove();});
    return m;
  }

  function showUpi(id){
    var w=getWorker(id);if(!w)return toastMsg('❌ Worker नहीं मिला');
    var m=modal('adminWorkerUpiModal','📲 '+(upi(w)?'Edit':'Set')+' Worker UPI','<p><strong>'+esc(workerName(w))+'</strong></p><div class="field"><label>UPI ID</label><input id="workerPaymentUpiInput" type="text" autocomplete="off" placeholder="9876543210@upi" value="'+esc(upi(w))+'"><span class="uploadHint">उदाहरण: 9876543210@upi, name@ybl, name@oksbi</span></div><div class="modalActions"><button type="button" class="btn btn-light" id="workerUpiCancel">Cancel</button><button type="button" class="btn btn-green" id="workerUpiSave">💾 Save UPI</button></div>');
    m.querySelector('#workerUpiCancel').onclick=function(){m.remove();};
    m.querySelector('#workerUpiSave').onclick=async function(){
      var clean=m.querySelector('#workerPaymentUpiInput').value.trim().replace(/\s+/g,'');
      if(!clean)return toastMsg('❌ UPI ID डालें');
      if(!/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9._-]{2,}$/.test(clean))return toastMsg('❌ सही UPI ID डालें, जैसे 9876543210@upi');
      var s=sb();if(!s)return toastMsg('❌ Supabase उपलब्ध नहीं है');
      try{
        var r=await s.from('workers').update({upi_id:clean}).eq('id',w.id);
        if(r.error)throw r.error;
        var check=await s.from('workers').select('id,upi_id').eq('id',w.id).maybeSingle();
        if(check.error)throw check.error;
        if(!check.data||String(check.data.upi_id||'').trim()!==clean)throw new Error('Database ने UPI ID update नहीं की');
        w.upi_id=clean;state.workers=state.workers.map(function(x){return String(x.id)===String(w.id)?Object.assign({},x,{upi_id:clean}):x;});
        window.__workerAdminCache=state.workers;m.remove();toastMsg('✅ UPI ID save हो गई');patchCards();
      }catch(e){console.error(e);toastMsg('❌ UPI save नहीं हुई: '+(e.message||e));}
    };
  }

  function showPayment(id,paymentId){
    var w=getWorker(id);if(!w)return toastMsg('❌ Worker नहीं मिला');
    var rows=paymentsFor(w), current=paymentId?rows.find(function(x){return String(x.id)===String(paymentId);}):null;
    var a=attendanceFor(w),earned=wage(w)*a.present,basePaid=paid(w),old=current?num(current.amount):0,pending=Math.max(0,earned-(basePaid-old));
    var m=modal('adminWorkerPaymentModal',current?'✏️ Edit Worker Payment':'💸 Worker Payment Update','<strong>'+esc(workerName(w))+'</strong><div class="workerPaymentSummary"><div><span>Total Earnings</span><strong>'+money(earned)+'</strong></div><div><span>Paid</span><strong class="green">'+money(basePaid-old)+'</strong></div><div><span>Pending</span><strong class="red">'+money(pending)+'</strong></div></div><form id="workerPaymentForm"><div class="formGrid"><div class="field"><label>Payment Amount (₹)</label><input id="wpAmount" type="number" min="1" step=".01" required value="'+esc(current?current.amount:(pending>0?pending:''))+'"></div><div class="field"><label>Payment Date</label><input id="wpDate" type="date" required value="'+esc(current&&current.payment_date?current.payment_date:today())+'"></div><div class="field"><label>Payment Method</label><select id="wpMethod"><option>UPI</option><option>Cash</option><option>Bank</option></select></div><div class="field"><label>UTR / Reference</label><input id="wpRef" value="'+esc(current?(current.reference_no||current.utr||''):'')+'"></div><div class="field full"><label>Receipt / Screenshot</label><input id="wpReceipt" type="file" accept="image/*,.pdf"><span class="uploadHint">Payment receipt की photo/PDF Worker की payment history में save होगी।</span>'+(current&&current.receipt_url?'<div style="margin-top:8px">Current: '+receiptHTML(current.receipt_url)+'</div>':'')+'</div><div class="field full"><label>Notes</label><textarea id="wpNotes">'+esc(current?(current.notes||''):'')+'</textarea></div></div><div class="modalActions"><button type="button" class="btn btn-light" id="wpCancel">Cancel</button><button type="submit" class="btn btn-green">💾 '+(current?'Update Payment':'Save Payment')+'</button></div></form>');
    m.querySelector('#wpMethod').value=current?(current.payment_method||current.method||'UPI'):'UPI';
    m.querySelector('#wpCancel').onclick=function(){m.remove();};
    m.querySelector('#workerPaymentForm').onsubmit=async function(e){
      e.preventDefault();var s=sb();if(!s)return toastMsg('❌ Supabase उपलब्ध नहीं है');
      var amount=num(m.querySelector('#wpAmount').value);if(amount<=0)return toastMsg('❌ सही payment amount डालें');
      var file=m.querySelector('#wpReceipt').files[0],receipt=current?(current.receipt_url||null):null;
      if(file){if(file.size>4*1024*1024)return toastMsg('❌ Receipt 4MB से छोटी रखें');try{receipt=await new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(r.result)};r.onerror=rej;r.readAsDataURL(file);});}catch(err){return toastMsg('❌ Receipt process नहीं हुई');}}
      var payload={worker_id:w.id,amount:amount,payment_date:m.querySelector('#wpDate').value||today(),payment_method:m.querySelector('#wpMethod').value,reference_no:m.querySelector('#wpRef').value.trim()||null,notes:m.querySelector('#wpNotes').value.trim()||null,receipt_url:receipt};
      try{
        var r=current?await s.from('worker_payments').update(payload).eq('id',current.id):await s.from('worker_payments').insert(payload);
        if(r.error)throw r.error;
        m.remove();toastMsg(current?'✅ Payment updated':'✅ Payment save हो गई');await loadData();patchCards();
      }catch(err){console.error(err);toastMsg('❌ Payment save नहीं हुई: '+(err.message||err));}
    };
  }

  window.adminSetWorkerUpi=showUpi;
  window.adminWorkerPayment=function(id){showPayment(id,'');};
  window.adminEditWorkerPayment=function(id){var p=state.payments.find(function(x){return String(x.id)===String(id);});if(p)showPayment(p.worker_id,p.id);};
  window.adminDeleteWorkerPayment=async function(id){
    if(!confirm('क्या यह Worker payment permanently delete करना है?'))return;
    var s=sb();if(!s)return toastMsg('❌ Supabase उपलब्ध नहीं है');
    try{var r=await s.from('worker_payments').delete().eq('id',id);if(r.error)throw r.error;toastMsg('🗑️ Worker payment deleted');await loadData();patchCards();}catch(e){toastMsg('❌ Payment delete नहीं हुई: '+(e.message||e));}
  };

  async function boot(){
    if(booted)return;booted=true;addStyles();
    for(var i=0;i<80;i++){
      if(sb()&&document.getElementById('workersList'))break;
      await new Promise(function(r){setTimeout(r,250);});
    }
    if(!sb()||!document.getElementById('workersList')){booted=false;return;}
    await loadData();patchCards();
    var box=document.getElementById('workersList');
    if(box){new MutationObserver(function(){setTimeout(patchCards,80);}).observe(box,{childList:true,subtree:true});}
    var oldLoad=window.loadAll;
    if(oldLoad&&!oldLoad.__workerPaymentWrapped){
      var wrapped=async function(){var r=await oldLoad.apply(this,arguments);await new Promise(function(x){setTimeout(x,180);});await loadData();patchCards();return r;};
      wrapped.__workerPaymentWrapped=true;window.loadAll=wrapped;
    }
    patchCards();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
