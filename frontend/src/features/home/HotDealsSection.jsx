import React, { useEffect, useState } from 'react';
import { apiClient } from '../../shared/api/apiClient.js';
import { toast } from '../../shared/feedback/feedback.js';
import './styles/hot-deals.css';

const money = value => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
const nextDay = iso => { const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Countdown({ until }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <span className="hot-deal-countdown ended">Đã kết thúc</span>;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return <span className="hot-deal-countdown">Còn {h > 0 ? `${h} giờ ` : ''}{m} phút</span>;
}

// "Săn phòng giá rẻ": admin campaign banners (HomeHero) + live last-minute deals. Renders nothing when both are empty,
// so the home page keeps its static layout until there is something to promote.
export default function HotDealsSection({ onOpenHomestay, onBrowseHomestays }) {
  const [banners, setBanners] = useState([]);
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    let active = true;
    apiClient('/home/banners?placement=HomeHero').then(r => active && setBanners(r.items || [])).catch(() => {});
    apiClient('/deals?limit=8').then(r => active && setDeals(r.items || [])).catch(() => {});
    return () => { active = false; };
  }, []);

  const openDeal = d => {
    const checkIn = String(d.checkIn || d.startDate).slice(0, 10);
    const today = new Date(); const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const from = checkIn < todayIso ? todayIso : checkIn;
    onOpenHomestay?.(d.homestayId, { checkIn: from, checkOut: d.checkOut && from === checkIn ? String(d.checkOut).slice(0, 10) : nextDay(from), roomTypeId: d.roomTypeId });
  };
  const openBanner = async b => {
    const link = b.link || {};
    if (link.type === 'Deal') return openDeal(link);
    if (link.type === 'Homestay') return onOpenHomestay?.(link.homestayId);
    if (link.type === 'Search') return onBrowseHomestays?.({ location: link.province });
    if (link.type === 'Voucher') {
      try { await navigator.clipboard?.writeText(link.code); toast.success(`Đã sao chép mã ${link.code}`); } catch { toast.info(`Mã voucher: ${link.code}`); }
      return link.homestayId ? onOpenHomestay?.(link.homestayId) : onBrowseHomestays?.();
    }
  };

  if (!banners.length && !deals.length) return null;
  return (
    <section className="hot-deals-section page-section" id="hot-deals" aria-label="Săn phòng giá rẻ">
      {banners.length > 0 && (
        <div className="hot-deals-banners">
          {banners.map(b => (
            <button type="button" key={b.id} className="hot-deal-banner" onClick={() => openBanner(b)} style={{ backgroundImage: `linear-gradient(90deg, rgba(9,39,95,.82), rgba(9,39,95,.15)), url('${b.imageUrl}')` }}>
              <strong>{b.title}</strong>
              {b.subtitle && <span>{b.subtitle}</span>}
              {b.link?.type === 'Deal' && <Countdown until={b.link.saleEndsAt} />}
            </button>
          ))}
        </div>
      )}
      {deals.length > 0 && (
        <>
          <header className="hot-deals-head">
            <div><p className="kicker dark">SĂN PHÒNG GIÁ RẺ</p><h2>🔥 Deal phút chót tối nay</h2></div>
            <p>Phòng trống vào phút chót với giá giảm sâu. Số lượng có hạn, giá deal không hoàn tiền khi hủy.</p>
          </header>
          <div className="hot-deals-grid">
            {deals.map(d => (
              <button type="button" key={d.id} className="hot-deal-card" onClick={() => openDeal(d)}>
                <div className="hot-deal-image" style={{ backgroundImage: d.image ? `url('${d.image}')` : undefined }}>
                  <span className="hot-deal-badge">−{Number(d.discountPercent)}%</span>
                </div>
                <div className="hot-deal-body">
                  <strong>{d.homestayName}</strong>
                  <small>{d.roomTypeName} · {[d.district, d.province].filter(Boolean).join(', ')}</small>
                  <div className="hot-deal-price"><s>{money(d.basePrice)}</s><b>{money(d.estimatedPrice)}</b><small>/đêm</small></div>
                  <div className="hot-deal-meta"><span>Còn {d.remaining} phòng</span><Countdown until={d.saleEndsAt} /></div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
