import React, { useEffect, useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';
import './HostReviewsPage.css';

const money = v => `${new Intl.NumberFormat('vi-VN').format(Number(v) || 0)}đ`;
const date = v => v ? new Intl.DateTimeFormat('vi-VN').format(new Date(v)) : '—';
const emptySummary = { average: 0, total: 0, distribution: [], pendingReply: 0, responseRate: 0 };

export default function HostReviewsPage({ homestays, onBooking }) {
  const [tab, setTab] = useState('reviews');

  return (
    <section className="host-feedback-page">
      <header>
        <div>
          <small>TRẢI NGHIỆM KHÁCH HÀNG</small>
          <h2>Đánh giá &amp; phản hồi</h2>
          <p>Lắng nghe khách lưu trú, giải quyết kịp thời và xây dựng sự tín nhiệm bền vững.</p>
        </div>
        <nav>
          <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>
            <HostIcon name="star" size={15} />
            <span>Đánh giá ({homestays.length} cơ sở)</span>
          </button>
          <button className={tab === 'customers' ? 'active' : ''} onClick={() => setTab('customers')}>
            <HostIcon name="users" size={15} />
            <span>Danh sách khách hàng</span>
          </button>
        </nav>
      </header>

      {tab === 'reviews' ? (
        <ReviewsTab homestays={homestays} onBooking={onBooking} />
      ) : (
        <CustomersTab />
      )}
    </section>
  );
}

function ReviewsTab({ homestays, onBooking }) {
  const params = new URLSearchParams(location.search);
  const initial = {
    homestayId: params.get('rh') || '',
    rating: params.get('rr') || '',
    reply: params.get('rp') || '',
    from: params.get('rf') || '',
    to: params.get('rt') || '',
    search: params.get('rq') || '',
    sort: params.get('rs') || 'newest'
  };

  const [f, setF] = useState(initial);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const base = { homestayId: f.homestayId, from: f.from, to: f.to };
      const [list, sum] = await Promise.all([
        homestayApi.hostReviews({ ...f, page, pageSize: 8 }),
        homestayApi.hostReviewSummary(base)
      ]);
      setItems(list.items);
      setPages(list.totalPages || 1);
      setSummary(sum);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    [['rh', f.homestayId], ['rr', f.rating], ['rp', f.reply], ['rf', f.from], ['rt', f.to], ['rq', f.search], ['rs', f.sort]].forEach(([k, v]) => v ? q.set(k, v) : q.delete(k));
    history.replaceState({}, '', `${location.pathname}?${q}`);
    const id = setTimeout(load, 180);
    return () => clearTimeout(id);
  }, [f, page]);

  const reset = () => {
    setF({ homestayId: '', rating: '', reply: '', from: '', to: '', search: '', sort: 'newest' });
    setPage(1);
  };

  const distribution = useMemo(() => Object.fromEntries(summary.distribution.map(x => [x.rating, x.count])), [summary]);

  return (
    <>
      <ReviewSummary summary={summary} distribution={distribution} />
      <ReviewFilters value={f} set={x => { setF(x); setPage(1); }} homestays={homestays} reset={reset} />
      {error && (
        <p className="feedback-error" role="alert">
          <HostIcon name="alertCircle" size={16} /> {error}
        </p>
      )}
      {loading ? (
        <Skeleton />
      ) : (
        <div className="review-cards">
          {items.map(x => (
            <ReviewCard key={x.id} item={x} reload={load} onBooking={onBooking} />
          ))}
          {!items.length && (
            <div className="feedback-empty">
              <HostIcon name="star" size={36} color="#94a3b8" />
              <h3>Chưa có đánh giá nào phù hợp</h3>
              <p>Thử xóa bớt bộ lọc hoặc chờ du khách hoàn thành kỳ nghỉ để để lại nhận xét.</p>
            </div>
          )}
        </div>
      )}
      <div className="feedback-pages">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <HostIcon name="chevronLeft" size={14} /> Trang trước
        </button>
        <span>Trang {page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Trang sau <HostIcon name="chevronRight" size={14} />
        </button>
      </div>
    </>
  );
}

