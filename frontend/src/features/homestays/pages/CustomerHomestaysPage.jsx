import React, { useEffect, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { recordRecommendationEvent } from '../api/recommendationEvents.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import GuestPickerDropdown from '../../../shared/components/GuestPickerDropdown.jsx';
import pineHomestayImage from '../../../../assets/f6cd6879081dc8e8d4ff18669308ea86.jpg';
import azureHomestayImage from '../../../../assets/ecf184f6b6cd2b6e2aa898ff3195ab7e.jpg';
import sunsetHomestayImage from '../../../../assets/2fc6b619bb0af3dc94971c099d25bbae.jpg';
import listHomeBanner from '../../../../assets/figma/listhome_banner.jpg';

const money = (value) => value == null ? 'Li├¬n hß╗ç' : `${new Intl.NumberFormat('vi-VN').format(value)} Γé½`;
const covers = [pineHomestayImage, azureHomestayImage, sunsetHomestayImage];
const roomFilters = ['Ph├▓ng ─æ╞ín', 'Ph├▓ng ─æ├┤i', 'Ph├▓ng c├│ ban c├┤ng', 'Ph├▓ng gia ─æ├¼nh'];

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

export default function CustomerHomestaysPage({ user, onBack, onOpen, onBookings, onAccount }) {
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({ items: [], total: 0 });
  const [maxPrice, setMaxPrice] = useState(3000000);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestsConfig, setGuestsConfig] = useState({ adults: 2, children: 0, rooms: 1 });
  const [roomType, setRoomType] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('recommended');
  const [page, setPage] = useState(1);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('tripio-favorites') || '[]'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const totalGuests = guestsConfig.adults + guestsConfig.children;
  const criteria = (targetPage = page) => ({ search, checkIn, checkOut, guests: totalGuests, maxPrice, roomType, minRating, sort, page: targetPage, pageSize: 12 });

  const load = async (targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      if ((checkIn && !checkOut) || (!checkIn && checkOut)) throw new Error('Vui l├▓ng chß╗ìn ─æß║ºy ─æß╗º ng├áy nhß║¡n v├á ng├áy trß║ú ph├▓ng.');
      if (checkIn && checkOut && checkOut <= checkIn) throw new Error('Ng├áy trß║ú ph├▓ng phß║úi sau ng├áy nhß║¡n ph├▓ng.');
      const response = await homestayApi.list(criteria(targetPage));
      setResult(response);
      setPage(targetPage);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, [maxPrice, roomType, minRating, sort]);

  const resetFilters = () => {
    setMaxPrice(3000000);
    setRoomType('');
    setMinRating(0);
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

      {/* Hero Banner ΓÇö h├¼nh ß║únh listhome_banner nguy├¬n bß║ún, kh├┤ng chß╗», kh├┤ng phß╗º m├áu */}
      <section className="catalog-hero">
        <img
          src={listHomeBanner}
          alt="Homestay Banner"
          className="catalog-hero-img"
        />
      </section>

      {/* Search Bar ΓÇö ─æß╗ông bß╗Ö 100% vß╗¢i search-bar trang chß╗º */}
      <form
        className="search-bar catalog-search"
        onSubmit={(event) => {
          event.preventDefault();
          load(1);
        }}
      >
        <label>
          ─Éß╗ïa ─æiß╗âm hoß║╖c t├¬n homestay
          <span className="search-control">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Bß║ín muß╗æn ─æß║┐n ─æ├óu?"
            />
            <i><Icon name="location" /></i>
          </span>
        </label>

        <label>
          Ng├áy nhß║¡n
          <span className="search-control">
            <input
              type="text"
              placeholder="Chß╗ìn ng├áy nhß║¡n"
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
          Ng├áy trß║ú
          <span className="search-control">
            <input
              type="text"
              placeholder="Chß╗ìn ng├áy trß║ú"
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

        <button type="submit">T├¼m ph├▓ng</button>
      </form>

      {/* Workspace: Bß╗Ö lß╗ìc b├¬n tr├íi + Danh s├ích homestay b├¬n phß║úi */}
      <section className="catalog-workspace">
        {/* Bß╗Ö lß╗ìc b├¬n tr├íi */}
        <aside className="catalog-filters">
          <header>
            <div>
              <small>Bß╗ÿ Lß╗îC</small>
              <h2>T├¼m n╞íi ph├╣ hß╗úp</h2>
            </div>
            <button type="button" onClick={resetFilters}>─Éß║╖t lß║íi</button>
          </header>

          <div className="filter-group">
            <h3>Khoß║úng gi├í</h3>
            <p>1 ph├▓ng, 1 ─æ├¬m</p>
            <input
              type="range"
              min="500000"
              max="3000000"
              step="100000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
            />
            <div className="price-range">
              <span>500.000 Γé½</span>
              <span>{money(maxPrice)}</span>
            </div>
          </div>

          <div className="filter-group">
            <h3>Loß║íi ph├▓ng</h3>
            <label>
              <input
                type="radio"
                name="room-type"
                checked={!roomType}
                onChange={() => setRoomType('')}
              />
              <span>Tß║Ñt cß║ú</span>
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
            <h3>─É├ính gi├í sao</h3>
            {[5, 4, 3, 0].map((rating) => (
              <label key={rating}>
                <input
                  type="radio"
                  name="rating"
                  checked={minRating === rating}
                  onChange={() => setMinRating(rating)}
                />
                <span>{rating ? `${rating} sao trß╗ƒ l├¬n` : 'Tß║Ñt cß║ú ─æ├ính gi├í'}</span>
                {rating > 0 && <b>Γÿà</b>}
              </label>
            ))}
          </div>
        </aside>

        {/* Danh s├ích kß║┐t quß║ú b├¬n phß║úi */}
        <div className="catalog-results">
          <header>
            <div>
              <small>DANH S├üCH L╞»U TR├Ü</small>
              <h2>{result.total} homestay ph├╣ hß╗úp</h2>
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recommended">─Éß╗ü xuß║Ñt</option>
              <option value="price-low">Gi├í thß║Ñp tr╞░ß╗¢c</option>
              <option value="rating">─É├ính gi├í cao</option>
            </select>
          </header>

          {loading && <p className="state-message">─Éang tß║úi danh s├ích homestay...</p>}
          {error && <p className="state-message error">{error}</p>}
          {!loading && !error && result.items.length === 0 && (
            <p className="state-message">Kh├┤ng t├¼m thß║Ñy homestay ph├╣ hß╗úp vß╗¢i bß╗Ö lß╗ìc.</p>
          )}

          {/* Grid thß║╗ homestay ΓÇö ─æß╗ông bß╗Ö 100% vß╗¢i stay-card trang chß╗º */}
          <div className="catalog-stay-grid">
            {result.items.map((item, index) => {
              const isFav = favorites.includes(item.id);
              const bgImage = item.thumbnailUrl || covers[index % covers.length];
              const locationText = `${item.district ? item.district + ', ' : ''}${item.province || 'Viß╗çt Nam'}`;
              const priceFormatted = typeof item.fromPrice === 'number'
                ? `Tß╗½ ${new Intl.NumberFormat('vi-VN').format(item.fromPrice)} ─æ`
                : money(item.fromPrice);
              const ratingFormatted = item.reviewCount && item.averageRating
                ? Number(item.averageRating).toFixed(1).replace('.', ',')
                : 'Mß╗¢i';

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
                      aria-label="Y├¬u th├¡ch"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                    >
                      <Icon name="heart" filled={isFav} />
                    </button>
                  </div>

                  {/* Rectangle blur overlay W 350 H 185 tß╗½ Figma */}
                  <div className="stay-blur-overlay" aria-hidden="true" />

                  {/* Card info */}
                  <div className="stay-info">
                    <div className="stay-title-row">
                      <h3>{item.name}</h3>
                      <span className="stay-rating-badge">
                        {ratingFormatted} {item.reviewCount > 0 && <span className="star-icon">Γÿà</span>}
                      </span>
                    </div>

                    <p>
                      {item.description || (item.availableRoomCount ? `C├▓n ${item.availableRoomCount} ph├▓ng ph├╣ hß╗úp. ─Éiß╗âm dß╗½ng ch├ón ho├án hß║úo vß╗¢i ─æß║ºy ─æß╗º tiß╗çn nghi.` : 'Kh├ím ph├í ─æiß╗âm dß╗½ng ch├ón ho├án hß║úo vß╗¢i trß║úi nghiß╗çm nghß╗ë d╞░ß╗íng tiß╗çn nghi v├á ─æß║ºy cß║úm hß╗⌐ng.')}
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
                        ─Éß║╖t ph├▓ng
                      </button>
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Ph├ón trang */}
          {!loading && !error && result.total > 0 && (
            <nav className="catalog-pagination">
              <button disabled={page <= 1} onClick={() => load(page - 1)}>
                ΓåÉ Tr╞░ß╗¢c
              </button>
              <span>
                Trang {page} / {pageCount}
              </span>
              <button disabled={page >= pageCount} onClick={() => load(page + 1)}>
                Sau ΓåÆ
              </button>
            </nav>
          )}
        </div>
      </section>
    </main>
  );
}
