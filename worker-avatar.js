/* BALAJI Construction — worker face photo -> avatar bridge. No Worker Add/Save/Face/Attendance UI changes. */
(()=>{
  'use strict';
  let pendingPhoto=null,pendingId='',pendingName='',pendingPhone='',wrapped=false;
  const S=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch(e){return window.sb||null}};
  const snap=()=>{const v=document.getElementById('workerFaceVideo');if(!v||!v.videoWidth||!v.videoHeight)return null;const c=document.createElement('canvas'),scale=Math.min(1,640/v.videoWidth);c.width=Math.max(1,Math.round(v.videoWidth*scale));c.height=Math.max(1,Math.round(v.videoHeight*scale));const x=c.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78)};

  document.addEventListener('click',e=>{
    if(e.target?.id!=='workerFaceCapture')return;
    const p=snap();
    if(p){
      pendingPhoto=p;
      pendingId=document.getElementById('workerId')?.value||'';
      pendingName=document.getElementById('workerName')?.value?.trim()||'';
      pendingPhone=(document.getElementById('workerMobile')?.value||'').replace(/\D/g,'');
    }
  },true);

  async function findWorker(s){
    try{
      if(pendingId){const r=await s.from('workers').select('id').eq('id',pendingId).maybeSingle();if(r.data?.id)return r.data;}
      if(pendingPhone){const r=await s.from('workers').select('id').eq('phone',pendingPhone).order('created_at',{ascending:false}).limit(1).maybeSingle();if(r.data?.id)return r.data;}
      if(pendingName){const r=await s.from('workers').select('id').eq('name',pendingName).order('created_at',{ascending:false}).limit(1).maybeSingle();if(r.data?.id)return r.data;}
    }catch(e){console.warn('worker lookup',e)}
    return null;
  }

  async function save(){
    if(!pendingPhoto)return false;
    const s=S();if(!s)return false;
    try{
      const w=await findWorker(s);if(!w?.id)return false;
      let ok=false;const now=new Date().toISOString();
      const r1=await s.from('worker_face_registrations').upsert({worker_id:w.id,photo_url:pendingPhoto,registered_at:now,updated_at:now},{onConflict:'worker_id'});
      if(!r1.error)ok=true;else console.warn('face registration photo save',r1.error);
      const r2=await s.from('workers').update({face_photo_url:pendingPhoto}).eq('id',w.id);
      if(!r2.error)ok=true;else console.warn('worker face_photo_url save',r2.error);
      pendingPhoto=null;pendingId='';pendingName='';pendingPhone='';return ok;
    }catch(e){console.warn('worker avatar save',e);return false}
  }

  async function getPhoto(id){
    const s=S();if(!s||!id)return '';
    try{const w=await s.from('workers').select('face_photo_url').eq('id',id).maybeSingle();if(w.data?.face_photo_url)return w.data.face_photo_url}catch(e){}
    try{const r=await s.from('worker_face_registrations').select('photo_url').eq('worker_id',id).maybeSingle();if(r.data?.photo_url)return r.data.photo_url}catch(e){}
    return '';
  }

  async function patchAvatars(){
    const cards=document.querySelectorAll('#workersList .workerCard');if(!cards.length)return;
    for(const card of cards){
      let id='';card.querySelectorAll('button').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/editWorker\(['"]([^'"]+)['"]\)/);if(m)id=m[1]});
      if(!id)continue;const url=await getPhoto(id);if(!url)continue;const av=card.querySelector('.avatar');if(!av)continue;
      if(av.querySelector('img')?.getAttribute('src')===url)continue;const img=document.createElement('img');img.src=url;img.alt='Worker Face';img.loading='lazy';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%;display:block';img.onerror=()=>{img.remove()};av.replaceChildren(img);
    }
  }

  /* Project progress viewer only. Worker functions and Daily Update editor are untouched. */
  function ensureProjectProgressView(){
    if(document.getElementById('projectProgressViewModal'))return;
    const modal=document.createElement('div');modal.className='modal';modal.id='projectProgressViewModal';
    modal.innerHTML=`<div class="modalBox" style="max-width:850px"><div class="modalHead"><h3 id="projectProgressViewTitle">📊 Project Progress</h3><button class="close" type="button" id="projectProgressViewClose">×</button></div><div id="projectProgressViewBody"></div></div>`;
    document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('show')});document.getElementById('projectProgressViewClose').addEventListener('click',()=>modal.classList.remove('show'));
  }

  function projectDate(value){if(!value)return '—';try{return new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}catch(e){return String(value)}}

  function patchProjectProgressButtons(){
    if(!document.getElementById('projectsList')&&!document.getElementById('overviewProjects'))return;
    ['#projectsList','#overviewProjects'].forEach(selector=>document.querySelectorAll(`${selector} .projectCard button`).forEach(button=>{
      const onclick=button.getAttribute('onclick')||'';const m=onclick.match(/openProgressModal\(['"]([^'"]+)['"]\)/);if(!m)return;
      button.setAttribute('onclick',`openProjectProgressView('${m[1]}')`);button.textContent='📊 Show Progress';button.title='Project की progress, updates और photos देखें';
    }));
  }

  window.openProjectProgressView=function(projectId){
    try{
      const p=typeof getProject==='function'?getProject(projectId):null;if(!p)return;ensureProjectProgressView();
      const allUpdates=(typeof projectUpdates!=='undefined'&&Array.isArray(projectUpdates))?projectUpdates:[];
      const updates=allUpdates.filter(u=>String(u.project_id)===String(projectId)).sort((a,b)=>new Date(b.update_date||b.created_at||0)-new Date(a.update_date||a.created_at||0));
      const progress=typeof projectProgress==='function'?projectProgress(projectId):0;
      const customer=typeof getCustomer==='function'?getCustomer(p.customer_id):null;const customerName=p.customer_name||customer?.name||customer?.customer_name||'—';
      const title=document.getElementById('projectProgressViewTitle'),body=document.getElementById('projectProgressViewBody');if(title)title.textContent=`📊 ${p.project_name||'Project'} — Progress`;
      const latest=updates[0];
      body.innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px"><div style="background:#fff7ed;border-radius:14px;padding:16px"><div style="color:#60738a;font-weight:800">Current Progress</div><strong style="display:block;font-size:30px;color:#ff7f1f;margin-top:7px">${progress}%</strong></div><div style="background:#f8fafc;border-radius:14px;padding:16px"><div style="color:#60738a;font-weight:800">Status</div><strong style="display:block;font-size:20px;margin-top:10px">${esc(p.status||'—')}</strong></div><div style="background:#f8fafc;border-radius:14px;padding:16px"><div style="color:#60738a;font-weight:800">Total Updates</div><strong style="display:block;font-size:30px;margin-top:7px">${updates.length}</strong></div></div>
      <div style="background:#f8fafc;border-radius:14px;padding:15px;margin-bottom:18px"><div><strong>👤 Customer:</strong> ${esc(customerName)}</div><div style="margin-top:6px"><strong>📍 Location:</strong> ${esc(p.location||'—')}</div><div style="margin-top:6px"><strong>🛠️ Work:</strong> ${esc(p.work_type||'—')}</div>${p.start_date||p.end_date?`<div style="margin-top:6px"><strong>📅 अवधि:</strong> ${esc(projectDate(p.start_date))} — ${esc(projectDate(p.end_date))}</div>`:''}</div>
      ${latest?`<div style="border:1px solid #e3e9f0;border-radius:16px;padding:17px;margin-bottom:18px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><strong style="font-size:18px">Latest Update</strong><span class="status ongoing">${clampProgress(latest.progress_percent)}%</span></div><div style="color:#60738a;margin-top:6px">${esc(projectDate(latest.update_date||latest.created_at))}</div><h4 style="margin:12px 0 7px">${esc(latest.title||'Progress Update')}</h4><div style="white-space:pre-wrap;line-height:1.55">${esc(latest.details||'कोई विवरण नहीं')}</div>${latest.photo_url?`<img src="${esc(latest.photo_url)}" alt="Progress Photo" style="width:100%;max-height:360px;object-fit:cover;border-radius:13px;margin-top:14px" onerror="this.style.display='none'">`:''}</div>`:''}
      <div><h4 style="margin:0 0 12px">📜 Progress History</h4>${updates.length?updates.map(u=>`<div style="border:1px solid #e3e9f0;border-radius:14px;padding:14px;margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px"><strong>${esc(u.title||'Progress Update')}</strong><strong style="color:#ff7f1f">${clampProgress(u.progress_percent)}%</strong></div><div style="font-size:13px;color:#60738a;margin-top:5px">${esc(projectDate(u.update_date||u.created_at))}</div>${u.details?`<div style="margin-top:9px;white-space:pre-wrap;line-height:1.5">${esc(u.details)}</div>`:''}${u.photo_url?`<img src="${esc(u.photo_url)}" alt="Progress Photo" style="width:100%;max-height:280px;object-fit:cover;border-radius:11px;margin-top:10px" onerror="this.style.display='none'">`:''}</div>`).join(''):'<div class="empty">अभी कोई progress update save नहीं हुई है।</div>'}</div>`;
      document.getElementById('projectProgressViewModal').classList.add('show');
    }catch(e){console.warn('project progress view',e)}
  };

  async function refresh(){await save();await patchAvatars()}

  function wrap(){
    if(wrapped||typeof window.loadAll!=='function')return;const old=window.loadAll;
    window.loadAll=async function(){const r=await old.apply(this,arguments);setTimeout(patchAvatars,150);setTimeout(patchAvatars,800);setTimeout(patchAvatars,1800);setTimeout(patchProjectProgressButtons,200);setTimeout(patchProjectProgressButtons,900);setTimeout(patchProjectProgressButtons,1900);return r};wrapped=true;
  }

  const t=setInterval(()=>{if(!wrapped)wrap();else clearInterval(t)},300);setTimeout(()=>clearInterval(t),15000);
  document.addEventListener('click',e=>{if(e.target?.id==='workerFaceCapture'){setTimeout(refresh,1200);setTimeout(refresh,3000);setTimeout(patchAvatars,5000)}},true);
  setInterval(patchAvatars,5000);setInterval(patchProjectProgressButtons,3000);
})();

/* BALAJI — Customer Records: show each customer's projects and open project progress. */
(()=>{
  'use strict';
  let ready=false;

  const getData=()=>({
    customers:(typeof window.customers!=='undefined'?window.customers:[]),
    projects:(typeof window.projects!=='undefined'?window.projects:[]),
    updates:(typeof window.projectUpdates!=='undefined'?window.projectUpdates:[])
  });

  function progressFor(id,updates){
    const list=(updates||[]).filter(u=>String(u.project_id)===String(id)).sort((a,b)=>new Date(b.update_date||b.created_at||0)-new Date(a.update_date||a.created_at||0));
    return Math.max(0,Math.min(100,Number(list[0]?.progress_percent||0)));
  }

  function addProjectStyles(){
    if(document.getElementById('customerProjectStyles'))return;
    const s=document.createElement('style');s.id='customerProjectStyles';s.textContent=`
      .customerProjects{display:flex;flex-direction:column;gap:7px;min-width:220px}
      .customerProjectBtn{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 10px;border:1px solid #e3e9f0;border-radius:10px;background:#f8fafc;color:#17304a;text-align:left;font-weight:800;cursor:pointer}
      .customerProjectBtn:hover{border-color:#ff7f1f;background:#fff7ed}
      .customerProjectBtn small{font-weight:900;color:#ff7f1f;white-space:nowrap}
      .customerProjectEmpty{color:#94a3b8;font-size:13px}
    `;document.head.appendChild(s);
  }

  function patchHeader(){
    const table=document.getElementById('customersTable')?.closest('table');if(!table)return;
    const head=table.querySelector('thead tr');if(!head)return;
    if(!head.querySelector('[data-customer-projects-head]')){
      const th=document.createElement('th');th.textContent='Projects';th.setAttribute('data-customer-projects-head','1');head.insertBefore(th,head.lastElementChild);
    }
  }

  function patchRows(){
    const tbody=document.getElementById('customersTable');if(!tbody)return;
    const table=tbody.closest('table');if(!table)return;
    patchHeader();addProjectStyles();
    const {customers,projects,updates}=getData();
    tbody.querySelectorAll('tr').forEach(row=>{
      const action=row.lastElementChild;if(!action||!row.children.length)return;
      if(row.querySelector('[data-customer-projects-cell]'))return;
      const edit=action.querySelector('[onclick*="editCustomer"]');
      const idMatch=(edit?.getAttribute('onclick')||'').match(/editCustomer\(['"]([^'"]+)['"]\)/);
      if(!idMatch)return;
      const customerId=idMatch[1];
      const customer=customers.find(c=>String(c.id)===String(customerId));
      if(!customer)return;
      const linked=projects.filter(p=>String(p.customer_id)===String(customer.id));
      const td=document.createElement('td');td.setAttribute('data-customer-projects-cell','1');
      if(!linked.length){td.innerHTML='<div class="customerProjectEmpty">कोई Project नहीं</div>'}
      else{
        const wrap=document.createElement('div');wrap.className='customerProjects';
        linked.forEach(p=>{
          const b=document.createElement('button');b.type='button';b.className='customerProjectBtn';
          const name=document.createElement('span');name.textContent=p.project_name||'Project';
          const pr=document.createElement('small');pr.textContent=progressFor(p.id,updates)+'%';
          b.append(name,pr);b.title='Project की progress देखें';
          b.addEventListener('click',()=>{
            if(typeof window.openProjectProgressView==='function')window.openProjectProgressView(p.id);
            else if(typeof window.openProgressModal==='function')window.openProgressModal(p.id);
          });
          wrap.appendChild(b);
        });
        td.appendChild(wrap);
      }
      row.insertBefore(td,action);
    });
  }

  function run(){
    patchRows();
  }

  function wrapLoad(){
    if(ready||typeof window.loadAll!=='function')return;
    const old=window.loadAll;
    window.loadAll=async function(){const r=await old.apply(this,arguments);setTimeout(run,100);setTimeout(run,700);setTimeout(run,1600);return r};
    ready=true;
  }

  const timer=setInterval(()=>{wrapLoad();run();if(ready)clearInterval(timer)},300);
  setTimeout(()=>clearInterval(timer),15000);
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="customers"]')){setTimeout(run,150);setTimeout(run,700)}});
  setInterval(()=>{if(document.getElementById('page-customers')?.classList.contains('active'))run()},2500);
})();

/* Customer Records project column patch. Existing worker code untouched. */
(()=>{
  const S=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch(e){return null}};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const progress=(id,u)=>{const x=(u||[]).filter(a=>String(a.project_id)===String(id)).sort((a,b)=>new Date(b.update_date||b.created_at||0)-new Date(a.update_date||a.created_at||0))[0];return Math.max(0,Math.min(100,Number(x?.progress_percent??x?.progress??0)||0))};
  async function patch(){const tb=document.getElementById('customersTable'),s=S();if(!tb||!s)return;const t=tb.closest('table'),h=t?.querySelector('thead tr');if(!t||!h)return;if(!h.querySelector('[data-project-head]')){const th=document.createElement('th');th.textContent='Projects';th.dataset.projectHead='1';h.insertBefore(th,h.lastElementChild)}const [a,b]=await Promise.all([s.from('projects').select('*'),s.from('project_updates').select('*')]);if(a.error)return;tb.querySelectorAll('tr').forEach(r=>{r.querySelector('[data-project-cell]')?.remove();const act=r.lastElementChild,e=act?.querySelector('[onclick*="editCustomer"]'),m=(e?.getAttribute('onclick')||'').match(/editCustomer\(['"]([^'"]+)['"]\)/);if(!m)return;const ps=(a.data||[]).filter(p=>String(p.customer_id)===String(m[1])),td=document.createElement('td');td.dataset.projectCell='1';const w=document.createElement('div');w.style.cssText='display:flex;flex-direction:column;gap:7px;min-width:210px';ps.forEach(p=>{const q=document.createElement('button');q.type='button';q.textContent='🏗️ '+(p.project_name||'Project')+'   '+progress(p.id,b.data)+'%';q.style.cssText='padding:8px 10px;border:1px solid #e3e9f0;border-radius:10px;background:#f8fafc;color:#17304a;font-weight:800;text-align:left;cursor:pointer';q.onclick=()=>{if(typeof window.openProjectProgressView==='function')window.openProjectProgressView(p.id);else if(typeof window.openProgressModal==='function')window.openProgressModal(p.id)};w.appendChild(q)});td.appendChild(w);r.insertBefore(td,act)})}
  setInterval(()=>{if(document.getElementById('page-customers')?.classList.contains('active'))patch()},2500);setTimeout(patch,1000);
})();
