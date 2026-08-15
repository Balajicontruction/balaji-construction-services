(()=>{
'use strict';

const S=()=>{try{return typeof sb!=='undefined'?sb:window.sb||null}catch(e){return window.sb||null}};
let enquiryCustomers={};
let enquiryProfiles={};

function norm(v){v=String(v||'').toLowerCase().trim();if(['approved','approve','accepted','accept'].includes(v))return'approved';if(['cancelled','canceled','cancel','rejected','reject'].includes(v))return'cancelled';return'pending'}
function label(v){return v==='approved'?'Approved':v==='cancelled'?'Cancelled':'Pending'}
function esc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))}

function getUid(e){
 return String(e?.customer_user_id||e?.customer_id||e?.user_id||e?.customerId||e?.userId||'');
}
function customerFor(e){
 const uid=getUid(e);
 const c=enquiryCustomers[uid]||((typeof customers!=='undefined'?customers:[]).find(x=>String(x.user_id||'')===uid||String(x.id||'')===uid)||{});
 const p=enquiryProfiles[uid]||((typeof profileMap!=='undefined'?profileMap[uid]:null)||{});
 return {c,p};
}

function render(){
 const tb=document.getElementById('enquiriesTable');if(!tb)return;
 const list=window.enquiries||[];
 if(!list.length){tb.innerHTML='<tr><td colspan="5"><div class="empty">अभी कोई enquiry नहीं मिली।</div></td></tr>';return}
 tb.innerHTML=list.map(e=>{
  const {c,p}=customerFor(e);
  const name=e.name||e.customer_name||e.full_name||c.name||c.customer_name||p.full_name||'—';
  const phone=e.phone||e.mobile||e.phone_number||c.phone||c.mobile||p.phone||'—';
  const msg=e.message||e.details||e.enquiry||'—';
  const st=norm(e.status);
  return `<tr><td><strong>${esc(name)}</strong></td><td>${esc(phone)}</td><td style="max-width:360px;white-space:pre-wrap">${esc(msg)}</td><td><div class="actions"><button class="btn btn-green btn-sm" style="opacity:${st==='approved'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','approved')">Approve</button><button class="btn btn-red btn-sm" style="opacity:${st==='cancelled'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','cancelled')">Cancel</button><button class="btn btn-light btn-sm" style="opacity:${st==='pending'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','pending')">Pending</button></div><div style="margin-top:7px"><span class="status ${st==='approved'?'completed':st==='cancelled'?'cancelled':'pending'}">${label(st)}</span></div></td><td><div class="actions"><button class="btn btn-blue btn-sm" onclick="editEnquiry('${esc(e.id)}')">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteEnquiry('${esc(e.id)}')">🗑️ Delete</button></div></td></tr>`
 }).join('');
 updateNotification(list);
}

async function loadCustomerDirectory(list){
 const s=S();
 const ids=[...new Set(list.map(getUid).filter(Boolean))];
 const existing=(typeof customers!=='undefined'?customers:[]);
 existing.forEach(c=>{if(c.user_id)enquiryCustomers[String(c.user_id)]=c;if(c.id)enquiryCustomers[String(c.id)]=c});
 if(!s||!ids.length)return;
 try{
  const r=await s.from('customers').select('*').in('user_id',ids);
  if(!r.error)(r.data||[]).forEach(c=>{if(c.user_id)enquiryCustomers[String(c.user_id)]=c;if(c.id)enquiryCustomers[String(c.id)]=c});
 }catch(e){console.warn('customer user_id lookup:',e)}
 try{
  const r=await s.from('customers').select('*').in('id',ids);
  if(!r.error)(r.data||[]).forEach(c=>{if(c.user_id)enquiryCustomers[String(c.user_id)]=c;if(c.id)enquiryCustomers[String(c.id)]=c});
 }catch(e){}
 try{
  const r=await s.from('profiles').select('*').in('id',ids);
  if(!r.error)(r.data||[]).forEach(p=>{enquiryProfiles[String(p.id)]=p});
 }catch(e){}
}

async function load(){
 const s=S();if(!s)return;
 try{await s.auth.getSession()}catch(e){}
 /* IMPORTANT: the dashboard's existing enquiry data is stored in contract_requests. */
 const r=await s.from('contract_requests').select('*').order('created_at',{ascending:false});
 if(r.error){console.error('contract_requests:',r.error);return}
 window.enquiries=r.data||[];
 await loadCustomerDirectory(window.enquiries);
 render();
}

