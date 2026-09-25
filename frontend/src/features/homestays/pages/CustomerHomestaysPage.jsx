import React, { useEffect, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { recordRecommendationEvent } from '../api/recommendationEvents.js';
import { freshImageUrl } from '../../../shared/utils/freshImageUrl.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import GuestPickerDropdown from '../../../shared/components/GuestPickerDropdown.jsx';
import pineHomestayImage from '../../../../assets/f6cd6879081dc8e8d4ff18669308ea86.jpg';
import azureHomestayImage from '../../../../assets/ecf184f6b6cd2b6e2aa898ff3195ab7e.jpg';
import sunsetHomestayImage from '../../../../assets/2fc6b619bb0af3dc94971c099d25bbae.jpg';
import listHomeBanner from '../../../../assets/figma/listhome_banner.jpg';

const money = (value) => value == null ? 'Liên hệ' : `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
const covers = [pineHomestayImage, azureHomestayImage, sunsetHomestayImage];
const roomFilters = ['Phòng đơn', 'Phòng đôi', 'Phòng có ban công', 'Phòng gia đình'];
const amenityOptions = ['WiFi', 'Bể bơi', 'Bếp', 'Ban công', 'Điều hòa', 'Chỗ đỗ xe', 'Máy giặt', 'Cho phép thú cưng'];

function Icon({ name, filled = false, size }) {
  const icons = {
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    calendar: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    heart: (
      <path
        d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6Z"
        fill={filled ? '#e94a62' : 'none'}
        stroke={filled ? '#e94a62' : 'currentColor'}
      />
    ),
    star: (
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#FFB700"
        stroke="#FFB700"
      />
    ),
  };

  const defaultSize = name === 'location' ? 13 : name === 'heart' ? 16 : 15;
  const iconSize = size || defaultSize;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={iconSize}
      height={iconSize}
      style={{ width: iconSize, height: iconSize, flexShrink: 0 }}
    >
      {icons[name]}
    </svg>
  );
}

export default function CustomerHomestaysPage({ user, onBack, onOpen, onBookings, onAccount, refreshKey = 0, initialSearch }) {
  const [search, setSearch] = useState(initialSearch?.search || '');
  const [location, setLocation] = useState(initialSearch?.location || '');
  const [result, setResult] = useState({ items: [], total: 0 });
  const [maxPrice, setMaxPrice] = useState(3000000);
  const [checkIn, setCheckIn] = useState(initialSearch?.checkIn || '');
  const [checkOut, setCheckOut] = useState(initialSearch?.checkOut || '');
  const [guestsConfig, setGuestsConfig] = useState({
    adults: initialSearch?.adults || initialSearch?.guests || 2,
    children: initialSearch?.children || 0,
    rooms: initialSearch?.rooms || 1,
  });
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

  const totalGuests = guestsConfig.adults + guestsConfig.children;
  const criteria = (targetPage = page) => ({
    search,
    location,
    checkIn,
    checkOut,
    guests: totalGuests,
    rooms: guestsConfig.rooms,
    maxPrice,
    roomType,
    minRating,
    sort,
    page: targetPage,
    pageSize: 12,
  });

  const load = async (targetPage = 1) => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError('');
    try {
      if ((checkIn && !checkOut) || (!checkIn && checkOut)) throw new Error('Vui lòng chọn đầy đủ ngày nhận và ngày trả phòng.');
      if (checkIn && checkOut && checkOut <= checkIn) throw new Error('Ngày trả phòng phải sau ngày nhận phòng.');
      const nights = checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000)) : 1;

      const [catalogResult, recommendationResult] = await Promise.allSettled([
        homestayApi.list(criteria(targetPage)),
        location
          ? Promise.resolve({ items: [], modelVersion: '' })
          : homestayApi.recommendations({
              search,
              checkIn,
              checkOut,
              guests: totalGuests,
              rooms: guestsConfig.rooms,
              totalBudget: maxPrice * guestsConfig.rooms * nights,
              amenities: preferredAmenities,
              roomType,
              minRating,
              topK: 5,
            }),
      ]);

      if (requestId !== latestRequest.current) return;
      if (catalogResult.status === 'rejected') throw catalogResult.reason;

      const response = catalogResult.value;
      const imageVersion = `${Date.now()}-${refreshKey}`;
      setResult({
        ...response,
        items: response.items.map((item) => ({
          ...item,
          thumbnailUrl: freshImageUrl(item.thumbnailUrl, imageVersion),
        })),
      });
      setPage(targetPage);

      setRecommendations(
        recommendationResult.status === 'fulfilled'
          ? (recommendationResult.value.items || []).map((item) => ({
              ...item,
              thumbnailUrl: freshImageUrl(item.thumbnailUrl, imageVersion),
            }))
          : []
      );
      setRecommendationModelVersion(
        recommendationResult.status === 'fulfilled'
          ? recommendationResult.value.modelVersion || 'baseline'
          : ''
      );
      setRecommendationError(
        recommendationResult.status === 'rejected' ? 'Chưa tải được gợi ý lúc này.' : ''
      );

      if (targetPage === 1) {
        recordRecommendationEvent({
          eventType: 'search',
          search: search.trim(),
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          guests: totalGuests,
          rooms: guestsConfig.rooms,
          totalBudget: maxPrice * guestsConfig.rooms * nights,
          amenities: preferredAmenities,
          recommendedIds:
            recommendationResult.status === 'fulfilled'
              ? (recommendationResult.value.items || []).map((item) => item.id)
              : [],
        }).catch(() => {});
      }
    } catch (e) {
      if (requestId === latestRequest.current) {
        setError(e.message);
        setRecommendations([]);
        setRecommendationModelVersion('');
      }
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [maxPrice, roomType, minRating, sort, preferredAmenities, refreshKey]);

  const resetFilters = () => {
    setMaxPrice(3000000);
    setRoomType('');
    setMinRating(0);
    setPreferredAmenities([]);
  };

  const toggleAmenity = (name) => {
    setPreferredAmenities((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    );
  };

  const toggleFavorite = (id) => {
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next);
    localStorage.setItem('tripio-favorites', JSON.stringify(next));
  };

  const openItem = (id) => {
    recordRecommendationEvent('click', id).catch(() => {});
    onOpen(id, criteria(page));
  };
  const pageCount = Math.max(1, Math.ceil(result.total / (result.pageSize || 12)));

  return (
    <main className="catalog-page catalog-redesign">
      <CustomerNav
        active="homestays"
        user={user}
        onHome={onBack}
        onHomestays={() => {}}
        onBookings={onBookings}
        onAccount={onAccount}
        transparentAtTop={true}
      />

      {/* Hero Banner — hình ảnh listhome_banner nguyên bản, không chữ, không phủ màu */}
      <section className="catalog-hero">
        <img
          src={listHomeBanner}
          alt="Homestay Banner"
          className="catalog-hero-img"
        />
      </section>

      {/* Search Bar — đồng bộ 100% với search-bar trang chủ */}
      <form
        className="search-bar catalog-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(1);
        }}
      >
        <label>
          Địa điểm hoặc tên homestay
          <span className="search-control">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setLocation('');
              }}
              placeholder="Bạn muốn đến đâu?"
            />
            <i><Icon name="location" /></i>
          </span>
        </label>

        <label>
          Ngày nhận
          <span className="search-control">
            <input
              type="text"
              placeholder="Chọn ngày nhận"
              value={checkIn}
              onChange={(e) => {
                setCheckIn(e.target.value);
                if (checkOut && checkOut <= e.target.value) setCheckOut('');
              }}
              onFocus={(e) => { e.currentTarget.type = 'date'; }}
              onBlur={(e) => { if (!e.currentTarget.value) e.currentTarget.type = 'text'; }}
            />
            <i><Icon name="calendar" /></i>
          </span>
        </label>

        <label>
          Ngày trả
          <span className="search-control">
            <input
              type="text"
              placeholder="Chọn ngày trả"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              onFocus={(e) => { e.currentTarget.type = 'date'; }}
              onBlur={(e) => { if (!e.currentTarget.value) e.currentTarget.type = 'text'; }}
            />
            <i><Icon name="calendar" /></i>
          </span>
        </label>

        <GuestPickerDropdown
          value={guestsConfig}
          onChange={setGuestsConfig}
        />

        <button type="submit">Tìm phòng</button>
      </form>

      {/* Workspace: Bộ lọc bên trái + Danh sách homestay bên phải */}
      <section className="catalog-workspace">
        {/* Bộ lọc bên trái */}
        <aside className="catalog-filters">
          <header>
            <div>
              <small>BỘ LỌC</small>
              <h2>Tìm nơi phù hợp</h2>
            </div>
            <button type="button" onClick={resetFilters}>Đặt lại</button>
          </header>

          <div className="filter-group">
            <h3>Khoảng giá</h3>
            <p>1 phòng, 1 đêm</p>
            <input
              type="range"
              min="500000"
              max="3000000"
              step="100000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
            <div className="price-range">
              <span>500.000 ₫</span>
              <span>{money(maxPrice)}</span>
            </div>
          </div>

          <div className="filter-group">
            <h3>Loại phòng</h3>
            <label>
              <input
                type="radio"
                name="room-type"
                checked={!roomType}
                onChange={() => setRoomType('')}
              />
              <span>Tất cả</span>
            </label>
            {roomFilters.map((name) => (
              <label key={name}>
                <input
                  type="radio"
                  name="room-type"
                  checked={roomType === name}
                  onChange={() => setRoomType(name)}
                />
                <span>{name}</span>
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Tiện nghi yêu thích</h3>
            <p>Gợi ý sẽ ưu tiên nơi có các tiện nghi này.</p>
            {amenityOptions.map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={preferredAmenities.includes(name)}
                  onChange={() => toggleAmenity(name)}
                />
                <span>{name}</span>
              </label>
            ))}
          </div>

          <div className="filter-group">
            <h3>Đánh giá sao</h3>
            {[5, 4, 3, 0].map((rating) => (
              <label key={rating}>
                <input
                  type="radio"
                  name="rating"
                  checked={minRating === rating}
                  onChange={() => setMinRating(rating)}
                />
                <span>{rating ? `${rating} sao trở lên` : 'Tất cả đánh giá'}</span>
                {rating > 0 && <b>★</b>}
              </label>
            ))}
          </div>
        </aside>

        {/* Danh sách kết quả bên phải */}
        <div className="catalog-results">
          <header>
            <div>
              <small>DANH SÁCH LƯU TRÚ</small>
              <h2>{result.total} homestay phù hợp</h2>
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recommended">Đề xuất</option>
              <option value="price-low">Giá thấp trước</option>
              <option value="rating">Đánh giá cao</option>
            </select>
          </header>

          {/* Top-K homestay cá nhân hóa phù hợp */}
          {!loading && recommendations.length > 0 && (
            <section className="recommendation-strip" aria-label="Top 5 homestay phù hợp">
              <div className="recommendation-heading">
                <div>
                  <small>TOP-K CÁ NHÂN HÓA</small>
                  <h3>Top {recommendations.length} homestay phù hợp với bạn</h3>
                  <p>Xếp hạng theo ngân sách, tiện nghi, đánh giá và hành vi trước đó.</p>
                </div>
                <span title={recommendationModelVersion}>
                  Thuật toán: {recommendationModelVersion.startsWith('learned-') ? 'Trọng số đã học' : 'Top-K baseline'}
                </span>
              </div>
              <div className="recommendation-grid">
                {recommendations.map((item, index) => (
                  <article className={`recommendation-card rank-${index + 1}`} key={item.id}>
                    <button className="recommendation-card-main" type="button" onClick={() => openItem(item.id)}>
                      <span className="recommendation-cover" style={item.thumbnailUrl ? { backgroundImage: `url('${item.thumbnailUrl}')` } : undefined}>
                        <b>#{index + 1}</b>
                        <i>{Math.round(Number(item.score) || 0)}/100 phù hợp</i>
                      </span>
                      <span className="recommendation-content">
                        <strong>{item.name}</strong>
                        <small>⌖ {item.district}, {item.province}</small>
                        <span className="recommendation-room">{item.roomTypeName}</span>
                        <span className="recommendation-score">
                          <i><b style={{ width: `${Math.max(0, Math.min(100, Number(item.score) || 0))}%` }} /></i>
                          <small>{Math.round(Number(item.score) || 0)} điểm</small>
                        </span>
                      </span>
                    </button>
                    <ul>{item.reasons?.map((reason) => <li key={reason}>✓ {reason}</li>)}</ul>
                    <footer>
                      <span>
                        <small>Ước tính cả kỳ nghỉ</small>
                        <strong>{money(item.estimatedTotal)}</strong>
                      </span>
                      <button type="button" onClick={() => openItem(item.id)}>Xem phòng →</button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>
          )}
          {!loading && recommendationError && <p className="recommendation-note">{recommendationError}</p>}

          {loading && <p className="state-message">Đang tải danh sách homestay...</p>}
          {error && <p className="state-message error">{error}</p>}
          {!loading && !error && result.items.length === 0 && (
            <p className="state-message">Không tìm thấy homestay phù hợp với bộ lọc.</p>
          )}

          {/* Grid thẻ homestay — đồng bộ 100% với stay-card trang chủ */}
          <div className="catalog-stay-grid">
            {result.items.map((item, index) => {
              const isFav = favorites.includes(item.id);
              const bgImage = item.thumbnailUrl || covers[index % covers.length];
              const locationText = `${item.district ? item.district + ', ' : ''}${item.province || 'Việt Nam'}`;
              const priceFormatted = typeof item.fromPrice === 'number'
                ? `Từ ${new Intl.NumberFormat('vi-VN').format(item.fromPrice)} đ`
                : money(item.fromPrice);
              const ratingFormatted = item.reviewCount && item.averageRating
                ? Number(item.averageRating).toFixed(1).replace('.', ',')
                : 'Mới';

              return (
                <article
                  className="stay-card catalog-card-item"
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openItem(item.id)}
                >
                  {/* Background Image */}
                  <img
                    className="stay-card-bg"
                    src={bgImage}
                    alt={item.name}
                    draggable="false"
                  />

                  {/* Top: Location Badge | Heart Button */}
                  <div className="stay-top">
                    <span className="stay-location-badge">
                      <Icon name="location" />
                      <span>{locationText}</span>
                    </span>

                    <button
                      type="button"
                      className={`stay-heart-btn ${isFav ? 'active' : ''}`}
                      aria-label="Yêu thích"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                    >
                      <Icon name="heart" filled={isFav} />
                    </button>
                  </div>

                  {/* Rectangle blur overlay W 350 H 185 từ Figma */}
                  <div className="stay-blur-overlay" aria-hidden="true" />

                  {/* Card info */}
                  <div className="stay-info">
                    <div className="stay-title-row">
                      <h3>{item.name}</h3>
                      <span className="stay-rating-badge">
                        {ratingFormatted} {item.reviewCount > 0 && <span className="star-icon">★</span>}
                      </span>
                    </div>

                    <p>
                      {item.description || (item.availableRoomCount ? `Còn ${item.availableRoomCount} phòng phù hợp. Điểm dừng chân hoàn hảo với đầy đủ tiện nghi.` : 'Khám phá điểm dừng chân hoàn hảo với trải nghiệm nghỉ dưỡng tiện nghi và đầy cảm hứng.')}
                    </p>

                    <footer>
                      <b>{priceFormatted}</b>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openItem(item.id);
                        }}
                      >
                        Đặt phòng
                      </button>
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Phân trang */}
          {!loading && !error && result.total > 0 && (
            <nav className="catalog-pagination">
              <button disabled={page <= 1} onClick={() => load(page - 1)}>
                ← Trước
              </button>
              <span>
                Trang {page} / {pageCount}
              </span>
              <button disabled={page >= pageCount} onClick={() => load(page + 1)}>
                Sau →
              </button>
            </nav>
          )}
        </div>
      </section>
    </main>
  );
}
