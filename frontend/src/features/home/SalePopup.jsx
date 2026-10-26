import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../shared/api/apiClient.js';
import './styles/sale-popup.css';

const money = (value) => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
const shortDate = (iso) => String(iso).slice(0, 10).split('-').reverse().slice(0, 2).join('/');
const DISMISSED_KEY = 'tripio-sale-popup-dismissed';

const wasDismissed = () => { try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; } };
const rememberDismissed = () => { try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode: show again next visit */ } };

function TimeLeft({ until }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return <span className="sale-popup-time ended">Đã ngừng bán</span>;
  const hours = Math.floor(ms / 3600000); const minutes = Math.floor((ms % 3600000) / 60000);
  return <span className="sale-popup-time">⏱ Còn {hours > 0 ? `${hours} giờ ` : ''}{minutes} phút</span>;
}

// Home page popup of rooms on sale (GET /api/sales: last-minute deals + price periods below list price).
// Shown once per browser session; the × in the top-right corner (or Esc / clicking outside) dismisses it.
export default function SalePopup({ onOpenHomestay, onBrowseHomestays }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    if (wasDismissed()) return undefined;
    let active = true; let timer;
    apiClient('/sales?limit=6').then((result) => {
      if (!active || !result?.items?.length) return;
      setItems(result.items);
      timer = setTimeout(() => active && setOpen(true), 900);
    }).catch(() => {});
    return () => { active = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => { rememberDismissed(); setOpen(false); };
  const book = (item) => { close(); onOpenHomestay?.(item.homestayId, { checkIn: String(item.checkIn).slice(0, 10), checkOut: String(item.checkOut).slice(0, 10), roomTypeId: item.roomTypeId }); };

  if (!open || !items.length) return null;
  const [featured, ...others] = items;

  return (
    <div className="sale-popup-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="sale-popup" role="dialog" aria-modal="true" aria-labelledby="sale-popup-title">
        <button ref={closeRef} type="button" className="sale-popup-close" onClick={close} aria-label="Đóng banner ưu đãi">×</button>

        <div className="sale-popup-hero" style={featured.image ? { backgroundImage: `linear-gradient(180deg, rgba(4,22,56,.05) 30%, rgba(4,22,56,.88)), url('${featured.image}')` } : undefined}>
          <span className="sale-popup-badge">−{Number(featured.discountPercent)}%</span>
          <span className={`sale-popup-kind ${featured.kind === 'Deal' ? 'deal' : ''}`}>{featured.kind === 'Deal' ? '🔥 Deal phút chót' : featured.label}</span>
          <div className="sale-popup-hero-text">
            <small>PHÒNG ĐANG GIẢM GIÁ</small>
            <h2 id="sale-popup-title">{featured.homestayName}</h2>
            <p>{featured.roomTypeName} · {featured.district ? `${featured.district}, ` : ''}{featured.province}</p>
          </div>
        </div>

        <div className="sale-popup-body">
          <div className="sale-popup-price">
            <s>{money(featured.originalPrice)}</s>
            <strong>{money(featured.salePrice)}<small>/đêm</small></strong>
          </div>
          <ul className="sale-popup-facts">
            <li>Áp dụng {shortDate(featured.checkIn)}{featured.lastNight && featured.lastNight !== featured.checkIn ? ` – ${shortDate(featured.lastNight)}` : ''}</li>
            {featured.saleEndsAt && <li><TimeLeft until={featured.saleEndsAt} /></li>}
            {featured.remainingRooms != null && <li>Còn {featured.remainingRooms} phòng</li>}
            {featured.nonRefundable && <li className="warn">Không hoàn tiền khi hủy</li>}
          </ul>
          <button type="button" className="sale-popup-cta" onClick={() => book(featured)}>Đặt ngay →</button>

          {others.length > 0 && <>
            <h3>Ưu đãi khác đang diễn ra</h3>
            <ul className="sale-popup-list">
              {others.slice(0, 3).map((item) => (
                <li key={item.key}>
                  <button type="button" onClick={() => book(item)}>
                    {item.image ? <img src={item.image} alt="" loading="lazy" /> : <i aria-hidden="true" />}
                    <span><b>{item.homestayName}</b><small>{item.roomTypeName} · {item.kind === 'Deal' ? 'Deal phút chót' : item.label}</small></span>
                    <span className="sale-popup-list-price"><em>−{Number(item.discountPercent)}%</em><b>{money(item.salePrice)}</b></span>
                  </button>
                </li>
              ))}
            </ul>
          </>}
          {onBrowseHomestays && <button type="button" className="sale-popup-more" onClick={() => { close(); onBrowseHomestays(); }}>Xem tất cả homestay</button>}
        </div>
      </section>
    </div>
  );
}
