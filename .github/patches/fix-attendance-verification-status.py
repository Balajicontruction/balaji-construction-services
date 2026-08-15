from pathlib import Path

p = Path('dashboard.html')
s = p.read_text(encoding='utf-8')
s = s.replace("verification_status:'approved',verification_method:'face_recognition'", "verification_status:'verified',verification_method:'face_recognition'")
s = s.replace("verification_status:'rejected',updated_at", "verification_status:'failed',updated_at")
s = s.replace('.status.cancelled{', '.status.rejected{background:#fee2e2;color:#dc2626}.status.cancelled{', 1)
s = s.replace('<option value="received">Received</option>\n          <option value="pending">Pending</option>', '<option value="received">Received</option>\n          <option value="pending">Pending</option>\n          <option value="rejected">Rejected</option>', 1)
old = '''      const status =\n        String(\n          p.status ||\n          'pending'\n        ).toLowerCase();'''
new = '''      const status = String(p.status || 'pending').toLowerCase();\n      const displayStatus = status === 'received' ? 'received' : String(p.notes || '').includes('[PAYMENT_REJECTED]') ? 'rejected' : 'pending';'''
s = s.replace(old, new, 1)
s = s.replace('''            <span class="status ${esc(status)}">\n              ${status === 'received'\n                ? '✅ Received'\n                : '⏳ Pending'}\n            </span>''', '''            <span class="status ${esc(displayStatus)}">\n              ${displayStatus === 'received' ? '✅ Received' : displayStatus === 'rejected' ? '❌ Rejected' : '⏳ Pending'}\n            </span>''', 1)
s = s.replace('''            <div class="actions">\n\n              <button\n                class="btn btn-blue btn-sm"\n                onclick="editPayment('${esc(p.id)}')">\n\n                ✏️ Edit\n\n              </button>\n\n              <button\n                class="btn btn-red btn-sm"\n                onclick="deletePayment('${esc(p.id)}')">\n\n                🗑️ Delete\n\n              </button>\n\n            </div>''', '''            <div class="actions">\n              ${displayStatus !== 'received' ? `<button class="btn btn-green btn-sm" onclick="reviewPayment('${esc(p.id)}','received')">✅ Approve</button>` : ''}\n              ${displayStatus !== 'rejected' ? `<button class="btn btn-red btn-sm" onclick="reviewPayment('${esc(p.id)}','rejected')">❌ Cancel / Reject</button>` : ''}\n              ${displayStatus !== 'pending' ? `<button class="btn btn-blue btn-sm" onclick="reviewPayment('${esc(p.id)}','pending')">⏳ Pending</button>` : ''}\n              <button class="btn btn-blue btn-sm" onclick="editPayment('${esc(p.id)}')">✏️ Edit</button>\n              <button class="btn btn-red btn-sm" onclick="deletePayment('${esc(p.id)}')">🗑️ Delete</button>\n            </div>''', 1)
s = s.replace("    }else{\n\n      pending += amount;\n\n    }", "    }else if(String(p.status || '').toLowerCase() === 'pending'){\n      pending += amount;\n    }", 1)
marker = "async function deletePayment(id){"
if "async function reviewPayment(id,nextStatus)" not in s:
    helper = '''async function reviewPayment(id,nextStatus){\n  const p=payments.find(x=>String(x.id)===String(id)); if(!p)return;\n  const label=nextStatus==='received'?'Approve करके Received करना':nextStatus==='rejected'?'Cancel करके Rejected करना':'वापस Pending करना';\n  if(!confirm(`इस payment को ${label} है?`))return;\n  let notes=String(p.notes||'').replace(/\\[PAYMENT_REJECTED\\]\\s*/g,'').trim();\n  if(nextStatus==='rejected')notes='[PAYMENT_REJECTED] '+notes;\n  const {error}=await sb.from('payments').update({status:nextStatus==='rejected'?'pending':nextStatus,notes}).eq('id',id);\n  if(error){toast('❌ Payment status update नहीं हुआ: '+error.message);return;}\n  toast(nextStatus==='received'?'✅ Payment Received approve हो गया':nextStatus==='rejected'?'❌ Payment Rejected':'⏳ Payment Pending'); await loadAll();\n}\n\n\n'''
    s = s.replace(marker, helper+marker, 1)

marker2='''/* BALAJI CUSTOMER COLUMNS NORMALIZER */'''
if marker2 not in s:
    s += r'''
<script>
/* BALAJI CUSTOMER COLUMNS NORMALIZER */
(()=>{
  'use strict';
  function normalizeCustomerColumns(){
    const tb=document.getElementById('customersTable'); const table=tb?.closest('table'); if(!tb||!table)return;
    const head=table.querySelector('thead tr');
    if(head){const projects=[...head.children].filter(x=>x.textContent.trim().toLowerCase()==='projects');projects.slice(1).forEach(x=>x.remove());const actions=[...head.children].filter(x=>x.textContent.trim().toLowerCase()==='actions');if(actions.length){actions.slice(1).forEach(x=>x.remove());head.appendChild(actions[0]);}}
    tb.querySelectorAll('tr').forEach(row=>{const action=[...row.children].find(td=>td.querySelector('[onclick*="editCustomer"],[onclick*="deleteCustomer"]'));if(!action)return;const heads=[...table.querySelectorAll('thead tr th')];const pi=heads.findIndex(th=>th.textContent.trim().toLowerCase()==='projects');const project=pi>=0?row.children[pi]:null;if(project&&project!==action)row.insertBefore(project,action);if(action!==row.lastElementChild)row.appendChild(action);});
  }
  normalizeCustomerColumns();setTimeout(normalizeCustomerColumns,300);setTimeout(normalizeCustomerColumns,1000);setInterval(normalizeCustomerColumns,2500);
})();
</script>
'''
p.write_text(s, encoding='utf-8')

