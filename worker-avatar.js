/* BALAJI Construction — worker face photo bridge. No Worker Add/Save/Face/Attendance UI changes. */
(()=>{
  'use strict';
  let pendingPhoto=null,pendingId='',pendingName='',pendingPhone='',wrapped=false;
  const S=()=>{try{return typeof sb!=='undefined'?sb:(window.sb||null)}catch(e){return window.sb||null}};
  const snap=()=>{const v=document.getElementById('workerFaceVideo');if(!v||!v.videoWidth||!v.videoHeight)return null;const c=document.createElement('canvas'),scale=Math.min(1,640/v.videoWidth);c.width=Math.max(1,Math.round(v.videoWidth*scale));c.height=Math.max(1,Math.round(v.videoHeight*scale));const x=c.getContext('2d');x.translate(c.width,0);x.scale(-1,1);x.drawImage(v,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78)};
  document.addEventListener('click',e=>{
    if(e.target?.id!=='workerFaceCapture')return;
    const p=snap();
    if(p){pendingPhoto=p;pendingId=document.getElementById('workerId')?.value||'';pendingName=document.getElementById('workerName')?.value?.trim()||'';pendingPhone=(document.getElementById('workerMobile')?.value||'').replace(/\D/g,'')}
  },true);
  async function save(){
    if(!pendingPhoto)return false;
    const s=S();if(!s)return false;
    try{
      let w=null;
      if(pendingId)w=(await s.from('workers').select('id').eq('id',pendingId).maybeSingle()).data;
      else if(pendingPhone)w=(await s.from('workers').select('id').eq('phone',pendingPhone).order('created_at',{ascending:false}).limit(1).maybeSingle()).data;
      else if(pendingName)w=(await s.from('workers').select('id').eq('name',pendingName).order('created_at',{ascending:false}).limit(1).maybeSingle()).data;
      if(!w?.id)return false;
      let ok=false;
      const r1=await s.from('worker_face_registrations').upsert({worker_id:w.id,photo_url:pendingPhoto,registered_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'worker_id'});
      if(!r1.error)ok=true;else console.warn('worker face registration photo save',r1.error);
      const r2=await s.from('workers').update({face_photo_url:pendingPhoto}).eq('id',w.id);
      if(!r2.error)ok=true;else console.warn('worker face_photo_url save',r2.error);
      pendingPhoto=null;pendingId='';pendingName='';pendingPhone='';
      return ok;
    }catch(e){console.warn('worker avatar bridge',e);return false}
  }
  async function wrap(){
    if(wrapped||typeof window.loadAll!=='function')return;
    const old=window.loadAll;
    const f=async function(){
      await old.apply(this,arguments);
      const saved=await save();
      if(saved)await old.apply(this,arguments);
      else patchAvatars();
    };
    f.__workerAvatarWrapped=true;window.loadAll=f;wrapped=true;
  }
  function patchAvatars(){
    document.querySelectorAll('#workersList .workerCard').forEach(card=>{
      const buttons=card.querySelectorAll('button');
      let id='';
      buttons.forEach(b=>{const m=(b.getAttribute('onclick')||'').match(/editWorker\('([^']+)'\)/);if(m)id=m[1]});
      if(!id)return;
      const s=S();if(!s)return;
      s.from('workers').select('id,face_photo_url').eq('id',id).maybeSingle().then(r=>{
        const url=r.data?.face_photo_url;if(!url)return;
        const av=card.querySelector('.avatar');if(!av)return;
        av.innerHTML='<img src="'+String(url).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" alt="Worker Face" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">';
      }).catch(()=>{});
    });
  }
  const t=setInterval(()=>{if(!wrapped)wrap();else{clearInterval(t);patchAvatars()}},300);
  setTimeout(()=>clearInterval(t),15000);
})();
