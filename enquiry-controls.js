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

window.__enquiryControlsReady=true;
load().catch(e=>console.error('Initial enquiry load:',e));
})();