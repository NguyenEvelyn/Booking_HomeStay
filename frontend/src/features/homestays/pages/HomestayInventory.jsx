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
    return <div className="inventory-image"><img src={item.thumbnailUrl} alt={`Ảnh đại diện ${item.name}`} loading="lazy"/><small>{item.imageCount || 1} ảnh</small></div>;
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

  const approvedCount = items.filter(x => x.status === 'Approved').length;
  const totalRooms = items.reduce((sum, x) => sum + x.physicalRoomCount, 0);
  const availableRooms = items.reduce((sum, x) => sum + x.availableRoomCount, 0);

  return <section className="inventory-section" aria-labelledby="inventory-title">
    <header className="inventory-header">
      <div className="inventory-heading"><span className="inventory-eyebrow">QUẢN LÝ KINH DOANH</span><h2 id="inventory-title">Danh sách Homestay</h2><p>Theo dõi tình trạng phê duyệt, số phòng và mức độ sẵn sàng của từng cơ sở.</p></div>
      <div className="inventory-toolbar" role="search" aria-label="Tìm và lọc Homestay">
        <label className="inventory-search-field">
          <span className="sr-only">Tìm Homestay</span>
          <HostIcon name="search" size={17}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên hoặc địa chỉ..."/>
        </label>
        <label className="inventory-filter-field">
          <span className="sr-only">Lọc theo trạng thái</span>
          <select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <HostIcon name="chevronDown" size={15}/>
        </label>
        <div className="inventory-view" role="group" aria-label="Kiểu hiển thị"><button type="button" className={view === 'table' ? 'active' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}><HostIcon name="list" size={15}/><span>Bảng</span></button><button type="button" className={view === 'grid' ? 'active' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')}><HostIcon name="grid" size={15}/><span>Lưới</span></button></div>
        <button className="inventory-create" onClick={onCreate}><HostIcon name="plus" size={15}/><span>Đăng ký Homestay</span></button>
      </div>
    </header>

    <div className="inventory-kpis" aria-label="Tổng quan danh mục">
      <article><span className="inventory-kpi-icon"><HostIcon name="home" size={18}/></span><div><small>TỔNG HOMESTAY</small><b>{items.length}</b><span>cơ sở đang quản lý</span></div></article>
      <article><span className="inventory-kpi-icon is-success"><HostIcon name="checkCircle" size={18}/></span><div><small>ĐÃ DUYỆT</small><b>{approvedCount}</b><span>{items.length ? Math.round(approvedCount / items.length * 100) : 0}% tổng danh mục</span></div></article>
      <article><span className="inventory-kpi-icon is-violet"><HostIcon name="bed" size={18}/></span><div><small>TỔNG PHÒNG</small><b>{totalRooms}</b><span>trên tất cả cơ sở</span></div></article>
      <article><span className="inventory-kpi-icon is-warning"><HostIcon name="key" size={18}/></span><div><small>PHÒNG CÒN TRỐNG</small><b>{availableRooms}</b><span>{totalRooms ? Math.round(availableRooms / totalRooms * 100) : 0}% công suất khả dụng</span></div></article>
    </div>

    <div className="inventory-results-bar" aria-live="polite"><b>{list.length}</b><span>Homestay phù hợp</span>{(search || status) && <small>trên tổng số {items.length}</small>}</div>

    {view === 'table' ? <div className="inventory-table-wrap"><table className="inventory-table">
      <caption className="sr-only">Danh sách Homestay đang quản lý</caption>
      <thead><tr><th scope="col">MÃ</th><th scope="col">ẢNH</th><th scope="col">TÊN HOMESTAY</th><th scope="col">ĐỊA CHỈ</th><th scope="col">LOẠI PHÒNG</th><th scope="col">SỐ PHÒNG</th><th scope="col">GIÁ TỪ / ĐÊM</th><th scope="col">TRẠNG THÁI</th><th scope="col">CẬP NHẬT</th><th scope="col">THAO TÁC</th></tr></thead>
      <tbody>{list.map(item => <tr key={item.id}>
        <td><b>HS{String(item.id).padStart(3, '0')}</b></td><td><PropertyImage item={item}/></td>
        <td><strong>{item.name}</strong>{item.rejectionReason && <small className="inventory-sub" role="status">Lý do xử lý: {item.rejectionReason}</small>}</td><td><span className="inventory-address">{item.address}, {item.district}, {item.province}</span></td>
        <td>{item.roomTypeCount} loại</td><td className="inventory-numeric"><b>{item.physicalRoomCount}</b><small className="inventory-sub">{item.availableRoomCount} còn trống</small></td>
        <td className="inventory-price"><b>{money(item.fromPrice)}</b></td><td><span className={`inventory-status status-${item.status.toLowerCase()}`}><i aria-hidden="true"/>{labels[item.status] || item.status}</span></td>
        <td>{date(item.updatedAt)}</td><td>{actions(item)}</td>
      </tr>)}</tbody>
    </table>{!list.length && <EmptyState/>}</div> :
    <div className="inventory-grid">{list.map(item => <article key={item.id} className="inventory-card">
      <PropertyImage item={item}/><div className="inventory-card-body"><span className={`inventory-status status-${item.status.toLowerCase()}`}><i aria-hidden="true"/>{labels[item.status] || item.status}</span><h3>{item.name}</h3>{item.rejectionReason && <p role="status">Lý do xử lý: {item.rejectionReason}</p>}<p>{item.address}, {item.district}, {item.province}</p><div><span>{item.roomTypeCount} loại phòng</span><span>{item.physicalRoomCount} phòng</span><span>{item.availableRoomCount} còn trống</span></div><footer><b>Từ {money(item.fromPrice)}</b>{actions(item)}</footer></div>
    </article>)}{!list.length && <EmptyState/>}</div>}
  </section>;
}

function EmptyState() {
  return <div className="inventory-empty" role="status"><span><HostIcon name="search" size={22}/></span><b>Không tìm thấy Homestay</b><small>Hãy thử từ khóa khác hoặc thay đổi bộ lọc trạng thái.</small></div>;
}
