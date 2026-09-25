import React, { useEffect, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { recordRecommendationEvent } from '../api/recommendationEvents.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import pineHomestayImage from '../../../../assets/f6cd6879081dc8e8d4ff18669308ea86.jpg';
import azureHomestayImage from '../../../../assets/ecf184f6b6cd2b6e2aa898ff3195ab7e.jpg';
import sunsetHomestayImage from '../../../../assets/2fc6b619bb0af3dc94971c099d25bbae.jpg';
import catalogHeroImage from '../../../../assets/figma/hero.png';
import { freshImageUrl } from '../../../shared/utils/freshImageUrl.js';

const money = (value) => value == null ? 'Liên hệ' : `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const covers = [pineHomestayImage, azureHomestayImage, sunsetHomestayImage];
const roomFilters = ['Phòng đơn', 'Phòng đôi', 'Phòng có ban công', 'Phòng gia đình'];
const amenityOptions = ['WiFi miễn phí', 'Hồ bơi', 'Nhà bếp', 'Chỗ đỗ xe miễn phí', 'Cho phép mang theo vật nuôi'];
const SearchIcon = ({ type }) => <svg viewBox="0 0 24 24" aria-hidden="true">
  {type === 'location' && <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
  {type === 'calendar' && <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>}
  {type === 'guests' && <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-2.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V20M16 5.5a3 3 0 0 1 0 5.8M16.5 14a4.5 4.5 0 0 1 4 4.5V20" /></>}
</svg>;

export default function CustomerHomestaysPage({ user, refreshKey = 0, initialSearch = null, onBack, onOpen, onBookings, onAccount }) {
  const [search, setSearch] = useState(initialSearch?.search || '');
  const [location, setLocation] = useState(initialSearch?.location || '');
  const [result, setResult] = useState({ items: [], total: 0 });
  const [maxPrice, setMaxPrice] = useState(3000000);
  const [checkIn, setCheckIn] = useState(initialSearch?.checkIn || '');
  const [checkOut, setCheckOut] = useState(initialSearch?.checkOut || '');
  const [guests, setGuests] = useState(initialSearch?.guests || 2);
  const [rooms, setRooms] = useState(initialSearch?.rooms || 1);
  const [roomType, setRoomType] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('recommended');
  const [preferredAmenities, setPreferredAmenities] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationModelVersion, setRecommendationModelVersion] = useState('');
  const [recommendationError, setRecommendationError] = useState('');
  const latestRequest = useRef(0);
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('tripio-favorites') || '[]'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const criteria = (targetPage = page) => ({ search, location, checkIn, checkOut, guests, rooms, maxPrice, roomType, minRating, sort, page: targetPage, pageSize: 12 });
  const load = async (targetPage = 1) => {
    const requestId = ++latestRequest.current;
    setLoading(true); setError('');
    try {
      if ((checkIn && !checkOut) || (!checkIn && checkOut)) throw new Error('Vui lòng chọn đầy đủ ngày nhận và ngày trả phòng.');
      if (checkIn && checkOut && checkOut <= checkIn) throw new Error('Ngày trả phòng phải sau ngày nhận phòng.');
      if (checkIn && checkIn < localToday()) throw new Error('Ngày nhận phòng không được ở trong quá khứ.');
      const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000)) : 1;
      const [catalogResult, recommendationResult] = await Promise.allSettled([
        homestayApi.list(criteria(targetPage)),
        location ? Promise.resolve({ items: [], modelVersion: '' }) : homestayApi.recommendations({ search, checkIn, checkOut, guests, rooms,
          totalBudget: maxPrice * rooms * nights, amenities: preferredAmenities, roomType, minRating, topK: 5 })
      ]);
      if (requestId !== latestRequest.current) return;
      if (catalogResult.status === 'rejected') throw catalogResult.reason;
      const response = catalogResult.value;
      const imageVersion = `${Date.now()}-${refreshKey}`;
      setResult({ ...response, items: response.items.map((item) => ({ ...item, thumbnailUrl: freshImageUrl(item.thumbnailUrl, imageVersion) })) }); setPage(targetPage);
      setRecommendations(recommendationResult.status === 'fulfilled'
        ? recommendationResult.value.items.map((item) => ({ ...item, thumbnailUrl: freshImageUrl(item.thumbnailUrl, imageVersion) })) : []);
      setRecommendationModelVersion(recommendationResult.status === 'fulfilled' ? recommendationResult.value.modelVersion || 'baseline' : '');
      setRecommendationError(recommendationResult.status === 'rejected' ? 'Chưa tải được gợi ý lúc này.' : '');
      if (targetPage === 1) recordRecommendationEvent({ eventType: 'search', search: search.trim(),
        checkIn: checkIn || null, checkOut: checkOut || null, guests, rooms,
        totalBudget: maxPrice * rooms * nights, amenities: preferredAmenities,
        recommendedIds: recommendationResult.status === 'fulfilled'
          ? recommendationResult.value.items.map((item) => item.id) : [] });
    } catch (e) { if (requestId === latestRequest.current) { setError(e.message); setRecommendations([]); setRecommendationModelVersion(''); } }
    finally { if (requestId === latestRequest.current) setLoading(false); }
  };
  useEffect(() => { load(1); }, [maxPrice, roomType, minRating, sort, preferredAmenities, refreshKey]);

  const resetFilters = () => { setMaxPrice(3000000); setRoomType(''); setMinRating(0); setPreferredAmenities([]); };
  const toggleAmenity = (name) => setPreferredAmenities((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  const toggleFavorite = (id) => { const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]; setFavorites(next); localStorage.setItem('tripio-favorites', JSON.stringify(next)); };
  const openItem = (id) => onOpen(id, criteria(page));
  const pageCount = Math.max(1, Math.ceil(result.total / (result.pageSize || 12)));

  return <main className="catalog-page catalog-redesign">
    <CustomerNav active="homestays" user={user} onHome={onBack} onHomestays={() => {}} onBookings={onBookings} onAccount={onAccount} />
    <section className="catalog-hero" style={{backgroundImage:`linear-gradient(90deg,rgba(3,24,58,.9),rgba(4,31,71,.3)),url('${catalogHeroImage}')`}}><div><p>KHÁM PHÁ ĐIỂM ĐẾN</p><h1>Tìm không gian nghỉ dưỡng<br /><em>dành riêng cho bạn</em></h1><span>Những điểm lưu trú được chọn lọc cho hành trình đáng nhớ cùng Tripio.</span></div></section>
    <form className="search-bar catalog-search" onSubmit={(event) => { event.preventDefault(); load(1); }}>
      <label>Địa điểm hoặc tên homestay<span className="search-control"><input value={search} onChange={(event) => { setSearch(event.target.value); setLocation(''); }} placeholder="Bạn muốn đến đâu?" /><SearchIcon type="location" /></span></label>
      <label>Ngày nhận<span className="search-control"><input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" min={localToday()} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut && checkOut <= e.target.value) setCheckOut(''); }} /><SearchIcon type="calendar" /></span></label>
      <label>Ngày trả<span className="search-control"><input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" min={checkIn || localToday()} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /><SearchIcon type="calendar" /></span></label>
      <label>Số khách<span className="search-control guest-number-control"><input type="number" min="1" max="30" step="1" value={guests} onChange={(e) => setGuests(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} inputMode="numeric" aria-label="Số khách" /><SearchIcon type="guests" /></span></label>
      <label>Số phòng<span className="search-control guest-number-control"><input type="number" min="1" max="10" step="1" value={rooms} onChange={(e) => setRooms(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} inputMode="numeric" aria-label="Số phòng" /></span></label>
      <button>Tìm phòng</button>
    </form>
    <section className="catalog-workspace">
      <aside className="catalog-filters">
        <header><div><small>BỘ LỌC</small><h2>Tìm nơi phù hợp</h2></div><button type="button" onClick={resetFilters}>Đặt lại</button></header>
        <div className="filter-group"><h3>Khoảng giá</h3><p>1 phòng, 1 đêm</p><input type="range" min="500000" max="3000000" step="100000" value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} /><div className="price-range"><span>500.000 ₫</span><span>{money(maxPrice)}</span></div></div>
        <div className="filter-group"><h3>Loại phòng</h3><label><input type="radio" name="room-type" checked={!roomType} onChange={() => setRoomType('')} /> Tất cả</label>{roomFilters.map((name) => <label key={name}><input type="radio" name="room-type" checked={roomType === name} onChange={() => setRoomType(name)} /> {name}</label>)}</div>
        <div className="filter-group"><h3>Tiện nghi yêu thích</h3><p>Gợi ý sẽ ưu tiên nơi có các tiện nghi này.</p>{amenityOptions.map((name) => <label key={name}><input type="checkbox" checked={preferredAmenities.includes(name)} onChange={() => toggleAmenity(name)} /> {name}</label>)}</div>
        <div className="filter-group"><h3>Đánh giá sao</h3>{[5, 4, 3, 0].map((rating) => <label key={rating}><input type="radio" name="rating" checked={minRating === rating} onChange={() => setMinRating(rating)} /> {rating ? `${rating} sao trở lên` : 'Tất cả đánh giá'} {rating > 0 && <b>★</b>}</label>)}</div>
      </aside>
      <div className="catalog-results">
        <header><div><small>DANH SÁCH LƯU TRÚ</small><h2>{result.total} homestay phù hợp</h2></div><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recommended">Đề xuất</option><option value="price-low">Giá thấp trước</option><option value="rating">Đánh giá cao</option></select></header>
        {!loading && recommendations.length > 0 && <section className="recommendation-strip" aria-label="Top 5 homestay phù hợp">
          <div className="recommendation-heading"><div><small>TOP-K CÁ NHÂN HÓA</small><h3>Top {recommendations.length} homestay phù hợp với bạn</h3><p>Xếp hạng theo ngân sách, tiện nghi, đánh giá và hành vi trước đó.</p></div><span title={recommendationModelVersion}>Thuật toán: {recommendationModelVersion.startsWith('learned-') ? 'Trọng số đã học' : 'Top-K baseline'}</span></div>
          <div className="recommendation-grid">{recommendations.map((item, index) => <article className={`recommendation-card rank-${index + 1}`} key={item.id}>
            <button className="recommendation-card-main" type="button" onClick={() => openItem(item.id)}>
              <span className="recommendation-cover" style={item.thumbnailUrl ? { backgroundImage: `url('${item.thumbnailUrl}')` } : undefined}><b>#{index + 1}</b><i>{Math.round(Number(item.score) || 0)}/100 phù hợp</i></span>
              <span className="recommendation-content"><strong>{item.name}</strong><small>⌖ {item.district}, {item.province}</small><span className="recommendation-room">{item.roomTypeName}</span><span className="recommendation-score"><i><b style={{ width: `${Math.max(0, Math.min(100, Number(item.score) || 0))}%` }} /></i><small>{Math.round(Number(item.score) || 0)} điểm</small></span></span>
            </button>
            <ul>{item.reasons.map((reason) => <li key={reason}>✓ {reason}</li>)}</ul>
            <footer><span><small>Ước tính cả kỳ nghỉ</small><strong>{money(item.estimatedTotal)}</strong></span><button type="button" onClick={() => openItem(item.id)}>Xem phòng →</button></footer>
          </article>)}</div>
        </section>}
        {!loading && recommendationError && <p className="recommendation-note">{recommendationError}</p>}
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