function ReviewSummary({ summary, distribution }) {
  return (
    <section className="review-summary">
      <div className="review-score">
        <strong>{Number(summary.average || 0).toFixed(1)}<small>/5</small></strong>
        <span aria-label={`${Number(summary.average || 0).toFixed(1)} trên 5 sao`}>
          {stars(Math.round(summary.average || 0))}
        </span>
        <p>{summary.total} đánh giá tổng thể</p>
      </div>

      <div className="review-bars">
        {[5, 4, 3, 2, 1].map(n => (
          <div key={n}>
            <b>{n}★</b>
            <i>
              <em style={{ width: `${summary.total ? (distribution[n] || 0) / summary.total * 100 : 0}%` }} />
            </i>
            <span>{distribution[n] || 0}</span>
          </div>
        ))}
      </div>

      <div className={`summary-mini ${summary.pendingReply ? 'attention' : ''}`}>
        <small>CHƯA PHẢN HỒI</small>
        <strong>{summary.pendingReply}</strong>
        <span>{summary.pendingReply ? 'Cần bạn xử lý sớm' : 'Đã xử lý chu đáo'}</span>
      </div>

      <div className="summary-mini">
        <small>TỶ LỆ PHẢN HỒI</small>
        <strong>{summary.responseRate}%</strong>
        <span>Trên đánh giá hiển thị</span>
      </div>
    </section>
  );
}

function ReviewFilters({ value, set, homestays, reset }) {
  return (
    <section className="review-filters">
      <input
        value={value.search}
        onChange={e => set({ ...value, search: e.target.value })}
        placeholder="Tìm tên khách hoặc nội dung đánh giá…"
      />
      <select value={value.homestayId} onChange={e => set({ ...value, homestayId: e.target.value })}>
        <option value="">Tất cả Homestay</option>
        {homestays.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select value={value.rating} onChange={e => set({ ...value, rating: e.target.value })}>
        <option value="">Tất cả số sao</option>
        {[5, 4, 3, 2, 1].map(x => <option key={x} value={x}>{x} sao</option>)}
      </select>
      <select value={value.reply} onChange={e => set({ ...value, reply: e.target.value })}>
        <option value="">Tất cả trạng thái phản hồi</option>
        <option value="pending">Chưa phản hồi</option>
        <option value="replied">Đã phản hồi</option>
      </select>
      <input aria-label="Từ ngày" type="date" value={value.from} onChange={e => set({ ...value, from: e.target.value })} />
      <input aria-label="Đến ngày" type="date" value={value.to} onChange={e => set({ ...value, to: e.target.value })} />
      <select value={value.sort} onChange={e => set({ ...value, sort: e.target.value })}>
        <option value="newest">Mới nhất</option>
        <option value="rating-low">Điểm thấp nhất</option>
        <option value="needs-reply">Cần phản hồi trước</option>
      </select>
      <button onClick={reset}>Xóa bộ lọc</button>
    </section>
  );
}

function ReviewCard({ item, reload, onBooking }) {
  const [replying, setReplying] = useState(false);
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const esc = e => e.key === 'Escape' && (setMenu(false), setReporting(false));
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'Xóa phản hồi của bạn?',
      message: 'Đánh giá của khách vẫn được giữ nguyên. Bạn có thể phản hồi lại sau.',
      confirmText: 'Xóa phản hồi',
      variant: 'danger'
    });
    if (ok) {
      try {
        const r = await homestayApi.deleteReviewReply(item.id);
        toast.success(r.message);
        reload();
      } catch (e) {
        toast.error(e.message);
      }
    }
  };

  return (
    <article className={`review-card ${item.rating <= 3 && !item.hostReply ? 'needs-reply' : ''}`}>
      <header>
        {item.customerAvatar ? (
          <img src={item.customerAvatar} alt="" />
        ) : (
          <span>{item.customerName?.[0] || 'K'}</span>
        )}
        <div>
          <b>{item.customerName}</b>
          <em aria-label={`${item.rating} trên 5 sao`}>{stars(item.rating)}</em>
          <small>{date(item.createdAt)}</small>
        </div>
        <button aria-label="Mở menu đánh giá" className="review-menu-btn" onClick={() => setMenu(!menu)}>
          <HostIcon name="moreHorizontal" size={18} />
        </button>
        {menu && (
          <div className="review-menu">
            {item.hostReply && (
              <>
                <button onClick={() => { setReplying(true); setMenu(false); }}>Sửa phản hồi</button>
                <button className="danger" onClick={remove}>Xóa phản hồi</button>
              </>
            )}
            <button onClick={() => { setReporting(true); setMenu(false); }}>Báo cáo vi phạm</button>
          </div>
        )}
      </header>

      <div className="review-chips">
        <span>{item.homestayName}</span>
        <span>{item.roomNames?.join(', ') || 'Chưa xếp phòng'}</span>
        <button onClick={() => onBooking?.(item.bookingId)}>#{item.bookingCode}</button>
        {item.isReported && <span className="reported-chip"><HostIcon name="flag" size={12} /> Đã báo cáo</span>}
      </div>

      {!item.hostReply && (
        <span className={`reply-state ${item.rating <= 3 ? 'urgent' : ''}`}>
          {item.rating <= 3 ? '⚠ Cần phản hồi ngay' : 'Chưa phản hồi'}
        </span>
      )}

      <p className="review-text">
        {expanded || item.comment?.length <= 240
          ? item.comment || 'Khách không để lại nội dung.'
          : `${item.comment.slice(0, 240)}…`}
        {item.comment?.length > 240 && (
          <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        )}
      </p>

      {item.hostReply && (
        <div className="host-reply">
          <header>
            <b><HostIcon name="check" size={13} /> Phản hồi từ chủ nhà</b>
            <small>{date(item.hostRepliedAt)}</small>
          </header>
          <p>{item.hostReply}</p>
        </div>
      )}

      {replying ? (
        <ReplyBox item={item} close={() => setReplying(false)} reload={reload} />
      ) : (
        <button className="reply-button" onClick={() => setReplying(true)}>
          {item.hostReply ? 'Sửa phản hồi' : 'Trả lời nhận xét'}
        </button>
      )}

      {reporting && <ReportBox item={item} close={() => setReporting(false)} reload={reload} />}
    </article>
  );
}

