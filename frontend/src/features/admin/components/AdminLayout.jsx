import React, { useEffect, useState } from 'react';
import '../styles/admin.css';

const paths = {
  overview:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  'host-registrations':<><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v1"/><circle cx="8.5" cy="7" r="4"/><path d="m16 11 2 2 4-5"/></>,
  homestays:<><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
  bookings:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01"/></>,
  payments:<><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></>,
  vouchers:<><path d="M3 7a2 2 0 0 1 2-2h14v4a2 2 0 0 0 0 4v4H5a2 2 0 0 1-2-2V7Z"/><path d="M12 7v8M9 9h.01M15 13h.01"/></>,
  tax:<><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  reviews:<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
  ai:<><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-2.9 1.18V21h-4v-.09a1.7 1.7 0 0 0-2.9-1.18l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.09 14H3v-4h.09A1.7 1.7 0 0 0 4.27 7.1l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 10 3.09V3h4v.09a1.7 1.7 0 0 0 2.9 1.18l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 20.91 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15z"/></>,
  'no-show-disputes':<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M5 5l14 14"/></>,
  banners:<><rect x="3" y="5" width="18" height="12" rx="2"/><path d="m3 15 5-5 4 4 3-3 6 6M8 21h8"/></>,
  audit:<><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/></>,
  logout:<><path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6"/></>,
  menu:<path d="M4 6h16M4 12h16M4 18h16"/>, collapse:<path d="m15 18-6-6 6-6"/>,
  key:<><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.8-8.8M15 8l3 3M17 6l2 2"/></>,
};
function Icon({name,size=19}){return <svg className="admin-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>}
const items=[['overview','Tổng quan'],['host-registrations','Duyệt làm Host'],['users','Người dùng'],['homestays','Homestay'],['vouchers','Voucher'],['banners','Banner trang chủ'],['bookings','Đặt phòng'],['no-show-disputes','Khiếu nại no-show'],['payments','Thanh toán'],['tax','Thuế mô phỏng'],['reviews','Đánh giá'],['ai','Thống kê AI'],['settings','Cấu hình'],['audit','Nhật ký hoạt động']];
export default function AdminLayout({user,tab,onTab,onLogout,onChangePassword,children}){
 const[open,setOpen]=useState(false),[collapsed,setCollapsed]=useState(false);
 useEffect(()=>{const close=e=>e.key==='Escape'&&setOpen(false);document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close)},[]);
 const visibleItems=user?.role==='Admin'?items:items.filter(([key])=>key!=='vouchers');
 const current=visibleItems.find(([key])=>key===tab)?.[1]||'Tổng quan',name=user?.fullName||'Quản trị viên';
 return <main className={`admin-shell ${collapsed?'sidebar-collapsed':''} ${open?'menu-open':''}`}>
  <button className="admin-scrim" aria-label="Đóng menu" onClick={()=>setOpen(false)}/>
  <aside className="admin-sidebar">
   <div className="admin-sidebar-top"><div className="admin-brand">tripio</div><button className="admin-collapse" aria-label={collapsed?'Mở rộng thanh bên':'Thu gọn thanh bên'} onClick={()=>setCollapsed(v=>!v)}><Icon name="collapse"/></button></div>
   <div className="admin-profile"><span aria-hidden="true">{name[0]?.toUpperCase()}</span><div><b>{name}</b><small>Quản trị hệ thống</small></div></div>
   <nav aria-label="Điều hướng quản trị">{visibleItems.map(([key,label])=><button key={key} className={tab===key?'active':''} aria-current={tab===key?'page':undefined} title={collapsed?label:undefined} onClick={()=>{onTab(key);setOpen(false)}}><Icon name={key}/><span>{label}</span></button>)}</nav>
   <button className="admin-logout" onClick={onLogout} title={collapsed?'Đăng xuất':undefined}><Icon name="logout"/><span>Đăng xuất</span></button>
  </aside>
  <section className="admin-main"><header className="admin-header">
   <button className="admin-menu" aria-label="Mở menu quản trị" onClick={()=>setOpen(true)}><Icon name="menu" size={21}/></button>
   <div className="admin-header-titles"><p><i aria-hidden="true"/> QUẢN TRỊ TRIPIO</p><h1>{current}</h1></div>
   <div className="admin-account"><button onClick={onChangePassword}><Icon name="key" size={17}/><span>Đổi mật khẩu</span></button><span className="admin-account-avatar" aria-hidden="true">{name[0]?.toUpperCase()}</span><div><b>{name}</b><small>{user?.role==='Support'?'Nhân viên hỗ trợ':'Quản trị viên'}</small></div></div>
  </header><div className="admin-content">{children}</div></section>
 </main>
}