c = Path('customer-dashboard.html')
t = c.read_text(encoding='utf-8')
t = t.replace('.pill{display:inline-block;', '.pill.rejected{background:#fee2e2;color:#dc2626}.pill{display:inline-block;', 1)
t = t.replace("select('id,project_id,payment_date,amount,payment_method,reference_no,notes')", "select('id,project_id,payment_date,amount,payment_method,reference_no,notes,status')", 1)
t = t.replace("paid+=(x||[]).reduce((s,a)=>s+Number(a.amount||0),0)", "paid+=(x||[]).filter(a=>String(a.status||'pending').toLowerCase()==='received').reduce((s,a)=>s+Number(a.amount||0),0)", 1)
t = t.replace("const pay=allp.filter(x=>x.project_id===p.id).reduce((s,x)=>s+Number(x.amount||0),0);", "const pay=allp.filter(x=>x.project_id===p.id && String(x.status||'pending').toLowerCase()==='received').reduce((s,x)=>s+Number(x.amount||0),0);", 1)
old_pay = "q('payments').innerHTML=allp.length?'<table class=\"table\"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>'+allp.map(x=>`<tr><td>${esc(x.payment_date)}</td><td>${money(x.amount)}</td><td>${esc(x.payment_method)}</td><td>${esc(x.reference_no)}</td></tr>`).join('')+'</tbody></table>':'अभी payment record नहीं है।';"
new_pay = "q('payments').innerHTML=allp.length?'<table class=\"table\"><thead><tr><th>Project</th><th>Date</th><th>Amount</th><th>Status</th><th>Method</th><th>Reference</th></tr></thead><tbody>'+allp.map(x=>{const ps=String(x.status||'pending').toLowerCase()==='received'?'received':String(x.notes||'').includes('[PAYMENT_REJECTED]')?'rejected':'pending';const pp=projects.find(p=>String(p.id)===String(x.project_id));return `<tr><td>${esc(pp?.project_name||'—')}</td><td>${esc(x.payment_date)}</td><td>${money(x.amount)}</td><td><span class=\"pill ${ps==='rejected'?'rejected':''}\">${ps==='received'?'✅ Received':ps==='rejected'?'❌ Rejected':'⏳ Pending'}</span></td><td>${esc(x.payment_method||'—')}</td><td>${esc(x.reference_no||'—')}</td></tr>`}).join('')+'</tbody></table>':'अभी payment record नहीं है।';"
t = t.replace(old_pay, new_pay, 1)
old_req = "async function requestPayment(){if(!projects.length){q('payMsg').textContent='पहले project assign होना जरूरी है।';return}const ref=prompt('Payment करने के बाद transaction/reference number डालें:');if(!ref)return;const p=projects[0];const{error}=await sb.from('payments').insert({project_id:p.id,payment_date:new Date().toISOString().slice(0,10),amount:0,payment_method:'UPI/Bank - Customer Notification',reference_no:ref,notes:'Customer payment notification - Admin verification pending.',created_by:user.id});q('payMsg').textContent=error?'Payment notification save नहीं हुई: '+error.message:'Payment notification Admin को भेज दी गई है।';if(!error)await load()}"
new_req = "async function requestPayment(){if(!projects.length){q('payMsg').textContent='पहले project assign होना जरूरी है।';return}const list=projects.map((p,i)=>`${i+1}. ${p.project_name||'Project'}`).join('\\n');const pick=Number(prompt('किस Project का payment है?\\n\\n'+list));if(!Number.isInteger(pick)||pick<1||pick>projects.length)return;const p=projects[pick-1];const amount=Number(prompt(`\\"${p.project_name||'Project'}\\" के लिए कितनी payment की है?`));if(!Number.isFinite(amount)||amount<=0){q('payMsg').textContent='सही payment amount डालें।';return}const ref=prompt('Payment के बाद transaction/reference number डालें:');if(!ref)return;const{error}=await sb.from('payments').insert({project_id:p.id,payment_date:new Date().toISOString().slice(0,10),amount,payment_method:'UPI/Bank - Customer Notification',reference_no:ref.trim(),notes:'Customer payment notification - Admin verification pending.',status:'pending',created_by:user.id});q('payMsg').textContent=error?'Payment notification save नहीं हुई: '+error.message:'Payment Admin को भेज दी गई है। Admin approve करने के बाद ही Received दिखेगा।';if(!error)await load()}"
t = t.replace(old_req, new_req, 1)
c.write_text(t, encoding='utf-8')
print('payment flow deployment trigger prepared')