function updateNotification(list){
 const count=list.filter(e=>norm(e.status)==='pending').length;
 let b=document.getElementById('enquiryNotifyButton');
 if(!b){
  const title=document.querySelector('.topTitle');
  if(!title)return;
  b=document.createElement('button');
  b.id='enquiryNotifyButton';
  b.type='button';
  b.title='Customer Enquiries खोलें';
  b.style.cssText='position:relative;border:0;background:#fff3e8;color:#ff7f1f;border-radius:14px;width:48px;height:48px;font-size:23px;cursor:pointer;margin-left:8px;box-shadow:0 5px 18px rgba(245,130,32,.12)';
  b.innerHTML='✉️<span id="enquiryNotifyBadge" style="position:absolute;right:-5px;top:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:20px;background:#dc2626;color:#fff;font:800 11px Arial;display:grid;place-items:center"></span>';
  b.onclick=()=>{const nav=[...document.querySelectorAll('.nav button')].find(x=>/Customer Enquiries/i.test(x.textContent||''));if(nav)nav.click();else{const target=document.querySelector('[data-page="enquiries"],#enquiries');if(target)target.scrollIntoView({behavior:'smooth'})}};
  title.appendChild(b);
 }
 const badge=document.getElementById('enquiryNotifyBadge');if(badge){badge.textContent=count>99?'99+':String(count);badge.style.display=count?'grid':'none'}
}

window.updateEnquiryStatus=async(id,status)=>{const s=S();if(!s)return;const r=await s.from('contract_requests').update({status:norm(status)}).eq('id',id);if(r.error){toast('❌ Status update नहीं हुआ: '+r.error.message);return}toast('✅ Status: '+label(norm(status)));await load()};
window.editEnquiry=async id=>{const e=(window.enquiries||[]).find(x=>String(x.id)===String(id));if(!e)return;const msg=prompt('Enquiry Message edit करें:',e.details||e.message||e.enquiry||'');if(msg===null)return;const s=S();if(!s)return;const r=await s.from('contract_requests').update({details:msg.trim()}).eq('id',id);if(r.error){toast('❌ Enquiry edit नहीं हुई: '+r.error.message);return}toast('✅ Enquiry updated');await load()};
window.deleteEnquiry=async id=>{if(!confirm('क्या इस enquiry को delete करना है?'))return;const s=S();if(!s)return;const r=await s.from('contract_requests').delete().eq('id',id);if(r.error){toast('❌ Enquiry delete नहीं हुई: '+r.error.message);return}toast('🗑️ Enquiry deleted');await load()};

/* =========================================================
   OVERVIEW PROJECT PROGRESS VIEW
   Only replaces the Recent Projects "Progress Update" button.
   The existing Daily Progress Update workflow remains untouched.
========================================================= */

function progressViewEsc(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))}
function progressValue(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0}
function progressDate(v){if(!v)return'—';const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}

function ensureProgressViewModal(){
 if(document.getElementById('overviewProgressViewModal'))return;
 const m=document.createElement('div');
 m.id='overviewProgressViewModal';
 m.className='modal';
 m.innerHTML=`<div class="modalBox" style="max-width:900px">
   <div class="modalHead">
     <div><h3 id="overviewProgressViewTitle">📊 Project Progress</h3><div id="overviewProgressViewSub" style="color:#718096;margin-top:5px"></div></div>
     <button class="close" type="button" id="overviewProgressViewClose">×</button>
   </div>
   <div id="overviewProgressViewBody"></div>
 </div>`;
 document.body.appendChild(m);
 m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});
 document.getElementById('overviewProgressViewClose').onclick=()=>m.classList.remove('show');
}

