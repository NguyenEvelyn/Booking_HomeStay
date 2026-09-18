import React, { useEffect, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import pineHomestayImage from '../../../../assets/f6cd6879081dc8e8d4ff18669308ea86.jpg';
import azureHomestayImage from '../../../../assets/ecf184f6b6cd2b6e2aa898ff3195ab7e.jpg';
import sunsetHomestayImage from '../../../../assets/2fc6b619bb0af3dc94971c099d25bbae.jpg';

const money = (value) => value == null ? 'Liên hệ' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const covers = [pineHomestayImage, azureHomestayImage, sunsetHomestayImage];
const roomFilters = ['Phòng đơn', 'Phòng đôi', 'Phòng có ban công', 'Phòng gia đình'];
const SearchIcon = ({ type }) => <svg viewBox="0 0 24 24" aria-hidden="true">
  {type === 'location' && <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
  {type === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>}
  {type === 'guests' && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-2.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20M16 5.5a3 3 0 0 1 0 5.8M16.5 14a4.5 4.5 0 0 1 4 4.5V20" /></>}
</svg>;

export default function CustomerHomestaysPage({ user, onBack, onOpen, onBookings, onAccount }) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({ items: [], total: 0 });
  const [maxPrice, setMaxPrice] = useState(3000000);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [roomType, setRoomType] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('recommended');
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('tripio-favorites') || '[]'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const criteria = (targetPage = page) => ({ search, checkIn, checkOut, guests, maxPrice, roomType, minRating, sort, page: targetPage, pageSize: 12 });
  const load = async (targetPage = 1) => {
    setLoading(true); setError('');
    try {
      if ((checkIn && !checkOut) || (!checkIn && checkOut)) throw new Error('Vui lòng chọn đầy đủ ngày nhận và ngày trả phòng.');
      if (checkIn && checkOut && checkOut <= checkIn) throw new Error('Ngày trả phòng phải sau ngày nhận phòng.');
      const response = await homestayApi.list(criteria(targetPage));
      setResult(response); setPage(targetPage);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, [maxPrice, roomType, minRating, sort]);

  const resetFilters = () => { setMaxPrice(3000000); setRoomType(''); setMinRating(0); };
  const toggleFavorite = (id) => { const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]; setFavorites(next); localStorage.setItem('tripio-favorites', JSON.stringify(next)); };
  const openItem = (id) => onOpen(id, criteria(page));
  const pageCount = Math.max(1, Math.ceil(result.total / (result.pageSize || 12)));

  return <main className="catalog-page catalog-redesign">
    <CustomerNav active="homestays" user={user} onHome={onBack} onHomestays={() => {}} onBookings={onBookings} onAccount={onAccount} />
    <section className="catalog-hero"><div><p>KHÁM PHÁ ĐIỂM ĐẾN</p><h1>Tìm không gian nghỉ dưỡng<br /><em>dành riêng cho bạn</em></h1><span>Những điểm lưu trú được chọn lọc cho hành trình đáng nhớ cùng Tripio.</span></div></section>
    <form className="search-bar catalog-search" onSubmit={(event) => { event.preventDefault(); load(1); }}>
      <label>Địa điểm hoặc tên homestay<span className="search-control"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bạn muốn đến đâu?" /><SearchIcon type="location" /></span></label>
      <label>Ngày nhận<span className="search-control"><input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" min={new Date().toISOString().slice(0, 10)} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && checkOut <= e.target.value) setCheckOut(''); }} /><SearchIcon type="calendar" /></span></label>
      <label>Ngày trả<span className="search-control"><input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" min={checkIn || new Date().toISOString().slice(0, 10)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /><SearchIcon type="calendar" /></span></label>
      <label>Số khách<span className="search-control guest-number-control"><input type="number" min="1" max="30" step="1" value={guests} onChange={(e) => setGuests(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} inputMode="numeric" aria-label="Số khách" /><SearchIcon type="guests" /></span></label>
      <button>Tìm phòng</button>
    </form>
    <section className="catalog-workspace">
      <aside className="catalog-filters">
        <header><div><small>BỘ LỌC</small><h2>Tìm nơi phù hợp</h2></div><button type="button" onClick={resetFilters}>Đặt lại</button></header>
        <div className="filter-group"><h3>Khoảng giá</h3><p>1 phòng, 1 đêm</p><input type="range" min="500000" max="3000000" step="100000" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} /><div className="price-range"><span>500.000 ₫</span><span>{money(maxPrice)}</span></div></div>
        <div className="filter-group"><h3>Loại phòng</h3><label><input type="radio" name="room-type" checked={!roomType} onChange={() => setRoomType('')} /> Tất cả</label>{roomFilters.map((name) => <label key={name}><input type="radio" name="room-type" checked={roomType === name} onChange={() => setRoomType(name)} /> {name}</label>)}</div>
        <div className="filter-group"><h3>Đánh giá sao</h3>{[5, 4, 3, 0].map((rating) => <label key={rating}><input type="radio" name="rating" checked={minRating === rating} onChange={() => setMinRating(rating)} /> {rating ? `${rating} sao trở lên` : 'Tất cả đánh giá'} {rating > 0 && <b>★</b>}</label>)}</div>
      </aside>
      <div className="catalog-results">
        <header><div><small>DANH SÁCH LƯU TRÚ</small><h2>{result.total} homestay phù hợp</h2></div><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recommended">Đề xuất</option><option value="price-low">Giá thấp trước</option><option value="rating">Đánh giá cao</option></select></header>
        {loading && <p className="state-message">Đang tải homestay...</p>}{error && <p className="state-message error">{error}</p>}{!loading && !error && result.items.length === 0 && <p className="state-message">Không tìm thấy homestay phù hợp với bộ lọc.</p>}
        <div className="catalog-stay-grid">{result.items.map((item, index) => <article className="catalog-stay-card" key={item.id} onClick={() => openItem(item.id)} style={{ backgroundImage: `url('${item.thumbnailUrl || covers[index % covers.length]}')` }}>
          <div className="catalog-card-top"><span>⌖ {item.province || item.district}</span><button type="button" className={favorites.includes(item.id) ? 'favorite' : ''} aria-label="Lưu homestay" onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}>{favorites.includes(item.id) ? '♥' : '♡'}</button></div>
          <div className="catalog-card-info"><div className="stay-name-row"><h3>{item.name}</h3><span>{item.reviewCount ? Number(item.averageRating).toFixed(1) : 'Mới'} {item.reviewCount > 0 && <b>★</b>}</span></div><p>{item.address}, {item.district}. Còn {Math.max(0, item.availableRoomCount)} phòng phù hợp.</p><div><strong>{money(item.fromPrice)}<small> / đêm</small></strong><button type="button">Đặt phòng</button></div></div>
        </article>)}</div>
        {!loading && !error && result.total > 0 && <nav className="catalog-pagination"><button disabled={page <= 1} onClick={() => load(page - 1)}>← Trước</button><span>Trang {page} / {pageCount}</span><button disabled={page >= pageCount} onClick={() => load(page + 1)}>Sau →</button></nav>}
      </div>
    </section>
  </main>;
}