function ReplyBox({ item, close, reload }) {
  const [text, setText] = useState(item.hostReply || '');
  const [busy, setBusy] = useState(false);
  const error = !text.trim();
  const templates = [
    'Cảm ơn bạn đã lựa chọn Tripio và dành thời gian đánh giá trải nghiệm!',
    'Chúng tôi rất tiếc về trải nghiệm chưa trọn vẹn và sẽ khắc phục ngay lập tức.',
    'Rất mong có cơ hội được đón tiếp bạn và gia đình trong chuyến đi sắp tới!'
  ];

  const submit = async () => {
    if (error || busy) return;
    setBusy(true);
    try {
      const r = await homestayApi.updateReviewReply(item.id, text.trim());
      toast.success(r.message);
      close();
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reply-box">
      <label>
        Phản hồi công khai của bạn <span>{text.length}/500</span>
        <textarea
          autoFocus
          maxLength="500"
          rows="4"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Nhập nội dung phản hồi chân thành, chu đáo…"
        />
      </label>
      <div className="reply-templates">
        {templates.map(x => (
          <button key={x} onClick={() => setText(x)}>{x.slice(0, 32)}…</button>
        ))}
      </div>
      <footer>
        <button className="btn-cancel" onClick={close}>Hủy</button>
        <button className="btn-submit" disabled={error || busy} onClick={submit}>
          {busy ? 'Đang gửi…' : 'Gửi phản hồi'}
        </button>
      </footer>
    </div>
  );
}

function ReportBox({ item, close, reload }) {
  const [reason, setReason] = useState('Spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const r = await homestayApi.reportReview(item.id, { reason, detail });
      toast.success(r.message);
      close();
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-box">
      <b>Báo cáo đánh giá vi phạm chính sách</b>
      <select value={reason} onChange={e => setReason(e.target.value)}>
        <option value="Spam">Spam, quảng cáo trái phép</option>
        <option value="Abusive">Ngôn từ xúc phạm, tiêu cực quá mức</option>
        <option value="FalseInformation">Thông tin sai sự thật về dịch vụ</option>
        <option value="Other">Lý do khác</option>
      </select>
      <textarea
        maxLength="500"
        value={detail}
        onChange={e => setDetail(e.target.value)}
        placeholder="Mô tả cụ thể để ban quản trị Tripio hỗ trợ xử lý…"
      />
      <footer>
        <button className="btn-cancel" onClick={close}>Hủy</button>
        <button className="btn-danger" disabled={busy} onClick={send}>
          {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
        </button>
      </footer>
    </div>
  );
}

function CustomersTab() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('bookings');
  const [data, setData] = useState({ items: [], totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await homestayApi.hostCustomers({ search: q, sort, page, pageSize: 10 }));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(load, 180);
    return () => clearTimeout(id);
  }, [q, sort, page]);

  const open = async id => {
    try {
      setCustomer(await homestayApi.hostCustomerDetail(id));
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <div className="customer-toolbar">
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }}
          placeholder="Tìm tên khách hàng, số điện thoại hoặc email…"
        />
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="bookings">Sắp xếp: Số lần đặt nhiều nhất</option>
          <option value="spending">Sắp xếp: Tổng chi tiêu cao nhất</option>
        </select>
      </div>

      {error && <p className="feedback-error"><HostIcon name="alertCircle" size={16} /> {error}</p>}

      {loading ? (
        <Skeleton />
      ) : (
        <div className="customer-table">
          <div className="customer-head">
            <b>Khách hàng</b>
            <b>Thông tin liên hệ</b>
            <b>Lượt đặt</b>
            <b>Tổng chi tiêu</b>
            <b>Lần lưu trú gần nhất</b>
            <b />
          </div>
          {data.items.map(x => (
            <button key={x.id} className="customer-row-btn" onClick={() => open(x.id)}>
              <span className="customer-person">
                <i>{x.fullName[0]}</i>
                <b>
                  {x.fullName}
                  {x.completedCount >= 2 && <em>Khách quen</em>}
                </b>
              </span>
              <span>
                {x.phoneNumber || '—'}
                <small>{x.email}</small>
              </span>
              <strong>{x.bookingCount} đơn</strong>
              <strong>{money(x.totalSpent)}</strong>
              <span>{date(x.lastStay)}</span>
              <b className="link-detail">Chi tiết →</b>
            </button>
          ))}
          {!data.items.length && (
            <div className="feedback-empty">
              <HostIcon name="users" size={36} color="#94a3b8" />
              <h3>Chưa có hồ sơ khách hàng</h3>
              <p>Khách hàng đã đặt phòng tại các Homestay của bạn sẽ được lưu hồ sơ tự động tại đây.</p>
            </div>
          )}
        </div>
      )}

      <div className="feedback-pages">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <HostIcon name="chevronLeft" size={14} /> Trước
        </button>
        <span>Trang {page} / {data.totalPages || 1}</span>
        <button disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
          Sau <HostIcon name="chevronRight" size={14} />
        </button>
      </div>

      {customer && <CustomerDrawer data={customer} close={() => setCustomer(null)} reload={load} />}
    </>
  );
}

