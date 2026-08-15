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
      if(pendingPhone){
        const r=await s.from('workers').select('id').eq('phone',pendingPhone).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(r.data?.id)return r.data;
      }
      if(pendingName){
        const r=await s.from('workers').select('id').eq('name',pendingName).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(r.data?.id)return r.data;
      }
    }catch(e){console.warn('worker lookup',e)}
    return null;
  }

  async function save(){
    if(!pendingPhoto)return false;
    const s=S();if(!s)return false;
    try{
      const w=await findWorker(s);
      if(!w?.id)return false;
      let ok=false;
      const now=new Date().toISOString();
      const r1=await s.from('worker_face_registrations').upsert({worker_id:w.id,photo_url:pendingPhoto,registered_at:now,updated_at:now},{onConflict:'worker_id'});
      if(!r1.error)ok=true;else console.warn('face registration photo save',r1.error);
      const r2=await s.from('workers').update({face_photo_url:pendingPhoto}).eq('id',w.id);
      if(!r2.error)ok=true;else console.warn('worker face_photo_url save',r2.error);
      pendingPhoto=null;pendingId='';pendingName='';pendingPhone='';
      return ok;
    }catch(e){console.warn('worker avatar save',e);return false}
  }

  async function getPhoto(id){
    const s=S();if(!s||!id)return '';
    try{
      const w=await s.from('workers').select('face_photo_url').eq('id',id).maybeSingle();
      if(w.data?.face_photo_url)return w.data.face_photo_url;
    }catch(e){}
    try{
      const r=await s.from('worker_face_registrations').select('photo_url').eq('worker_id',id).maybeSingle();
      if(r.data?.photo_url)return r.data.photo_url;
    }catch(e){}
    return '';
  }

  async function patchAvatars(){
    const cards=document.querySelectorAll('#workersList .workerCard');
    if(!cards.length)return;
    for(const card of cards){
      let id='';
      card.querySelectorAll('button').forEach(b=>{
        const m=(b.getAttribute('onclick')||'').match(/editWorker\(['"]([^'"]+)['"]\)/);
        if(m)id=m[1];
      });
      if(!id)continue;
      const url=await getPhoto(id);
      if(!url)continue;
      const av=card.querySelector('.avatar');
      if(!av)continue;
      if(av.querySelector('img')?.getAttribute('src')===url)continue;
      const img=document.createElement('img');
      img.src=url;img.alt='Worker Face';img.loading='lazy';
      img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%;display:block';
      img.onerror=()=>{img.remove()};
      av.replaceChildren(img);
    }
  }

  async function refresh(){
    await save();
    await patchAvatars();
  }

  function wrap(){
    if(wrapped||typeof window.loadAll!=='function')return;
    const old=window.loadAll;
    window.loadAll=async function(){
      const r=await old.apply(this,arguments);
      setTimeout(patchAvatars,150);
      setTimeout(patchAvatars,800);
      setTimeout(patchAvatars,1800);
      return r;
    };
    wrapped=true;
  }

  const t=setInterval(()=>{if(!wrapped)wrap();else clearInterval(t)},300);
  setTimeout(()=>clearInterval(t),15000);

  document.addEventListener('click',e=>{
    if(e.target?.id==='workerFaceCapture'){
      setTimeout(refresh,1200);
      setTimeout(refresh,3000);
      setTimeout(patchAvatars,5000);
    }
  },true);

  setInterval(patchAvatars,5000);
})();
