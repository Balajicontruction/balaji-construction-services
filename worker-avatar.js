/* BALAJI — compatibility loader for the existing worker-avatar.js plus Customer Enquiry controls. */
(function(){
  'use strict';

  function loadOriginal(done){
    var s=document.createElement('script');
    s.src='worker-avatar-original.js';
    s.onload=done;
    s.onerror=function(){console.warn('worker-avatar-original.js could not load');done();};
    document.body.appendChild(s);
  }

  function installEnquiryPatch(){
    function status(v){
      v=String(v||'pending').toLowerCase().trim();
      if(v==='approved'||v==='approve'||v==='accepted'||v==='accept')return 'approved';
      if(v==='cancelled'||v==='canceled'||v==='cancel'||v==='rejected'||v==='reject')return 'cancelled';
      return 'pending';
    }
    function label(v){return v==='approved'?'Approved':v==='cancelled'?'Cancelled':'Pending';}
    function customerFor(e){
      var uid=String(e&&e.customer_user_id||'');
      var list=(typeof customers!=='undefined'&&Array.isArray(customers))?customers:[];
      var customer=list.find(function(c){return String(c.user_id||'')===uid;})||{};
      var profiles=(typeof profileMap!=='undefined'&&profileMap)?profileMap:{};
      var profile=profiles[uid]||{};
      return {customer:customer,profile:profile};
    }
    function safe(v){
      if(typeof window.esc==='function')return window.esc(v);
      return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});
    }

    window.renderEnquiries=function(){
      var tbody=document.getElementById('enquiriesTable');
      if(!tbody)return;
      var list=(typeof enquiries!=='undefined'&&Array.isArray(enquiries))?enquiries:[];
      if(!list.length){
        tbody.innerHTML='<tr><td colspan="5"><div class="empty">अभी कोई enquiry नहीं मिली।</div></td></tr>';
        return;
      }
      tbody.innerHTML=list.map(function(e){
        var cp=customerFor(e),c=cp.customer,p=cp.profile;
        var name=e.name||e.customer_name||e.full_name||p.full_name||c.name||'—';
        var phone=e.phone||e.mobile||p.phone||c.phone||'—';
        var message=e.message||e.details||e.enquiry||'—';
        var st=status(e.status);
        var cls=st==='approved'?'completed':st==='cancelled'?'cancelled':'pending';
        return '<tr>'+
          '<td><strong>'+safe(name)+'</strong></td>'+
          '<td>'+safe(phone)+'</td>'+\
          '<td style="max-width:360px;white-space:pre-wrap">'+safe(message)+'</td>'+\
          '<td><div class="actions">'+
            '<button class="btn btn-green btn-sm" onclick="updateEnquiryStatus(\''+safe(e.id)+'\',\'approved\')">Approve</button>'+\
            '<button class="btn btn-red btn-sm" onclick="updateEnquiryStatus(\''+safe(e.id)+'\',\'cancelled\')">Cancel</button>'+\
            '<button class="btn btn-light btn-sm" onclick="updateEnquiryStatus(\''+safe(e.id)+'\',\'pending\')">Pending</button>'+\
          '</div><div style="margin-top:7px"><span class="status '+cls+'">'+label(st)+'</span></div></td>'+\
          '<td><div class="actions">'+\
            '<button class="btn btn-blue btn-sm" onclick="editEnquiry(\''+safe(e.id)+'\')">✏️ Edit</button>'+\
            '<button class="btn btn-red btn-sm" onclick="deleteEnquiry(\''+safe(e.id)+'\')">🗑️ Delete</button>'+\
          '</div></td>'+\
        '</tr>';
      }).join('');
    };

    window.updateEnquiryStatus=async function(id,next){
      next=status(next);
      var client=(typeof sb!=='undefined'?sb:window.sb);
      if(!client){if(typeof toast==='function')toast('❌ Supabase उपलब्ध नहीं है');return;}
      var r=await client.from('customer_enquiries').update({status:next}).eq('id',id);
      if(r.error){if(typeof toast==='function')toast('❌ Status update नहीं हुआ: '+r.error.message);return;}
      if(typeof toast==='function')toast('✅ Status: '+label(next));
      if(typeof window.loadAll==='function')await window.loadAll();else window.renderEnquiries();
    };

    window.editEnquiry=async function(id){
      var list=(typeof enquiries!=='undefined'&&Array.isArray(enquiries))?enquiries:[];
      var e=list.find(function(x){return String(x.id)===String(id);});
      if(!e)return;
      var old=e.details||e.message||e.enquiry||'';
      var message=prompt('Enquiry Message edit करें:',old);
      if(message===null)return;
      var client=(typeof sb!=='undefined'?sb:window.sb);
      var r=await client.from('customer_enquiries').update({details:message.trim()}).eq('id',id);
      if(r.error){if(typeof toast==='function')toast('❌ Enquiry edit नहीं हुई: '+r.error.message);return;}
      if(typeof toast==='function')toast('✅ Enquiry updated');
      if(typeof window.loadAll==='function')await window.loadAll();else window.renderEnquiries();
    };

    window.deleteEnquiry=async function(id){
      if(!confirm('क्या इस enquiry को delete करना है?'))return;
      var client=(typeof sb!=='undefined'?sb:window.sb);
      var r=await client.from('customer_enquiries').delete().eq('id',id);
      if(r.error){if(typeof toast==='function')toast('❌ Enquiry delete नहीं हुई: '+r.error.message);return;}
      if(typeof toast==='function')toast('🗑️ Enquiry deleted');
      if(typeof window.loadAll==='function')await window.loadAll();else window.renderEnquiries();
    };

    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(typeof window.loadAll==='function'){
        clearInterval(timer);
        var oldLoad=window.loadAll;
        window.loadAll=async function(){var r=await oldLoad.apply(this,arguments);setTimeout(window.renderEnquiries,0);return r;};
        setTimeout(window.renderEnquiries,0);
      }else if(tries>60)clearInterval(timer);
    },100);
  }

  loadOriginal(installEnquiryPatch);
})();
