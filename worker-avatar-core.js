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
    try{const w=await s.from('workers').select('face_photo_url').eq('id',id).maybeSingle();if(w.data?.face_photo_url)return w.data.face_photo_url;}catch(e){}
    try{const r=await s.from('worker_face_registrations').select('photo_url').eq('worker_id',id).maybeSingle();if(r.data?.photo_url)return r.data.photo_url;}catch(e){}
    return '';
  }

  async function patchAvatars(){
    const cards=document.querySelectorAll('#workersList .workerCard');if(!cards.length)return;
    for(const card of cards){
      let id='';card.querySelectorAll('button').forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/editWorker\(['\"]([^'\"]+)['\"]\)/);if(m)id=m[1]});
      if(!id)continue;const url=await getPhoto(id);if(!url)continue;const av=card.querySelector('.avatar');if(!av)continue;
      if(av.querySelector('img')?.getAttribute('src')===url)continue;
      const img=document.createElement('img');img.src=url;img.alt='Worker Face';img.loading='lazy';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%;display:block';img.onerror=()=>{img.remove()};av.replaceChildren(img);
    }
  }

  async function patchCustomerProjects(){
    const tables=[...document.querySelectorAll('table')];
    const table=tables.find(t=>{const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase());return h.length>=6&&h.includes('photo')&&h.includes('name')&&h.includes('email')&&h.includes('phone')&&h.includes('address')&&h.includes('actions')&&!h.includes('project')});
    if(!table)return;
    const head=table.querySelector('thead tr');
    if(!head)return;
    const ths=[...head.children];
    const actionIndex=ths.findIndex(x=>x.textContent.trim().toLowerCase()==='actions');
    if(actionIndex<0)return;
    if(!head.querySelector('[data-customer-project-head]')){const th=document.createElement('th');th.textContent='Project';th.setAttribute('data-customer-project-head','1');head.insertBefore(th,head.children[actionIndex]);}
    const s=S();if(!s)return;
    let projects=[];
    try{const r=await s.from('projects').select('id,customer_id,project_name,work_type,status').order('created_at',{ascending:false});if(r.error){console.warn('customer project lookup',r.error);return}projects=r.data||[]}catch(e){console.warn('customer project lookup',e);return}
    const byCustomer={};projects.forEach(p=>{(byCustomer[String(p.customer_id)]??=[]).push(p)});
    const rows=[...table.querySelectorAll('tbody tr')];
    for(const row of rows){
      const cells=[...row.children];
      if(cells.length<6)continue;
      if(row.querySelector('[data-customer-project-cell]'))continue;
      let customerId='';
      row.querySelectorAll('button,a').forEach(el=>{const txt=(el.getAttribute('onclick')||'')+' '+(el.getAttribute('href')||'');const m=txt.match(/(?:customer|Customer)[^'\"()]*['\"]([0-9a-f-]{20,})['\"]/i)||txt.match(/(?:editCustomer|viewCustomer)\(['\"]([^'\"]+)['\"]\)/i);if(m)customerId=m[1]});
      const name=(cells[1]?.textContent||'').trim();
      const phone=(cells[3]?.textContent||'').replace(/\D/g,'');
      if(!customerId){try{const r=await s.from('customers').select('id').eq('phone',phone).limit(1).maybeSingle();if(r.data?.id)customerId=r.data.id;}catch(e){}}
      if(!customerId){try{const r=await s.from('customers').select('id').eq('name',name).limit(1).maybeSingle();if(r.data?.id)customerId=r.data.id;}catch(e){}}
      const ps=byCustomer[String(customerId)]||[];
      const td=document.createElement('td');td.setAttribute('data-customer-project-cell','1');
      if(!ps.length){td.textContent='—';row.insertBefore(td,row.children[actionIndex]);continue;}
      td.innerHTML=ps.map(p=>{const a=document.createElement('a');a.href='project-progress.html?project_id='+encodeURIComponent(p.id);a.textContent='🏗️ '+(p.project_name||p.work_type||'Project');a.title='Project Progress खोलें';a.style.cssText='display:block;color:#2563eb;font-weight:800;text-decoration:none;margin-bottom:5px';a.addEventListener('click',ev=>{ev.stopPropagation()});return a.outerHTML}).join('');
      row.insertBefore(td,row.children[actionIndex]);
    }
  }

  async function refresh(){await save();await patchAvatars();await patchCustomerProjects();}

  function wrap(){
    if(wrapped||typeof window.loadAll!=='function')return;
    const old=window.loadAll;
    window.loadAll=async function(){const r=await old.apply(this,arguments);setTimeout(patchAvatars,150);setTimeout(patchAvatars,800);setTimeout(patchAvatars,1800);setTimeout(patchCustomerProjects,250);setTimeout(patchCustomerProjects,1000);setTimeout(patchCustomerProjects,2200);return r;};
    wrapped=true;
  }

  const t=setInterval(()=>{if(!wrapped)wrap();else clearInterval(t)},300);setTimeout(()=>clearInterval(t),15000);
  document.addEventListener('click',e=>{if(e.target?.id==='workerFaceCapture'){setTimeout(refresh,1200);setTimeout(refresh,3000);setTimeout(patchAvatars,5000);}},true);
  setInterval(patchAvatars,5000);
  setInterval(patchCustomerProjects,5000);

  const enquiryScript=document.createElement('script');
  enquiryScript.src='enquiry-controls.js';
  enquiryScript.onload=()=>{};
  document.body.appendChild(enquiryScript);

  /* =========================================================
     MODERN BALAJI DASHBOARD UI — VISUAL ONLY
     No database/data/function changes.
  ========================================================= */
  const style=document.createElement('style');
  style.id='balaji-modern-dashboard-ui';
  style.textContent=`
    :root{
      --navy:#071426 !important;
      --navy2:#102a43 !important;
      --orange:#ff8a2a !important;
      --green:#16b364 !important;
      --red:#ef5b67 !important;
      --blue:#4f7cff !important;
      --bg:#f6f8fc !important;
      --text:#15233a !important;
      --muted:#718096 !important;
      --border:#e7ebf2 !important;
      --surface:rgba(255,255,255,.88);
      --shadow:0 18px 50px rgba(15,23,42,.08);
    }
    html{scroll-behavior:smooth}
    body{
      background:
        radial-gradient(circle at 8% 0%,rgba(255,138,42,.12),transparent 28%),
        radial-gradient(circle at 92% 8%,rgba(79,124,255,.12),transparent 30%),
        linear-gradient(135deg,#f8fafc 0%,#eef3f9 100%) !important;
      min-height:100vh;
    }
    .sidebar{
      width:278px !important;
      padding:24px 16px !important;
      background:linear-gradient(180deg,#071426 0%,#0b2037 55%,#102b45 100%) !important;
      box-shadow:14px 0 45px rgba(2,12,27,.16) !important;
      border-right:1px solid rgba(255,255,255,.07);
      transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s;
    }
    .brand{padding:4px 8px 20px;margin-bottom:18px !important}
    .logo{
      width:58px !important;height:58px !important;border-radius:18px !important;
      background:linear-gradient(135deg,#ffb14a,#ff7220) !important;
      box-shadow:0 12px 30px rgba(255,122,31,.28);
      transform:rotate(-2deg);
    }
    .brand h2{letter-spacing:.08em;font-size:20px !important}
    .brand small{color:#9fb2c7 !important}
    .nav{gap:8px !important}
    .nav button{
      position:relative;padding:13px 14px !important;border:1px solid transparent !important;
      border-radius:14px !important;color:#b9c8d8 !important;
      background:transparent !important;transition:transform .2s,background .2s,color .2s,box-shadow .2s;
    }
    .nav button:hover{transform:translateX(4px);background:rgba(255,255,255,.07) !important;color:#fff !important}
    .nav button.active{
      background:linear-gradient(135deg,rgba(255,138,42,.22),rgba(79,124,255,.16)) !important;
      border-color:rgba(255,255,255,.09) !important;color:#fff !important;
      box-shadow:inset 3px 0 0 #ff8a2a,0 10px 25px rgba(0,0,0,.12);
    }
    .navIcon{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:rgba(255,255,255,.07);font-size:15px;margin-right:9px;vertical-align:middle}
    .nav button.active .navIcon{background:rgba(255,138,42,.22)}
    .logout{margin-top:22px !important;border:1px solid rgba(255,255,255,.08) !important;background:rgba(255,255,255,.95) !important;box-shadow:0 10px 25px rgba(0,0,0,.12);transition:.2s}
    .logout:hover{transform:translateY(-2px);background:#fff !important}
    .main{margin-left:278px !important}
    .topbar{
      height:78px !important;padding:0 28px !important;background:rgba(255,255,255,.78) !important;
      backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
      border-bottom:1px solid rgba(226,232,240,.8) !important;box-shadow:0 8px 30px rgba(15,23,42,.04);
    }
    .topTitle h1{font-size:25px !important;font-weight:900;letter-spacing:-.02em}
    .mobileMenu{border:1px solid #e4e9f1 !important;background:#fff !important;box-shadow:0 6px 18px rgba(15,23,42,.07);transition:.2s}
    .mobileMenu:hover{transform:scale(1.04)}
    .adminBadge{background:#eaf9f0 !important;color:#15965a !important;border:1px solid #d4f1df}
    .userBox{gap:10px !important}
    .content{padding:30px !important;max-width:1540px !important}
    .globalSearch,.card,.stat,.projectCard,.workerCard,.updateCard{
      background:var(--surface) !important;border:1px solid rgba(226,232,240,.86) !important;
      box-shadow:var(--shadow) !important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    }
    .globalSearch{border-radius:20px !important;padding:18px 20px !important}
    .globalSearch input,.field input,.field select,.field textarea{background:rgba(255,255,255,.92) !important;border-color:#dfe5ee !important;transition:border-color .2s,box-shadow .2s,transform .2s}
    .globalSearch input:focus,.field input:focus,.field select:focus,.field textarea:focus{border-color:#ff9a4d !important;box-shadow:0 0 0 4px rgba(255,138,42,.10) !important}
    .sectionHead{margin-bottom:20px !important}
    .sectionHead h2{font-size:30px !important;letter-spacing:-.025em}
    .sectionHead p{color:#7b8798 !important}
    .stat{border-radius:20px !important;min-height:142px !important;position:relative;overflow:hidden;transition:transform .22s,box-shadow .22s}
    .stat:after{content:"";position:absolute;right:-30px;top:-35px;width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,rgba(255,138,42,.12),rgba(79,124,255,.05));pointer-events:none}
    .stat:hover{transform:translateY(-5px);box-shadow:0 22px 55px rgba(15,23,42,.12) !important}
    .statValue{font-size:34px !important;letter-spacing:-.03em}
    .btn{border-radius:11px !important;position:relative;overflow:hidden;transition:transform .18s,box-shadow .18s,filter .18s !important}
    .btn:hover{transform:translateY(-2px);filter:brightness(1.02);box-shadow:0 9px 22px rgba(15,23,42,.12)}
    .btn:active{transform:translateY(0) scale(.98)}
    .btn-primary{background:linear-gradient(135deg,#ff9a3c,#ff7621) !important;box-shadow:0 8px 20px rgba(255,122,31,.2)}
    .btn-green{background:linear-gradient(135deg,#1ab86a,#109b58) !important}
    .btn-blue{background:#edf2ff !important;color:#355fd4 !important}
    .btn-red{background:#fff0f1 !important;color:#d94855 !important}
    .btn-dark{background:linear-gradient(135deg,#132b45,#0b1f34) !important}
    .tableWrap{border-radius:18px}
    table{min-width:820px !important}
    th{background:linear-gradient(180deg,#f7f9fc,#eef2f7) !important;border-bottom:1px solid #e3e8ef;color:#66758a !important;letter-spacing:.05em}
    td{background:rgba(255,255,255,.48);transition:background .18s}
    tbody tr:hover td{background:rgba(248,250,252,.95)}
    .status{box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)}
    .progressBar{height:11px !important;background:#e8edf4 !important;box-shadow:inset 0 1px 3px rgba(15,23,42,.08)}
    .progressFill{background:linear-gradient(90deg,#ff8a2a,#ffb04a) !important;box-shadow:0 3px 12px rgba(255,138,42,.25);transition:width .7s cubic-bezier(.2,.8,.2,1)}
    .projectCard,.workerCard,.updateCard{border-radius:20px !important;transition:transform .22s,box-shadow .22s}
    .projectCard:hover,.workerCard:hover,.updateCard:hover{transform:translateY(-4px);box-shadow:0 25px 60px rgba(15,23,42,.12) !important}
    .money{border:1px solid #edf0f4}
    .avatar{box-shadow:0 8px 20px rgba(255,138,42,.18);border:3px solid #fff}
    .modal{background:rgba(4,14,27,.68) !important;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
    .modalBox{border:1px solid #e6eaf0 !important;border-radius:24px !important;box-shadow:0 30px 90px rgba(0,0,0,.22) !important;animation:balajiModalIn .28s cubic-bezier(.2,.8,.2,1)}
    .close{transition:.2s !important}.close:hover{transform:rotate(90deg);background:#fff0f1 !important;color:#d94855}
    #toast{border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(12px);animation:balajiToastIn .3s ease both}
    .loading{animation:balajiPulse 1.3s ease-in-out infinite alternate}
    @keyframes balajiModalIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
    @keyframes balajiToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    @keyframes balajiPulse{from{opacity:.45}to{opacity:1}}
    @media(max-width:1100px){
      .sidebar{width:260px !important}.main{margin-left:260px !important}.content{padding:22px !important}.grid4{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
    }
    @media(max-width:1000px){
      .sidebar{width:280px !important;transform:translateX(-105%);box-shadow:none}
      .sidebar.open{transform:translateX(0);box-shadow:20px 0 60px rgba(2,12,27,.28)}
      .main{margin-left:0 !important}
      .topbar{padding:0 16px !important}
      .content{padding:18px 14px 28px !important}
      .mobileMenu{display:grid !important;place-items:center;width:42px;height:42px;padding:0 !important}
      body:has(.sidebar.open):after{content:"";position:fixed;inset:0;background:rgba(2,12,27,.38);z-index:90;backdrop-filter:blur(2px)}
      .sidebar{z-index:100}
      .topbar{z-index:80}
      .content{position:relative;z-index:1}
    }
    @media(max-width:720px){
      .topbar{height:68px !important}.topTitle{gap:8px}.topTitle h1{font-size:18px !important}
      .userBox{display:none !important}.content{padding:14px 10px 24px !important}
      .globalSearch{padding:15px !important;border-radius:16px !important}
      .sectionHead h2{font-size:24px !important}
      .grid2,.grid3,.grid4{grid-template-columns:1fr !important}
      .card,.projectCard,.workerCard,.updateCard{padding:16px !important;border-radius:17px !important}
      .projectTop{flex-direction:column !important}.moneyGrid{grid-template-columns:1fr !important}
      .formGrid{grid-template-columns:1fr !important}.field.full{grid-column:auto !important}
      .modal{padding:10px !important}.modalBox{margin:8px auto !important;padding:17px !important;border-radius:19px !important}
      .modalHead h3{font-size:20px !important}.modalActions{flex-direction:column-reverse !important}.modalActions .btn{width:100% !important}
      .actions{gap:6px}.actions .btn{flex:1 1 auto;min-height:40px}
      .tableWrap{overflow-x:auto;-webkit-overflow-scrolling:touch;box-shadow:inset -12px 0 18px -18px rgba(15,23,42,.45)}
      table{min-width:760px !important}
      #toast{left:10px;right:10px;bottom:10px;max-width:none;text-align:center}
    }
    @media(max-width:420px){
      .sidebar{width:88vw !important;max-width:310px}.brand{padding-left:4px}.nav button{padding:12px !important}
      .sectionHead{gap:10px !important}.btn{padding:10px 12px !important}
      .topTitle h1{font-size:16px !important}
    }
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto !important;animation:none !important;transition:none !important}}
  `;
  document.head.appendChild(style);

  const modernizeNav=()=>{
    const icons={overview:'▦',projects:'▰',customers:'♟',enquiries:'✉',workers:'♙',payments:'₹',updates:'◷'};
    document.querySelectorAll('.nav button[data-page]').forEach(btn=>{
      const page=btn.dataset.page;
      const labels={overview:'Overview',projects:'Projects',customers:'Customers',enquiries:'Customer Enquiries',workers:'Workers',payments:'Payments',updates:'Daily Update'};
      if(!btn.dataset.modernized){
        btn.innerHTML=`<span class="navIcon">${icons[page]||'•'}</span><span>${labels[page]||page}</span>`;
        btn.dataset.modernized='1';
      }
    });
  };
  modernizeNav();
  setTimeout(modernizeNav,500);
  setTimeout(modernizeNav,1500);
})();
