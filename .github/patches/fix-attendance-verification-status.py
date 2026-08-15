from pathlib import Path

p = Path('dashboard.html')
s = p.read_text(encoding='utf-8')
old = "verification_status:'approved',verification_method:'face_recognition'"
new = "verification_status:'verified',verification_method:'face_recognition'"
if old in s:
    s = s.replace(old, new)
old2 = "verification_status:'rejected',updated_at"
new2 = "verification_status:'failed',updated_at"
if old2 in s:
    s = s.replace(old2, new2)

marker = "/* BALAJI CUSTOMER COLUMNS NORMALIZER */"
if marker not in s:
    s += r'''

<script>
/* BALAJI CUSTOMER COLUMNS NORMALIZER */
(()=>{
  'use strict';
  function normalizeCustomerColumns(){
    const tb=document.getElementById('customersTable');
    const table=tb?.closest('table');
    if(!tb||!table)return;
    const head=table.querySelector('thead tr');
    if(head){
      const projects=[...head.children].filter(x=>x.textContent.trim().toLowerCase()==='projects');
      projects.slice(1).forEach(x=>x.remove());
      const actions=[...head.children].filter(x=>x.textContent.trim().toLowerCase()==='actions');
      if(actions.length){
        actions.slice(1).forEach(x=>x.remove());
        head.appendChild(actions[0]);
      }
    }
    tb.querySelectorAll('tr').forEach(row=>{
      const action=[...row.children].find(td=>td.querySelector('[onclick*="editCustomer"],[onclick*="deleteCustomer"]'));
      if(!action)return;
      const candidates=[...row.children].filter(td=>td.hasAttribute('data-customer-projects-cell')||td.hasAttribute('data-project-cell'));
      let project=candidates.find(td=>td.querySelector('button'))||candidates.find(td=>td.textContent.trim())||candidates[0];
      if(!project){
        const heads=[...table.querySelectorAll('thead tr th')];
        const pi=heads.findIndex(th=>th.textContent.trim().toLowerCase()==='projects');
        if(pi>=0)project=row.children[pi];
      }
      candidates.filter(td=>td!==project).forEach(td=>td.remove());
      if(project&&project!==action)row.insertBefore(project,action);
      if(action!==row.lastElementChild)row.appendChild(action);
    });
  }
  normalizeCustomerColumns();
  setTimeout(normalizeCustomerColumns,300);
  setTimeout(normalizeCustomerColumns,1000);
  setInterval(normalizeCustomerColumns,2500);
})();
</script>
'''

p.write_text(s, encoding='utf-8')
print('attendance verification and customer columns fixed')
