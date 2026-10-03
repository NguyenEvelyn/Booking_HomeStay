import React, { useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import './HomestayInventory.css';

const labels = {
  Draft: 'Bản nháp', Pending: 'Chờ duyệt', Approved: 'Đã duyệt',
  Rejected: 'Từ chối', Suspended: 'Bị ẩn/khóa'
};
const money = value => value == null ? 'Chưa đặt giá' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const date = value => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '—';

function PropertyImage({ item }) {
  if (item.thumbnailUrl) {
    return <div className="inventory-image"><img src={item.thumbnailUrl} alt={item.name}/><small>{item.imageCount || 1} ảnh</small></div>;
  }
  return <div className="inventory-image inventory-image-empty" aria-label="Chưa có ảnh"><HostIcon name="home" size={22} color="#8aa0bc"/><small>Chưa có ảnh</small></div>;
}

export default function HomestayInventory({ items, open, run, onCreate }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('table');
  const list = useMemo(() => items.filter(item => {
    const haystack = `${item.name} ${item.address} ${item.district} ${item.province}`.toLowerCase();
    return (!status || item.status === status) && haystack.includes(search.trim().toLowerCase());
  }), [items, search, status]);

  const actions = item => <div className="inventory-actions">
    <button title="Quản lý Homestay" onClick={() => open(item.id)}><HostIcon name="edit" size={14}/><span>Sửa</span></button>
    {['Draft', 'Rejected'].includes(item.status) &&
      <button className="inventory-submit" title="Gửi Admin duyệt" onClick={() => run(() => homestayApi.submitHomestay(item.id), false)}>Gửi duyệt</button>}
  </div>;

  return <section className="inventory-section">
    <header className="inventory-header">
      <div><small>QUẢN LÝ KINH DOANH</small><h2>Danh sách Homestay</h2><p>Admin chỉ duyệt khi đăng ký Homestay mới; phòng và các chỉnh sửa vận hành do Host tự quản lý.</p></div>
      <div className="inventory-toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên, địa chỉ Homestay..."/>
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="inventory-view"><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}><HostIcon name="list" size={14}/><span>Bảng</span></button><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}><HostIcon name="grid" size={14}/><span>Lưới</span></button></div>
        <button className="inventory-create" onClick={onCreate}><HostIcon name="plus" size={15}/><span>Đăng ký Homestay</span></button>
      </div>
    </header>

    <div className="inventory-kpis">
      <article><small>TỔNG HOMESTAY</small><b>{items.length}</b></article>
      <article><small>ĐÃ DUYỆT</small><b>{items.filter(x => x.status === 'Approved').length}</b></article>
      <article><small>TỔNG PHÒNG</small><b>{items.reduce((sum, x) => sum + x.physicalRoomCount, 0)}</b></article>
      <article><small>PHÒNG CÒN TRỐNG</small><b>{items.reduce((sum, x) => sum + x.availableRoomCount, 0)}</b></article>
    </div>

    {view === 'table' ? <div className="inventory-table-wrap"><table className="inventory-table">
      <thead><tr><th>MÃ</th><th>ẢNH</th><th>TÊN HOMESTAY</th><th>ĐỊA CHỈ</th><th>LOẠI PHÒNG</th><th>SỐ PHÒNG</th><th>GIÁ TỪ / ĐÊM</th><th>TRẠNG THÁI</th><th>CẬP NHẬT</th><th>THAO TÁC</th></tr></thead>
      <tbody>{list.map(item => <tr key={item.id}>
        <td><b>HS{String(item.id).padStart(3, '0')}</b></td><td><PropertyImage item={item}/></td>
        <td><strong>{item.name}</strong>{item.rejectionReason && <small className="inventory-sub" role="status">Lý do xử lý: {item.rejectionReason}</small>}</td><td><span className="inventory-address">{item.address}, {item.district}, {item.province}</span></td>
        <td>{item.roomTypeCount} loại</td><td><b>{item.physicalRoomCount}</b><small className="inventory-sub">{item.availableRoomCount} còn trống</small></td>
        <td><b>{money(item.fromPrice)}</b></td><td><span className={`inventory-status status-${item.status.toLowerCase()}`}>{labels[item.status] || item.status}</span></td>
        <td>{date(item.updatedAt)}</td><td>{actions(item)}</td>
      </tr>)}</tbody>
    </table>{!list.length && <p className="inventory-empty">Không tìm thấy Homestay phù hợp.</p>}</div> :
    <div className="inventory-grid">{list.map(item => <article key={item.id} className="inventory-card">
      <PropertyImage item={item}/><div className="inventory-card-body"><span className={`inventory-status status-${item.status.toLowerCase()}`}>{labels[item.status] || item.status}</span><h3>{item.name}</h3>{item.rejectionReason && <p role="status">Lý do xử lý: {item.rejectionReason}</p>}<p>{item.address}, {item.district}, {item.province}</p><div><span>{item.roomTypeCount} loại phòng</span><span>{item.physicalRoomCount} phòng</span><span>{item.availableRoomCount} còn trống</span></div><footer><b>Từ {money(item.fromPrice)}</b>{actions(item)}</footer></div>
    </article>)}{!list.length && <p className="inventory-empty">Không tìm thấy Homestay phù hợp.</p>}</div>}
  </section>;
}