function CustomerDrawer({ data, close, reload }) {
  const [note, setNote] = useState(data.note || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const esc = e => e.key === 'Escape' && close();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [close]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await homestayApi.saveHostCustomerNote(data.customer.id, note);
      toast.success(r.message);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="customer-drawer-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <aside role="dialog" aria-modal="true">
        <header>
          <div>
            <small>HỒ SƠ KHÁCH HÀNG</small>
            <h2>{data.customer.fullName}</h2>
          </div>
          <button onClick={close} aria-label="Đóng">
            <HostIcon name="close" size={20} />
          </button>
        </header>

        <section className="customer-contact">
          <a href={`tel:${data.customer.phoneNumber || ''}`}>
            <HostIcon name="phone" size={14} />
            <span>{data.customer.phoneNumber || 'Chưa cập nhật SĐT'}</span>
          </a>
          <a href={`mailto:${data.customer.email}`}>
            <HostIcon name="mail" size={14} />
            <span>{data.customer.email}</span>
          </a>
        </section>

        <section>
          <h3>Lịch sử đặt phòng ({data.bookings.length})</h3>
          {data.bookings.map(x => (
            <article key={x.id}>
              <b>{x.bookingCode} · {x.homestayName}</b>
              <span>{x.checkInDate} → {x.checkOutDate}</span>
              <small>{money(x.totalAmount)} · {x.status}</small>
            </article>
          ))}
        </section>

        <section>
          <h3>Đánh giá từ khách</h3>
          {data.reviews.map(x => (
            <article key={x.id}>
              <b>{stars(x.rating)} · {x.homestayName}</b>
              <p>{x.comment || 'Không có nội dung'}</p>
            </article>
          ))}
          {!data.reviews.length && <p className="no-review-text">Khách chưa để lại đánh giá nào.</p>}
        </section>

        <section className="customer-note">
          <h3>Ghi chú nội bộ về khách</h3>
          <textarea
            maxLength="1000"
            rows="4"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Sở thích, yêu cầu phòng, lưu ý phục vụ đặc biệt cho các lần tới…"
          />
          <button disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu ghi chú'}</button>
        </section>
      </aside>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="feedback-skeleton">
      {[1, 2, 3].map(x => <i key={x} />)}
    </div>
  );
}

function stars(n) {
  return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}