async function showOverviewProgress(projectId){
 ensureProgressViewModal();
 const modal=document.getElementById('overviewProgressViewModal');
 const body=document.getElementById('overviewProgressViewBody');
 const title=document.getElementById('overviewProgressViewTitle');
 const sub=document.getElementById('overviewProgressViewSub');
 const p=typeof getProject==='function'?getProject(projectId):((typeof projects!=='undefined'?projects:[]).find(x=>String(x.id)===String(projectId))||{});
 title.textContent='📊 '+(p?.project_name||p?.work_type||'Project Progress');
 sub.textContent='Current progress और daily progress history';
 body.innerHTML='<div style="padding:30px;text-align:center;color:#718096">Progress history load हो रही है...</div>';
 modal.classList.add('show');
 const s=S();
 if(!s){body.innerHTML='<div class="card">Supabase connection उपलब्ध नहीं है।</div>';return}
 let rows=[];
 try{
  const r=await s.from('project_updates').select('*').eq('project_id',projectId).order('update_date',{ascending:false});
  if(r.error)throw r.error;
  rows=r.data||[];
 }catch(e){
  console.error('overview progress history:',e);
  body.innerHTML='<div class="card" style="color:#dc2626">Progress history load नहीं हो सकी।</div>';
  return;
 }
 const current=rows.length?progressValue(rows[0].progress_percent):(typeof projectProgress==='function'?progressValue(projectProgress(projectId)):progressValue(p?.progress_percent));
 const latestDate=rows.length?progressDate(rows[0].update_date):'अभी कोई daily update नहीं';
 const history=rows.length?rows.map((u,i)=>`<div style="padding:18px 0;border-bottom:1px solid #e8edf2">
   <div style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap">
     <div><strong style="font-size:17px">${progressViewEsc(progressDate(u.update_date))}</strong><div style="color:#718096;font-size:13px;margin-top:4px">Daily Progress Update ${i===0?'• Latest':''}</div></div>
     <div style="font-size:22px;font-weight:900;color:#ff7f1f">${progressValue(u.progress_percent)}%</div>
   </div>
   <div style="height:10px;background:#e3e9ef;border-radius:20px;overflow:hidden;margin:12px 0"><div style="height:100%;width:${progressValue(u.progress_percent)}%;background:linear-gradient(90deg,#ff7f1f,#ffad5a);border-radius:20px"></div></div>
   ${u.details?`<div style="color:#334155;line-height:1.55;white-space:pre-wrap">${progressViewEsc(u.details)}</div>`:''}
   ${u.photo_url?`<img src="${progressViewEsc(u.photo_url)}" alt="Progress photo" style="display:block;max-width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin-top:12px;border:1px solid #e3e9f0" onerror="this.style.display='none'">`:''}
 </div>`).join(''):'<div style="padding:22px 0;color:#718096">अभी इस project की कोई Daily Progress Update नहीं है।</div>';
 body.innerHTML=`<div style="background:#f8fafc;border:1px solid #e5ebf1;border-radius:18px;padding:20px;margin-bottom:18px">
   <div style="display:flex;justify-content:space-between;align-items:end;gap:15px;flex-wrap:wrap"><div><div style="color:#718096;font-weight:800">CURRENT PROGRESS</div><div style="font-size:38px;font-weight:900;color:#ff7f1f;margin-top:5px">${current}%</div></div><div style="text-align:right;color:#718096;font-size:13px">Latest update<br><strong style="color:#15233a">${latestDate}</strong></div></div>
   <div style="height:14px;background:#e3e9ef;border-radius:20px;overflow:hidden;margin-top:15px"><div style="height:100%;width:${current}%;background:linear-gradient(90deg,#ff7f1f,#ffad5a);border-radius:20px;transition:width .5s ease"></div></div>
 </div>
 <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><h4 style="margin:0;font-size:19px">📅 Daily Progress History</h4><span style="color:#718096;font-size:13px">${rows.length} update${rows.length===1?'':'s'}</span></div>
 <div>${history}</div>`;
}

function patchOverviewProgressButtons(){
 const buttons=[...document.querySelectorAll('.projectCard button[onclick*="openProgressModal"]')];
 buttons.forEach(btn=>{
  if(btn.dataset.overviewProgressView==='1')return;
  const raw=btn.getAttribute('onclick')||'';
  const m=raw.match(/openProgressModal\(\s*['\"]([^'\"]+)['\"]\s*\)/);
  if(!m)return;
  const projectId=m[1];
  btn.dataset.overviewProgressView='1';
  btn.removeAttribute('onclick');
  btn.textContent='📊 Progress';
  btn.title='Current progress और daily progress history देखें';
  btn.addEventListener('click',()=>showOverviewProgress(projectId));
 });
}

const progressPatchTimer=setInterval(patchOverviewProgressButtons,500);
setTimeout(()=>clearInterval(progressPatchTimer),15000);
setTimeout(patchOverviewProgressButtons,100);
setTimeout(patchOverviewProgressButtons,1000);
setTimeout(patchOverviewProgressButtons,2500);

window.__enquiryControlsReady=true;
load().catch(e=>console.error('Initial enquiry load:',e));
})();