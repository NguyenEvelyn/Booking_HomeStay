import React,{useEffect,useState}from'react';
import'../styles/admin.css';


const items=[['overview','▦','Tổng quan'],['host-registrations','✍','Duyệt làm Host'],['homestays','⌂','Homestay'],['users','♙','Người dùng'],['bookings','▤','Đặt phòng'],['payments','₫','Thanh toán'],['reviews','★','Đánh giá'],['ai','◎','Thống kê AI'],['settings','⚙','Cấu hình'],['audit','≡','Nhật ký hoạt động']];
export default function AdminLayout({user,tab,onTab,onLogout,onChangePassword,children}){
 const[open,setOpen]=useState(false);useEffect(()=>{const close=e=>e.key==='Escape'&&setOpen(false);document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[]);
 const current=items.find(x=>x[0]===tab)?.[2]||'Tổng quan';
 return <main className={`admin-shell ${open?'menu-open':''}`}><button className="admin-scrim" aria-label="Đóng menu" onClick={()=>setOpen(false)}/><aside className="admin-sidebar"><div className="admin-brand">tripio</div><p>QUẢN TRỊ HỆ THỐNG</p><nav aria-label="Điều hướng quản trị">{items.map(([key,icon,label])=><button key={key} className={tab===key?'active':''} aria-current={tab===key?'page':undefined} onClick={()=>{onTab(key);setOpen(false)}}><b aria-hidden="true">{icon}</b><span>{label}</span></button>)}</nav><button className="admin-logout" onClick={onLogout}>↪ <span>Đăng xuất</span></button></aside><section className="admin-main"><header className="admin-header"><button className="admin-menu" aria-label="Mở menu quản trị" onClick={()=>setOpen(true)}>☰</button><div><p>Trang quản trị / <strong>{current}</strong></p><h1>{current}</h1></div><div className="admin-account"><button onClick={onChangePassword}>Đổi mật khẩu</button><span aria-hidden="true">{user.fullName?.[0]||'A'}</span><div><b>{user.fullName}</b><small>{user.role==='Support'?'Nhân viên hỗ trợ':'Quản trị viên'}</small></div></div></header><div className="admin-content">{children}</div></section></main>
}
