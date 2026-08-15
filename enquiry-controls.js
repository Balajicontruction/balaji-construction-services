(()=>{
'use strict';
const S=()=>{try{return typeof sb!=='undefined'?sb:window.sb}catch(e){return window.sb||null}};
function norm(v){v=String(v||'').toLowerCase().trim();if(['approved','approve','accepted','accept'].includes(v))return'approved';if(['cancelled','canceled','cancel','rejected','reject'].includes(v))return'cancelled';return'pending'}
function label(v){return v==='approved'?'Approved':v==='cancelled'?'Cancelled':'Pending'}
function customerFor(e){const uid=String(e?.customer_user_id||'');const c=(typeof customers!=='undefined'?customers:[]).find(x=>String(x.user_id||'')===uid)||{};const p=(typeof profileMap!=='undefined'?profileMap[uid]:null)||{};return{c,p}}
function render(){const tb=document.getElementById('enquiriesTable');if(!tb)return;const list=(window.enquiries||[]);if(!list.length){tb.innerHTML='<tr><td colspan="5"><div class="empty">अभी कोई enquiry नहीं मिली।</div></td></tr>';return}tb.innerHTML=list.map(e=>{const {c,p}=customerFor(e);const name=e.name||e.customer_name||e.full_name||p.full_name||c.name||'—';const phone=e.phone||e.mobile||p.phone||c.phone||'—';const msg=e.message||e.details||e.enquiry||'—';const st=norm(e.status);return `<tr><td><strong>${esc(name)}</strong></td><td>${esc(phone)}</td><td style="max-width:360px;white-space:pre-wrap">${esc(msg)}</td><td><div class="actions"><button class="btn btn-green btn-sm" style="opacity:${st==='approved'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','approved')">Approve</button><button class="btn btn-red btn-sm" style="opacity:${st==='cancelled'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','cancelled')">Cancel</button><button class="btn btn-light btn-sm" style="opacity:${st==='pending'?1:.5}" onclick="updateEnquiryStatus('${esc(e.id)}','pending')">Pending</button></div><div style="margin-top:7px"><span class="status ${st==='approved'?'completed':st==='cancelled'?'cancelled':'pending'}">${label(st)}</span></div></td><td><div class="actions"><button class="btn btn-blue btn-sm" onclick="editEnquiry('${esc(e.id)}')">✏️ Edit</button><button class="btn btn-red btn-sm" onclick="deleteEnquiry('${esc(e.id)}')">🗑️ Delete</button></div></td></tr>`}).join('')}
async function load(){const s=S();if(!s)return;const r=await s.from('contract_requests').select('*').order('created_at',{ascending:false});if(r.error){console.error('contract_requests:',r.error);window.enquiries=[];render();return}window.enquiries=r.data||[];render()}
window.updateEnquiryStatus=async(id,status)=>{const r=await S().from('contract_requests').update({status:norm(status)}).eq('id',id);if(r.error){toast('❌ Status update नहीं हुआ: '+r.error.message);return}toast('✅ Status: '+label(norm(status)));await load()}
window.editEnquiry=async id=>{const e=(window.enquiries||[]).find(x=>String(x.id)===String(id));if(!e)return;const msg=prompt('Enquiry Message edit करें:',e.details||e.message||e.enquiry||'');if(msg===null)return;const r=await S().from('contract_requests').update({details:msg.trim()}).eq('id',id);if(r.error){toast('❌ Enquiry edit नहीं हुई: '+r.error.message);return}toast('✅ Enquiry updated');await load()}
window.deleteEnquiry=async id=>{if(!confirm('क्या इस enquiry को delete करना है?'))return;const r=await S().from('contract_requests').delete().eq('id',id);if(r.error){toast('❌ Enquiry delete नहीं हुई: '+r.error.message);return}toast('🗑️ Enquiry deleted');await load()}

/* =========================================================
   CUSTOMER RECORDS — ONLY ADD PROJECT COLUMN
========================================================= */
function renderCustomerProjectColumn(){
  const table=document.querySelector('#page-customers table');
  const tbody=document.getElementById('customersTable');
  if(!table||!tbody)return;

  const headRow=table.querySelector('thead tr');
  if(headRow&&!headRow.querySelector('.customer-project-head')){
    const th=document.createElement('th');
    th.className='customer-project-head';
    th.textContent='Project';
    const actionsTh=[...headRow.children].find(x=>String(x.textContent||'').trim().toLowerCase()==='actions');
    if(actionsTh)headRow.insertBefore(th,actionsTh);else headRow.appendChild(th);
  }

  const list=(typeof customers!=='undefined'?customers:[]);
  const listProjects=(typeof projects!=='undefined'?projects:[]);

  if(!list.length){
    const emptyCell=tbody.querySelector('td[colspan]');
    if(emptyCell)emptyCell.colSpan=7;
    return;
  }

  [...tbody.querySelectorAll('tr')].forEach((row,index)=>{
    row.querySelector('.customer-project-cell')?.remove();
    const customer=list[index];
    const cell=document.createElement('td');
    cell.className='customer-project-cell';
    const matches=listProjects.filter(p=>String(p.customer_id||'')===String(customer?.id||''));
    if(matches.length){
      cell.innerHTML=matches.map(p=>{
        const name=esc(p.project_name||p.work_type||'Project');
        const status=String(p.status||'').trim();
        return `<div style="margin-bottom:5px"><strong>${name}</strong>${status?`<br><small style="color:#60738a">${esc(status)}</small>`:''}</div>`;
      }).join('');
    }else{
      cell.textContent='—';
    }
    const actionsCell=row.lastElementChild;
    if(actionsCell)row.insertBefore(cell,actionsCell);else row.appendChild(cell);
  });
}

function hookCustomerRecords(){
  if(typeof window.renderCustomers==='function'&&!window.__customerProjectHook){
    const oldRenderCustomers=window.renderCustomers;
    window.renderCustomers=function(){
      const result=oldRenderCustomers.apply(this,arguments);
      setTimeout(renderCustomerProjectColumn,0);
      return result;
    };
    window.__customerProjectHook=true;
  }
  renderCustomerProjectColumn();
}

const oldLoad=window.loadAll;window.loadAll=async function(){const r=await oldLoad.apply(this,arguments);await load();setTimeout(hookCustomerRecords,0);return r};
setTimeout(()=>{load();hookCustomerRecords()},0);
setInterval(hookCustomerRecords,1500);
})();
