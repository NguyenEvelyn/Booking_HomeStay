import React, { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi } from '../api/notificationsApi.js';
import { timeAgo } from '../utils/notificationLink.js';
import './NotificationBell.css';

const POLL_MS = 60_000;

// Bell with unread badge + dropdown, shared by the home page, customer pages, host and admin dashboards.
// Polls the cheap unread-count endpoint every minute and when the tab regains focus.
export default function NotificationBell({ user, onNavigate, tone = 'dark' }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const wrapRef = useRef(null);

  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then((result) => setCount(result?.count || 0)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    refreshCount();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refreshCount(); }, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [user, refreshCount]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!wrapRef.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [open]);

  const load = async (before) => {
    setLoading(true);
    try {
      const result = await notificationsApi.list(before);
      setItems((current) => before ? [...current, ...(result.items || [])] : (result.items || []));
      setHasMore(Boolean(result.hasMore));
    } catch { /* keep what is shown */ } finally { setLoading(false); }
  };

  const toggle = () => { const next = !open; setOpen(next); if (next) { load(); refreshCount(); } };

  const pick = async (item) => {
    setOpen(false);
    if (!item.isRead) {
      setItems((current) => current.map((x) => x.id === item.id ? { ...x, isRead: true } : x));
      setCount((value) => Math.max(0, value - 1));
      notificationsApi.read(item.id).catch(() => {});
    }
    if (item.link) onNavigate?.(item.link);
  };

  const readAll = async () => {
    setItems((current) => current.map((x) => ({ ...x, isRead: true })));
    setCount(0);
    notificationsApi.readAll().catch(() => refreshCount());
  };

  if (!user) return null;
  return (
    <div className={`notify-wrap tone-${tone}`} ref={wrapRef}>
      <button type="button" className="notify-bell" onClick={toggle} aria-label={count ? `Thông báo, ${count} chưa đọc` : 'Thông báo'} aria-haspopup="true" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="notify-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="notify-panel" role="dialog" aria-label="Thông báo">
          <header>
            <b>Thông báo</b>
            {items.some((x) => !x.isRead) && <button type="button" onClick={readAll}>Đánh dấu đã đọc tất cả</button>}
          </header>
          <div className="notify-list">
            {items.map((item) => (
              <button type="button" key={item.id} className={`notify-item ${item.isRead ? '' : 'unread'}`} onClick={() => pick(item)}>
                <i aria-hidden="true" />
                <span>
                  <b>{item.title}</b>
                  <small>{item.body}</small>
                  <em>{timeAgo(item.createdAt)}</em>
                </span>
              </button>
            ))}
            {!loading && items.length === 0 && <p className="notify-empty">Bạn chưa có thông báo nào.</p>}
            {loading && <p className="notify-empty">Đang tải…</p>}
          </div>
          {hasMore && !loading && <footer><button type="button" onClick={() => load(items[items.length - 1]?.id)}>Xem thông báo cũ hơn</button></footer>}
        </div>
      )}
    </div>
  );
}
