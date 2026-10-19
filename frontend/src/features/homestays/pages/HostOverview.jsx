import React, { useEffect, useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';
import HostIcon from './HostIcon.jsx';

const money = (v) => `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(v) || 0))}đ`;
const day = 86400000;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const statuses = {
  Confirmed: 'Đã xác nhận',
  PendingPayment: 'Chờ thanh toán',
  CheckedIn: 'Đang ở',
  Completed: 'Hoàn thành',
  Cancelled: 'Đã hủy'
};

const pct = (value, previous) => (previous ? Math.round(((value - previous) / Math.abs(previous)) * 100) : (value ? 100 : 0));

function Delta({ value, invert = false }) {
  // invert: if true (like cancellation rate), positive value is bad, negative is good
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const isGood = invert ? value < 0 : value > 0;

  return (
    <span className={`overview-delta ${isNeutral ? 'neutral' : isGood ? 'up' : 'down'}`}>
      <HostIcon name={isNeutral ? 'arrowRight' : isPositive ? 'trendingUp' : 'trendingDown'} size={13} />
      <span>{Math.abs(value)}%</span>
      <small>so với kỳ trước</small>
    </span>
  );
}

function Kpi({ name, value, delta, detail, icon, invert = false, iconBg = '#eff6ff', iconColor = '#0b4ae6' }) {
  return (
    <article className="overview-kpi-card">
      <div className="kpi-top">
        <span className="kpi-name">{name}</span>
        <div className="kpi-icon-bubble" style={{ background: iconBg, color: iconColor }}>
          <HostIcon name={icon} size={18} />
        </div>
      </div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-bottom">
        <Delta value={delta} invert={invert} />
        {detail && <span className="kpi-detail">{detail}</span>}
      </div>
    </article>
  );
}

function DecisionSupport({ data, loading, error, onTab }) {
  if (loading) return <section className="decision-card decision-loading">Đang tổng hợp dữ liệu ra quyết định…</section>;
  if (error) return <section className="decision-card decision-error">Chưa thể tải phân tích: {error}</section>;
  if (!data) return null;
  const funnel = data.funnel || {};
  const cancellation = data.cancellations || {};
  const opportunity = data.demandOpportunity || {};
  return (
    <section className="decision-card">
      <header className="decision-head">
        <div><span>RA QUYẾT ĐỊNH NHANH</span><h2>Tín hiệu kinh doanh cần chú ý</h2></div>
        <small>Cập nhật từ booking và hành vi khách thực tế</small>
      </header>
      <div className="inventory-now">
        <div><small>PHÒNG TRỐNG HIỆN TẠI</small><strong>{data.inventoryNow?.availableRooms || 0}</strong><span>/ {data.inventoryNow?.totalSellableRooms || 0} phòng đang mở bán</span></div>
        <div><small>ĐANG CÓ KHÁCH</small><strong>{data.inventoryNow?.occupiedRooms || 0}</strong><span>Công suất hôm nay {data.inventoryNow?.occupancyRate || 0}%</span></div>
        <button type="button" onClick={() => onTab('calendar')}>Xem lịch phòng →</button>
      </div>
      <div className="decision-occupancy">
        {(data.futureOccupancy || []).map((x) => (
          <article key={x.days}>
            <div><small>CÔNG SUẤT {x.days} NGÀY TỚI</small><strong>{x.rate}%</strong></div>
            <span><i style={{ width: `${Math.min(100, x.rate)}%` }} /></span>
            <p>{x.soldRoomNights} đêm đã bán · {x.availableRoomNights} đêm còn trống</p>
          </article>
        ))}
        <article className="pickup-card">
          <div><small>BOOKING PICKUP 7 NGÀY</small><strong>{data.pickup?.last7Days?.bookings || 0}</strong></div>
          <p>{money(data.pickup?.last7Days?.value)} giá trị đặt mới cho kỳ lưu trú tương lai</p>
        </article>
      </div>
      <div className="decision-details">
        <article className="decision-panel">
          <h3>Phễu gợi ý AI · 30 ngày</h3>
          <div className="funnel-row"><span><b>{funnel.impressions || 0}</b><small>Xuất hiện</small></span><i>→</i><span><b>{funnel.views || 0}</b><small>Lượt xem</small></span><i>→</i><span><b>{funnel.bookings || 0}</b><small>Booking</small></span></div>
          <p>Xem → đặt: <b>{funnel.viewToBookingRate || 0}%</b> · Hiển thị → xem: <b>{funnel.impressionToViewRate || 0}%</b></p>
        </article>
        <article className="decision-panel cancellation-panel">
          <h3>Hủy & khách quay lại · 30 ngày</h3>
          <div><span><small>Tỷ lệ hủy</small><b>{cancellation.rate || 0}%</b></span><span><small>Doanh thu mất ước tính</small><b>{money(cancellation.lostRevenue)}</b></span><span><small>Khách quay lại</small><b>{data.customers?.repeatRate || 0}%</b></span></div>
          <p>{cancellation.count || 0} đơn hủy · đã hoàn {money(cancellation.refunded)}</p>
        </article>
      </div>
      <div className="topk-performance">
        <div className="topk-heading"><div><small>AI TOP-K</small><h3>Hiệu quả homestay trong danh sách gợi ý</h3></div><span>Thống kê 30 ngày gần nhất</span></div>
        {(funnel.topKProperties || []).length ? <div className="topk-table">
          <div className="topk-row topk-header"><span>Homestay</span><span>Xuất hiện</span><span>Vào Top 3</span><span>Hạng TB</span><span>Xem</span><span>Booking</span></div>
          {funnel.topKProperties.map((x) => <div className="topk-row" key={x.homestayId}><b>{x.name}</b><span>{x.appearances}</span><span>{x.top3Appearances}</span><span>#{x.averageRank}</span><span>{x.views}</span><strong>{x.bookings}</strong></div>)}
        </div> : <p className="topk-empty">Chưa có lượt tìm kiếm chứa homestay của bạn trong Top-K.</p>}
      </div>
      <div className="business-opportunity">
        <div className="topk-heading"><div><small>ĐỒNG BỘ NHU CẦU CUSTOMER</small><h3>Cơ hội kinh doanh từ lượt tìm kiếm</h3></div><span>Dữ liệu tổng hợp, không hiển thị thông tin cá nhân</span></div>
        <div className="opportunity-kpis">
          <span><small>TÌM KIẾM PHÙ HỢP</small><b>{opportunity.relevantSearches || 0}</b></span>
          <span><small>KHÔNG CÓ KẾT QUẢ</small><b>{opportunity.searchesWithoutResults || 0}</b></span>
          <span><small>NGÂN SÁCH TRUNG VỊ</small><b>{money(opportunity.medianBudget)}</b></span>
          <span><small>NHU CẦU PHÒNG-ĐÊM</small><b>{opportunity.requestedRoomNights || 0}</b></span>
        </div>
        {(opportunity.properties || []).length > 0 && <div className="opportunity-list">
          {opportunity.properties.map((x) => <article key={x.homestayId}>
            <div><b>{x.name}</b><small>{x.matchedSearches} lượt phù hợp · {x.missedTopKSearches} lượt chưa vào Top-K</small></div>
            <p>{x.suggestedAction}</p>
            <button type="button" onClick={() => onTab('homestays')}>Tối ưu →</button>
          </article>)}
        </div>}
        {(opportunity.topAmenities || []).length > 0 && <p className="amenity-demand"><b>Tiện nghi khách đang cần:</b> {opportunity.topAmenities.map(x => `${x.name} (${x.searches})`).join(' · ')}</p>}
      </div>
      <div className="decision-alerts">
        <h3>Cảnh báo và hành động đề xuất</h3>
        {(data.alerts || []).length ? data.alerts.map((x, i) => (
          <button key={`${x.title}-${i}`} className={`decision-alert ${x.severity}`} onClick={() => onTab(x.target)}>
            <span><b>{x.title}</b><small>{x.message}</small></span><em>Xử lý →</em>
          </button>
        )) : <div className="decision-all-good">Không phát hiện chỉ số bất thường cần xử lý.</div>}
      </div>
    </section>
  );
}

export default function HostOverview({ bookings, reviews, homestays, rooms, run, onTab, onCreate }) {
  const now = new Date();
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [decision, setDecision] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(true);
  const [decisionError, setDecisionError] = useState('');

  useEffect(() => {
    let active = true;
    setDecisionLoading(true);
    homestayApi.hostDecisionSupport()
      .then((value) => { if (active) setDecision(value); })
      .catch((e) => { if (active) setDecisionError(e.message || 'Lỗi không xác định'); })
      .finally(() => { if (active) setDecisionLoading(false); });
    return () => { active = false; };
  }, [bookings, rooms, reviews]);

  const dates = useMemo(() => {
    let end = new Date(`${to}T23:59:59`);
    let start = new Date(`${from}T00:00:00`);
    if (range === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === '7d') start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    if (range === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (range !== 'custom') end = now;
    const length = Math.max(day, end - start + 1);
    const prevEnd = new Date(start - 1);
    const prevStart = new Date(prevEnd - length + 1);
    return { start, end, prevStart, prevEnd, length };
  }, [range, from, to]);

  const inRange = (x, a = dates.start, b = dates.end) => {
    const d = new Date(x);
    return d >= a && d <= b;
  };

  const current = bookings.filter((x) => inRange(x.createdAt));
  const previous = bookings.filter((x) => inRange(x.createdAt, dates.prevStart, dates.prevEnd));

  const revenue = (list) => list.reduce((s, x) => s + Number(x.paidAmount || 0), 0);
  const sold = (list) => list.filter((x) => !['Cancelled', 'Expired'].includes(x.status)).reduce((s, x) => s + Number(x.nights || 0), 0);
  const cancel = (list) => list.filter((x) => x.status === 'Cancelled').length;

  const reviewCurrent = reviews.filter((x) => !x.createdAt || inRange(x.createdAt));
  const reviewPrevious = reviews.filter((x) => x.createdAt && inRange(x.createdAt, dates.prevStart, dates.prevEnd));

  const metrics = {
    revenue: revenue(current),
    bookings: current.length,
    nights: sold(current),
    cancel: current.length ? (cancel(current) / current.length) * 100 : 0,
    adr: sold(current) ? revenue(current) / sold(current) : 0,
    rating: reviewCurrent.length ? reviewCurrent.reduce((s, x) => s + Number(x.rating), 0) / reviewCurrent.length : 0
  };

  const old = {
    revenue: revenue(previous),
    bookings: previous.length,
    nights: sold(previous),
    cancel: previous.length ? (cancel(previous) / previous.length) * 100 : 0,
    adr: sold(previous) ? revenue(previous) / sold(previous) : 0,
    rating: reviewPrevious.length ? reviewPrevious.reduce((s, x) => s + Number(x.rating), 0) / reviewPrevious.length : 0
  };

  const available = Math.max(1, rooms.length * Math.max(1, Math.ceil(dates.length / day)));
  const occupancy = Math.min(100, (metrics.nights / available) * 100);
  const oldAvailable = Math.max(1, rooms.length * Math.max(1, Math.ceil(dates.length / day)));
  const oldOcc = Math.min(100, (old.nights / oldAvailable) * 100);

  const series = useMemo(() => {
    const count = Math.min(14, Math.max(1, Math.ceil(dates.length / day)));
    const step = dates.length / count;
    return Array.from({ length: count }, (_, i) => {
      const a = new Date(dates.start.getTime() + i * step);
      const b = new Date(Math.min(dates.end, new Date(a.getTime() + step - 1)));
      return {
        label: `${a.getDate()}/${a.getMonth() + 1}`,
        value: bookings.filter((x) => inRange(x.createdAt, a, b)).reduce((s, x) => s + Number(x.paidAmount || 0), 0)
      };
    });
  }, [bookings, dates]);

  const max = Math.max(...series.map((x) => x.value), 1);
  const today = iso(now);

  const todo = [
    ...bookings.filter((x) => x.checkInDate === today && !['Cancelled', 'Expired'].includes(x.status)).map((x) => ({ type: 'Check-in', x })),
    ...bookings.filter((x) => x.checkOutDate === today && !['Cancelled', 'Expired'].includes(x.status)).map((x) => ({ type: 'Check-out', x })),
    ...bookings.filter((x) => x.status === 'PendingPayment').slice(0, 4).map((x) => ({ type: 'Chờ thanh toán', x })),
    ...reviews.filter((x) => !x.hostReply).slice(0, 3).map((x) => ({ type: 'Chưa phản hồi', review: x }))
  ].slice(0, 8);

  const confirmPaid = async (x) => {
    const ok = await confirmDialog({
      title: 'Xác nhận thanh toán',
      message: `Xác nhận đã nhận đủ tiền của đơn ${x.bookingCode}?`,
      confirmText: 'Đã nhận tiền',
      variant: 'warning'
    });
    if (ok) {
      const result = await run(() => homestayApi.confirmOfflinePayment(x.id, 'BankTransfer'), false);
      if (result) toast.success('Đã xác nhận thanh toán.');
    }
  };

  const top = homestays
    .map((h) => ({
      name: h.name,
      value: current.filter((x) => x.homestayId === h.id).reduce((s, x) => s + Number(x.paidAmount || 0), 0),
      count: current.filter((x) => x.homestayId === h.id).length
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const statusData = Object.keys(statuses).map((k) => ({
    key: k,
    value: current.filter((x) => x.status === k).length
  }));
  const statusTotal = Math.max(1, statusData.reduce((s, x) => s + x.value, 0));

  const latest = [...current].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const latestReviews = [...reviews].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);

  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = iso(d);
    return {
      key,
      label: i ? 'T' + ['CN', '2', '3', '4', '5', '6', '7'][d.getDay()] : 'Hôm nay',
      busy: bookings.filter((x) => x.checkInDate <= key && x.checkOutDate > key && !['Cancelled', 'Expired'].includes(x.status)).length
    };
  });

  return (
    <div className="host-overview">
      {/* Thanh bộ lọc kỳ xem báo cáo */}
      <div className="overview-range">
        <div className="overview-range-segmented">
          {[
            ['today', 'Hôm nay'],
            ['7d', '7 ngày'],
            ['month', 'Tháng này'],
            ['custom', 'Tùy chọn']
          ].map(([k, v]) => (
            <button
              className={`overview-range-btn ${range === k ? 'active' : ''}`}
              key={k}
              type="button"
              onClick={() => setRange(k)}
            >
              {v}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <label className="overview-range-inputs">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        )}
        <div className="overview-range-badge">
          <HostIcon name="calendar" size={14} color="#64748b" />
          <span>
            {dates.start.toLocaleDateString('vi-VN')} – {dates.end.toLocaleDateString('vi-VN')}
          </span>
        </div>
      </div>

      {/* 6 Thẻ KPI chỉ số kinh doanh */}
      <div className="overview-kpis">
        <Kpi
          name="DOANH THU"
          value={money(metrics.revenue)}
          delta={pct(metrics.revenue, old.revenue)}
          icon="wallet"
          iconBg="#eff6ff"
          iconColor="#0b4ae6"
        />
        <Kpi
          name="BOOKING MỚI"
          value={metrics.bookings}
          delta={pct(metrics.bookings, old.bookings)}
          icon="bookings"
          iconBg="#ecfdf5"
          iconColor="#10b981"
        />
        <Kpi
          name="TỶ LỆ LẤP ĐẦY"
          value={`${occupancy.toFixed(1)}%`}
          delta={Math.round(occupancy - oldOcc)}
          icon="bed"
          iconBg="#f0f9ff"
          iconColor="#0284c7"
        />
        <Kpi
          name="TỶ LỆ HỦY"
          value={`${metrics.cancel.toFixed(1)}%`}
          delta={Math.round(metrics.cancel - old.cancel)}
          invert
          icon="alertCircle"
          iconBg="#fef2f2"
          iconColor="#ef4444"
        />
        <Kpi
          name="ADR / ĐÊM"
          value={money(metrics.adr)}
          delta={pct(metrics.adr, old.adr)}
          icon="tag"
          iconBg="#faf5ff"
          iconColor="#8b5cf6"
        />
        <Kpi
          name="ĐIỂM ĐÁNH GIÁ"
          value={metrics.rating ? metrics.rating.toFixed(1) : '—'}
          delta={pct(metrics.rating, old.rating)}
          detail={`${reviewCurrent.length} lượt đánh giá`}
          icon="reviews"
          iconBg="#fffbeb"
          iconColor="#f59e0b"
        />
      </div>

      <DecisionSupport data={decision} loading={decisionLoading} error={decisionError} onTab={onTab} />

      {/* Việc quan trọng cần xử lý hôm nay */}
      <section className="overview-actions-card">
        <header className="overview-actions-head">
          <div className="overview-actions-title-wrap">
            <span className="overview-actions-badge">CẦN XỬ LÝ HÔM NAY</span>
            <h2>Việc quan trọng đang chờ bạn</h2>
          </div>
          <span className={`overview-actions-count ${todo.length ? 'has-pending' : ''}`}>
            {todo.length} việc cần làm
          </span>
        </header>

        <div className="overview-actions-list">
          {todo.map((t, i) => {
            const isReview = Boolean(t.review);
            const isPayment = t.type === 'Chờ thanh toán';
            const isCheckIn = t.type === 'Check-in';
            const isCheckOut = t.type === 'Check-out';

            let typeClass = 'badge-general';
            if (isCheckIn) typeClass = 'badge-checkin';
            else if (isCheckOut) typeClass = 'badge-checkout';
            else if (isPayment) typeClass = 'badge-payment';
            else if (isReview) typeClass = 'badge-review';

            return (
              <article key={`${t.type}-${t.x?.id || t.review?.id || i}`} className="overview-todo-item">
                <span className={`todo-type-pill ${typeClass}`}>
                  {t.type}
                </span>

                <div className="todo-content">
                  <b className="todo-title">
                    {t.x ? `${t.x.bookingCode} · ${t.x.customerName}` : `${t.review.customerName} · ${t.review.rating} ★`}
                  </b>
                  <p className="todo-desc">
                    {t.x
                      ? `${t.x.homestayName} · ${t.x.checkInDate} → ${t.x.checkOutDate}`
                      : (t.review.comment || 'Khách đã gửi đánh giá sao, chưa có nhận xét văn bản.')}
                  </p>
                </div>

                <div className="todo-action-wrap">
                  {isPayment ? (
                    <button
                      type="button"
                      className="todo-btn primary"
                      onClick={() => confirmPaid(t.x)}
                    >
                      Xác nhận tiền
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="todo-btn secondary"
                      onClick={() => onTab(isReview ? 'reviews' : isCheckIn || isCheckOut ? 'calendar' : 'bookings')}
                    >
                      {isReview ? 'Phản hồi ngay →' : isCheckIn || isCheckOut ? 'Xem trên lịch →' : 'Xử lý đơn →'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {!todo.length && (
            <div className="overview-todo-empty">
              <HostIcon name="checkCircle" size={32} color="#10b981" />
              <div>
                <b>Hôm nay không có việc tồn đọng</b>
                <p>Tất cả lượt check-in, check-out và phản hồi đánh giá đều đã được xử lý chu đáo.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Biểu đồ doanh thu & phân bổ */}
      <div className="overview-charts-grid">
        {/* Doanh thu theo thời gian */}
        <section className="chart-card revenue-section">
          <header className="chart-header">
            <div>
              <h3>Doanh thu theo thời gian</h3>
              <small>Tổng thu trong kỳ</small>
            </div>
            <strong className="revenue-total-badge">{money(metrics.revenue)}</strong>
          </header>
          <div className="revenue-bar-chart">
            {series.map((x) => {
              const heightPct = Math.max(4, Math.round((x.value / max) * 100));
              return (
                <div key={x.label} className="bar-column" title={`${x.label}: ${money(x.value)}`}>
                  <div className="bar-track">
                    <span className="bar-fill" style={{ height: `${heightPct}%` }} />
                  </div>
                  <small className="bar-label">{x.label}</small>
                </div>
              );
            })}
          </div>
        </section>

        {/* Booking theo trạng thái */}
        <section className="chart-card status-section">
          <header className="chart-header">
            <div>
              <h3>Booking theo trạng thái</h3>
              <small>{current.length} đơn trong kỳ</small>
            </div>
          </header>
          <div className="status-chart-body">
            <div className="status-progress-list">
              {statusData.map((x) => {
                const count = x.value;
                const pctVal = Math.round((count / statusTotal) * 100);
                return (
                  <div key={x.key} className="status-progress-item">
                    <div className="status-progress-header">
                      <span className={`status-dot ${x.key.toLowerCase()}`} />
                      <span className="status-name">{statuses[x.key]}</span>
                      <b className="status-count">{count}</b>
                      <small className="status-pct">({pctVal}%)</small>
                    </div>
                    <div className="status-progress-bar">
                      <span
                        className={`status-progress-fill ${x.key.toLowerCase()}`}
                        style={{ width: `${pctVal}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Top Homestay */}
        <section className="chart-card top-stays-section">
          <header className="chart-header">
            <div>
              <h3>Top Homestay</h3>
              <small>Xếp theo doanh thu</small>
            </div>
          </header>
          <div className="top-stays-list">
            {top.map((x, i) => (
              <div key={x.name} className="top-stay-row">
                <span className={`rank-pill rank-${i + 1}`}>{i + 1}</span>
                <div className="stay-info">
                  <b className="stay-name">{x.name}</b>
                  <small className="stay-count">{x.count} lượt đặt</small>
                </div>
                <strong className="stay-revenue">{money(x.value)}</strong>
              </div>
            ))}
            {!top.length && <p className="chart-empty-msg">Chưa có dữ liệu đặt phòng cho homestay.</p>}
          </div>
        </section>
      </div>

      {/* 3 Danh sách bổ trợ ở cuối */}
      <div className="overview-lists-grid">
        <section className="list-card">
          <header className="list-header">
            <h3>Đơn mới nhất</h3>
            <button type="button" onClick={() => onTab('bookings')}>
              Xem tất cả →
            </button>
          </header>
          <div className="list-body">
            {latest.map((x) => (
              <article key={x.id} className="compact-booking-row">
                <div>
                  <b className="row-title">{x.bookingCode} · {x.customerName}</b>
                  <small className="row-sub">{x.homestayName} · Check-in {x.checkInDate}</small>
                </div>
                <strong className="row-amount">{money(x.totalAmount)}</strong>
              </article>
            ))}
            {!latest.length && <p className="list-empty-msg">Chưa có đơn đặt phòng nào gần đây.</p>}
          </div>
        </section>

        <section className="list-card">
          <header className="list-header">
            <h3>Đánh giá mới</h3>
            <button type="button" onClick={() => onTab('reviews')}>
              Xem tất cả →
            </button>
          </header>
          <div className="list-body">
            {latestReviews.map((x) => (
              <article key={x.id} className="compact-review-row">
                <div>
                  <div className="review-title-line">
                    <b className="row-title">{x.customerName}</b>
                    <span className="review-stars-pill">★ {x.rating}</span>
                    {!x.hostReply && <span className="review-new-pill">Mới</span>}
                  </div>
                  <small className="row-sub">{x.comment || 'Khách không để lại nhận xét văn bản.'}</small>
                </div>
              </article>
            ))}
            {!latestReviews.length && <p className="list-empty-msg">Chưa có đánh giá nào gần đây.</p>}
          </div>
        </section>

        <section className="list-card">
          <header className="list-header">
            <h3>7 ngày tới</h3>
            <button type="button" onClick={() => onTab('calendar')}>
              Mở lịch →
            </button>
          </header>
          <div className="mini-week-grid">
            {nextDays.map((x) => {
              const freeRooms = Math.max(0, rooms.length - x.busy);
              return (
                <div key={x.key} className="week-day-box">
                  <b className="day-name">{x.label}</b>
                  <small className="day-date">{x.key.slice(8, 10)}/{x.key.slice(5, 7)}</small>
                  <span className="day-busy-pill">{x.busy} bận</span>
                  <em className="day-free-pill">{freeRooms} trống</em>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Thao tác nhanh */}
      <section className="overview-shortcuts-grid">
        <button type="button" className="shortcut-card" onClick={onCreate}>
          <div className="shortcut-icon" style={{ background: '#eff6ff', color: '#0b4ae6' }}>
            <HostIcon name="plus" size={18} />
          </div>
          <div>
            <b>Thêm Homestay</b>
            <small>Đăng ký cơ sở lưu trú mới</small>
          </div>
        </button>

        <button type="button" className="shortcut-card" onClick={() => onTab('calendar')}>
          <div className="shortcut-icon" style={{ background: '#fef2f2', color: '#ef4444' }}>
            <HostIcon name="calendar" size={18} />
          </div>
          <div>
            <b>Chặn lịch phòng</b>
            <small>Khóa ngày sửa chữa hoặc bận</small>
          </div>
        </button>

        <button type="button" className="shortcut-card" onClick={() => onTab('homestays')}>
          <div className="shortcut-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
            <HostIcon name="dollar" size={18} />
          </div>
          <div>
            <b>Cập nhật giá</b>
            <small>Điều chỉnh giá phòng & giá lễ</small>
          </div>
        </button>

        <button type="button" className="shortcut-card" onClick={() => onTab('calendar')}>
          <div className="shortcut-icon" style={{ background: '#faf5ff', color: '#8b5cf6' }}>
            <HostIcon name="edit" size={18} />
          </div>
          <div>
            <b>Tạo đơn thủ công</b>
            <small>Ghi nhận khách đặt ngoài hệ thống</small>
          </div>
        </button>
      </section>
    </div>
  );
}
