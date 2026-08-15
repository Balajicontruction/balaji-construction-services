(()=>{
'use strict';

const S=()=>{try{return typeof sb!=='undefined'?sb:window.sb}catch(e){return window.sb||null}};

let enquiryCustomers={};
let enquiryProfiles={};

function norm(v){
  v=String(v||'').toLowerCase().trim();
  if(['approved','approve','accepted','accept'].includes(v))return 'approved';
  if(['cancelled','canceled','cancel','rejected','reject'].includes(v))return 'cancelled';
  return 'pending';
}

function label(v){
  return v==='approved'?'Approved':v==='cancelled'?'Cancelled':'Pending';
}

function customerFor(e){
  const uid=String(e?.customer_user_id||'');
  const c=enquiryCustomers[uid] ||
    ((typeof customers!=='undefined'?customers:[]).find(x=>
      String(x.user_id||'')===uid || String(x.id||'')===uid
    )||{});
  const p=enquiryProfiles[uid] ||
    ((typeof profileMap!=='undefined'?profileMap[uid]:null)||{});
  return {c,p};
}

/* =========================================================
   CUSTOMER ENQUIRIES RENDER
   Customer name/phone are resolved from customers/profiles
   using customer_user_id before the table is rendered.
========================================================= */
function render(){
  const tb=document.getElementById('enquiriesTable');
  if(!tb)return;

  const list=(window.enquiries||[]);

  if(!list.length){
    tb.innerHTML='<tr><td colspan="5"><div class="empty">अभी कोई enquiry नहीं मिली।</div></td></tr>';
    return;
  }

  tb.innerHTML=list.map(e=>{
    const {c,p}=customerFor(e);
    const name=e.name||e.customer_name||e.full_name||c.name||c.customer_name||p.full_name||'—';
    const phone=e.phone||e.mobile||c.phone||c.mobile||p.phone||'—';
    const msg=e.message||e.details||e.enquiry||'—';
    const st=norm(e.status);

    return `<tr>
      <td><strong>${esc(name)}</strong></td>
      <td>${esc(phone)}</td>
      <td style="max-width:360px;white-space:pre-wrap">${esc(msg)}</td>
      <td>
        <div class="actions">
          <button class="btn btn-green btn-sm" style="opacity:${st==='approved'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','approved')">Approve</button>
          <button class="btn btn-red btn-sm" style="opacity:${st==='cancelled'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','cancelled')">Cancel</button>
          <button class="btn btn-light btn-sm" style="opacity:${st==='pending'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','pending')">Pending</button>
        </div>
        <div style="margin-top:7px">
          <span class="status ${st==='approved'?'completed':st==='cancelled'?'cancelled':'pending'}">${label(st)}</span>
        </div>
      </td>
      <td>
        <div class="actions">
          <button class="btn btn-blue btn-sm" onclick="editEnquiry('${esc(e.id)}')">✏️ Edit</button>
          <button class="btn btn-red btn-sm" onclick="deleteEnquiry('${esc(e.id)}')">🗑️ Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* Load customer records BEFORE enquiry rendering. */
async function loadCustomerDirectory(list){
  const s=S();
  if(!s||!list.length)return;

  const ids=[...new Set(
    list.map(e=>String(e.customer_user_id||'')).filter(Boolean)
  )];

  if(!ids.length)return;

  try{
    const existing=(typeof customers!=='undefined'?customers:[]);
    existing.forEach(c=>{
      const uid=String(c.user_id||'');
      const cid=String(c.id||'');
      if(uid)enquiryCustomers[uid]=c;
      if(cid)enquiryCustomers[cid]=c;
    });

    const r=await s
      .from('customers')
      .select('id,user_id,name,phone,email,mobile,customer_name')
      .in('user_id',ids);

    if(!r.error){
      (r.data||[]).forEach(c=>{
        if(c.user_id)enquiryCustomers[String(c.user_id)]=c;
        if(c.id)enquiryCustomers[String(c.id)]=c;
      });
    }
  }catch(e){
    console.warn('enquiry customer lookup:',e);
  }

  try{
    const r=await s
      .from('profiles')
      .select('id,full_name,phone,email')
      .in('id',ids);

    if(!r.error){
      (r.data||[]).forEach(p=>{
        enquiryProfiles[String(p.id)]=p;
      });
    }
  }catch(e){
    console.warn('enquiry profile lookup:',e);
  }
}

/* Main enquiry loader. This is the source used by the existing
   Approve / Cancel / Pending / Edit / Delete controls. */
async function load(){
  const s=S();
  if(!s)return;

  const r=await s
    .from('contract_requests')
    .select('*')
    .order('created_at',{ascending:false});

  if(r.error){
    console.error('contract_requests:',r.error);
    window.enquiries=[];
    render();
    return;
  }

  window.enquiries=r.data||[];

  /* IMPORTANT: wait for customer data before rendering. */
  await loadCustomerDirectory(window.enquiries);

  render();
}

window.updateEnquiryStatus=async(id,status)=>{
  const s=S();
  if(!s)return;

  const r=await s
    .from('contract_requests')
    .update({status:norm(status)})
    .eq('id',id);

  if(r.error){
    toast('❌ Status update नहीं हुआ: '+r.error.message);
    return;
  }

  toast('✅ Status: '+label(norm(status)));
  await load();
};

window.editEnquiry=async id=>{
  const e=(window.enquiries||[]).find(x=>String(x.id)===String(id));
  if(!e)return;

  const msg=prompt(
    'Enquiry Message edit करें:',
    e.details||e.message||e.enquiry||''
  );

  if(msg===null)return;

  const s=S();
  if(!s)return;

  const r=await s
    .from('contract_requests')
    .update({details:msg.trim()})
    .eq('id',id);

  if(r.error){
    toast('❌ Enquiry edit नहीं हुई: '+r.error.message);
    return;
  }

  toast('✅ Enquiry updated');
  await load();
};

window.deleteEnquiry=async id=>{
  if(!confirm('क्या इस enquiry को delete करना है?'))return;

  const s=S();
  if(!s)return;

  const r=await s
    .from('contract_requests')
    .delete()
    .eq('id',id);

  if(r.error){
    toast('❌ Enquiry delete नहीं हुई: '+r.error.message);
    return;
  }

  toast('🗑️ Enquiry deleted');
  await load();
};

/*
  The dashboard loads its main data first and then injects this file.
  Run immediately (not after a delayed timeout) so the first page load
  resolves Customer Name + Phone without requiring Refresh.
*/
window.__enquiryControlsReady=true;
load().catch(e=>console.error('Initial enquiry load:',e));

})();