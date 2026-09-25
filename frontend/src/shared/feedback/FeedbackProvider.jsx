import React,{createContext,useCallback,useEffect,useRef,useState}from'react';
import{createPortal}from'react-dom';
import{registerFeedback}from'./feedback.js';
import'./feedback.css';

export const FeedbackContext=createContext(null);
const icons={success:'✓',error:'!',warning:'!',info:'i'};
let nextId=1;

export default function FeedbackProvider({children}){
 const[toasts,setToasts]=useState([]),[dialog,setDialog]=useState(null),[leaving,setLeaving]=useState([]);
 const closeToast=useCallback(id=>{setLeaving(x=>[...x,id]);setTimeout(()=>{setToasts(x=>x.filter(t=>t.id!==id));setLeaving(x=>x.filter(n=>n!==id))},220)},[]);
 const dispatch=useCallback((type,payload)=>{
  if(type==='toast'){const id=nextId++,duration=Math.min(10000,Math.max(3000,payload.duration||4000));setToasts(x=>[...x,{...payload,id,duration}]);return id}
  return new Promise(resolve=>setDialog({kind:type,...payload,resolve}));
 },[]);
 useEffect(()=>registerFeedback(dispatch),[dispatch]);
 return <FeedbackContext.Provider value={{dispatch}}>{children}{createPortal(<><div className="tripio-toast-region" aria-live="polite" aria-atomic="false">{toasts.map(item=><Toast key={item.id} item={item} leaving={leaving.includes(item.id)} close={()=>closeToast(item.id)}/>)}</div>{dialog&&<Dialog state={dialog} close={value=>{dialog.resolve(value);setDialog(null)}}/>}</>,document.body)}</FeedbackContext.Provider>
}

function Toast({item,leaving,close}){
 const[timer,setTimer]=useState(null),[remaining,setRemaining]=useState(item.duration),started=useRef(Date.now());
 const start=useCallback(ms=>{started.current=Date.now();setTimer(setTimeout(close,ms))},[close]);
 useEffect(()=>{start(remaining);return()=>clearTimeout(timer)},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const pause=()=>{clearTimeout(timer);setRemaining(x=>Math.max(250,x-(Date.now()-started.current)))};
 const resume=()=>start(remaining);
 return <div className={`tripio-toast ${item.variant} ${leaving?'leaving':''}`} role={item.variant==='error'?'alert':'status'} onMouseEnter={pause} onMouseLeave={resume}><span className="tripio-toast-icon" aria-hidden="true">{icons[item.variant]||icons.info}</span><div><strong>{item.title||({success:'Thành công',error:'Có lỗi xảy ra',warning:'Cần lưu ý',info:'Thông báo'}[item.variant])}</strong><p>{item.message}</p></div><button onClick={close} aria-label="Đóng thông báo">×</button><i style={{animationDuration:`${item.duration}ms`}}/></div>
}

function Dialog({state,close}){
 const panel=useRef(null),input=useRef(null),[value,setValue]=useState(state.defaultValue||''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const isPrompt=state.kind==='prompt';
 const cancel=useCallback(()=>{if(!loading)close(isPrompt?null:false)},[close,isPrompt,loading]);
 const accept=useCallback(async()=>{
  if(loading)return;
  if(isPrompt){const trimmed=value.trim();const validation=state.validate?.(trimmed);if(validation){setError(validation);return}if(state.required!==false&&!trimmed){setError(state.requiredMessage||'Vui lòng nhập nội dung.');return}close(trimmed);return}
  if(state.onConfirm){setLoading(true);try{await state.onConfirm();close(true)}catch{setLoading(false)}return}close(true);
 },[close,isPrompt,loading,state,value]);
 useEffect(()=>{const previous=document.activeElement,root=panel.current;document.body.classList.add('tripio-dialog-open');(isPrompt?input.current:root?.querySelector('[data-primary]'))?.focus();const key=e=>{if(e.key==='Escape'){e.preventDefault();cancel()}if(e.key==='Enter'&&(!isPrompt||e.target===input.current)){e.preventDefault();accept()}if(e.key==='Tab'){const focusable=[...root.querySelectorAll('button,input,textarea,select,[href],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled);if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.classList.remove('tripio-dialog-open');previous?.focus?.()}},[accept,cancel,isPrompt]);
 const variant=state.variant||'default';
 return <div className="tripio-dialog-overlay" onMouseDown={e=>e.target===e.currentTarget&&cancel()}><section ref={panel} className={`tripio-dialog ${variant}`} role="dialog" aria-modal="true" aria-labelledby="tripio-dialog-title" aria-describedby="tripio-dialog-message"><button className="tripio-dialog-close" onClick={cancel} disabled={loading} aria-label="Đóng hộp thoại">×</button><span className="tripio-dialog-symbol" aria-hidden="true">{variant==='danger'?'!':variant==='warning'?'!':'✓'}</span><h2 id="tripio-dialog-title">{state.title||(isPrompt?'Nhập thông tin':'Xác nhận thao tác')}</h2>{state.message&&<p id="tripio-dialog-message">{state.message}</p>}{isPrompt&&<label className="tripio-prompt-field">{state.label&&<span>{state.label}</span>}<textarea ref={input} rows={state.rows||3} maxLength={state.maxLength} placeholder={state.placeholder||''} value={value} onChange={e=>{setValue(e.target.value);setError('')}}/>{error&&<small role="alert">{error}</small>}</label>}<footer><button className="tripio-dialog-cancel" onClick={cancel} disabled={loading}>{state.cancelText||'Hủy'}</button><button data-primary className="tripio-dialog-confirm" onClick={accept} disabled={loading}>{loading?<><i className="tripio-spinner"/> Đang xử lý…</>:state.confirmText||(isPrompt?'Lưu':'Xác nhận')}</button></footer></section></div>
}
