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
    function safe(v){
      if(typeof window.esc==='function')return window.esc(v);
      return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});
    }
    function client(){return (typeof sb!=='undefined'?sb:window.sb);}

    var enquiryRows=[];
    var enquiryCustomers={};

    async function loadEnquiryData(){
      var db=client();
      if(!db)return {rows:[],customers:{}};
      var er=await db.from('contract_requests').select('id,customer_user_id,request_type,details,status,created_at').order('created_at',{ascending:false});
      if(er.error){console.error('Customer enquiries load failed:',er.error);return {rows:[],customers:{}};}
      var rows=er.data||[];
      var ids=rows.map(function(x){return x.customer_user_id;}).filter(Boolean);
      var customers={};
      if(ids.length){
        var cr=await db.from('customers').select('user_id,name,phone').in('user_id',ids);
        if(!cr.error)(cr.data||[]).forEach(function(c){customers[String(c.user_id)]={name:c.name||'',phone:c.phone||''};});
      }
      return {rows:rows,customers:customers};
    }

    window.renderEnquiries=async function(){
      var tbody=document.getElementById('enquiriesTable');
      if(!tbody)return;
      var data=await loadEnquiryData();
      enquiryRows=data.rows;
      enquiryCustomers=data.customers;
      if(!enquiryRows.length){
        tbody.innerHTML='<tr><td colspan="5"><div class="empty">अभी कोई enquiry नहीं मिली।</div></td></tr>';
        return;
      }
      tbody.innerHTML=enquiryRows.map(function(e){
        var c=enquiryCustomers[String(e.customer_user_id)]||{};
        var name=c.name||'—';
        var phone=c.phone||'—';
        var message=e.details||'—';
        var st=status(e.status);
        var cls=st==='approved'?'completed':st==='cancelled'?'cancelled':'pending';
        return '<tr>'+
          '<td><strong>'+safe(name)+'</strong></td>'+\
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
      var db=client();
      if(!db){if(typeof toast==='function')toast('❌ Supabase उपलब्ध नहीं है');return;}
      var r=await db.from('contract_requests').update({status:next}).eq('id',id);
      if(r.error){if(typeof toast==='function')toast('❌ Status update नहीं हुआ: '+r.error.message);return;}
      if(typeof toast==='function')toast('✅ Status: '+label(next));
      await window.renderEnquiries();
    };

    window.editEnquiry=async function(id){
      var e=enquiryRows.find(function(x){return String(x.id)===String(id);});
      if(!e)return;
      var message=prompt('Enquiry Message edit करें:',e.details||'');
      if(message===null)return;
      var db=client();
      var r=await db.from('contract_requests').update({details:message.trim()}).eq('id',id);
      if(r.error){if(typeof toast==='function')toast('❌ Enquiry edit नहीं हुई: '+r.error.message);return;}
      if(typeof toast==='function')toast('✅ Enquiry updated');
      await window.renderEnquiries();
    };

    window.deleteEnquiry=async function(id){
      if(!confirm('क्या इस enquiry को delete करना है?'))return;
      var db=client();
      var r=await db.from('contract_requests').delete().eq('id',id);
      if(r.error){if(typeof toast==='function')toast('❌ Enquiry delete नहीं हुई: '+r.error.message);return;}
      if(typeof toast==='function')toast('🗑️ Enquiry deleted');
      await window.renderEnquiries();
    };

    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(document.getElementById('enquiriesTable')){
        clearInterval(timer);
        setTimeout(window.renderEnquiries,100);
      }else if(tries>100)clearInterval(timer);
    },100);
  }

  loadOriginal(installEnquiryPatch);
})();
