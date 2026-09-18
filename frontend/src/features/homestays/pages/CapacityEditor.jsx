import React,{useEffect,useState}from'react';
import{homestayApi}from'../api/homestayApi.js';

const money=v=>new Intl.NumberFormat('vi-VN').format(Number(v)||0);
const digits=v=>String(v).replace(/\D/g,'');

function Stepper({label,value,min=1,onChange}){
 return <div className="capacity-stepper"><span>{label}</span><div><button type="button" disabled={value<=min} onClick={()=>onChange(Math.max(min,value-1))}>−</button><b>{value}</b><button type="button" onClick={()=>onChange(value+1)}>＋</button></div></div>
}

export default function CapacityEditor({homestayId,data,run}){
 const[open,setOpen]=useState(false);
 const[form,setForm]=useState({
  baseCapacity:data.baseCapacity||Math.min(2,(data.maxAdults||1)+(data.maxChildren||0)),
  maxCapacity:data.maxCapacity||(data.maxAdults||1)+(data.maxChildren||0),
  extraGuestAllowed:data.extraGuestAllowed||false,
  extraGuestFee:String(data.extraGuestFee||0)
 });
 const[saving,setSaving]=useState(false);
 const[notice,setNotice]=useState(null);
 const invalid=form.maxCapacity<form.baseCapacity;
 useEffect(()=>setNotice(null),[form.baseCapacity,form.maxCapacity,form.extraGuestAllowed,form.extraGuestFee]);
 const save=async()=>{if(invalid||saving)return;setSaving(true);setNotice(null);const result=await run(()=>homestayApi.updateRoomCapacity(homestayId,data.id,{...form,extraGuestFee:+form.extraGuestFee}));setSaving(false);setNotice(result?{type:'success',text:'Đã lưu sức chứa và chính sách khách thêm.'}:{type:'error',text:'Chưa thể lưu sức chứa. Vui lòng thử lại.'})};
 const applyAll=()=>{if(invalid)return;if(confirm('Áp dụng quyền thêm khách và mức phụ phí này cho tất cả loại phòng?'))run(()=>homestayApi.bulkExtraGuestPolicy(homestayId,{extraGuestAllowed:form.extraGuestAllowed,extraGuestFee:+form.extraGuestFee}))};
 return <section className={`capacity-editor ${open?'open':''}`}><button type="button" className="capacity-toggle" onClick={()=>setOpen(!open)}><span>👥 <b>Sức chứa &amp; Khách thêm</b><small>{form.baseCapacity} tiêu chuẩn · tối đa {form.maxCapacity}</small></span><i>{open?'−':'＋'}</i></button>{open&&<div className="capacity-body"><div className="capacity-controls"><Stepper label="Khách tiêu chuẩn" value={form.baseCapacity} onChange={value=>setForm({...form,baseCapacity:value})}/><Stepper label="Khách tối đa" value={form.maxCapacity} onChange={value=>setForm({...form,maxCapacity:value})}/><label className="extra-guest-check"><input type="checkbox" checked={form.extraGuestAllowed} onChange={e=>setForm({...form,extraGuestAllowed:e.target.checked})}/><span><b>Cho phép thêm khách</b><small>Tính phí từ khách thứ {form.baseCapacity+1}</small></span></label>{form.extraGuestAllowed&&<label className="extra-fee-field"><span>Phụ phí / người / đêm</span><div><input inputMode="numeric" value={money(form.extraGuestFee)} onChange={e=>setForm({...form,extraGuestFee:digits(e.target.value)})}/><b>₫</b></div></label>}</div><div className="capacity-preview"><div className="guest-dots">{Array.from({length:form.maxCapacity},(_,i)=><i key={i} className={i<form.baseCapacity?'included':'extra'}/>)}</div><b>{form.baseCapacity} tiêu chuẩn · tối đa {form.maxCapacity}</b>{form.extraGuestAllowed&&form.maxCapacity>form.baseCapacity&&<small>＋{money(form.extraGuestFee)}₫/khách/đêm từ khách thứ {form.baseCapacity+1}</small>}</div>{invalid&&<p className="capacity-error">Sức chứa tối đa phải lớn hơn hoặc bằng số khách tiêu chuẩn.</p>}{!form.extraGuestAllowed&&form.maxCapacity>form.baseCapacity&&<p className="capacity-suggestion">💡 Bạn đang có slot khách thêm. Hãy bật “Cho phép thêm khách” để khách có thể đặt đủ sức chứa tối đa.</p>}{notice&&<p className={`capacity-notice ${notice.type}`} role="status" aria-live="polite">{notice.type==='success'?'✓ ':'⚠ '}{notice.text}</p>}<footer><button type="button" className="capacity-bulk" disabled={invalid||saving} onClick={applyAll}>Áp dụng phụ phí này cho tất cả loại phòng</button><button type="button" className="capacity-save" disabled={invalid||saving} onClick={save}>{saving?'Đang lưu…':'Lưu sức chứa'}</button></footer></div>}</section>
}
