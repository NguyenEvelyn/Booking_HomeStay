import React, { useEffect, useMemo, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { confirmDialog } from '../../../shared/feedback/feedback.js';

const money = value => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)}đ`;
const date = value => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${String(value).slice(0, 10)}T00:00:00`)) : '—';
const dateTime = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const day = value => date(value);
const plainDate = value => date(value);
const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
const dayDiff = (value, base) => Math.round((Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86400000);
const upcomingStatuses = ['Confirmed', 'PendingPayment', 'Pending', 'Hold'];
const ongoingStatuses = ['CheckedIn', 'CheckoutPendingPayment'];
const closedStatuses = ['Completed', 'CheckedOut', 'Cancelled', 'NoShow', 'Expired'];
const isUpcoming = (item, now) => upcomingStatuses.includes(item.status) && item.checkInDate >= now;

const urgencyFor = (item, now) => {
  if (ongoingStatuses.includes(item.status)) {
    const days = dayDiff(item.checkOutDate, now);
    return { level: 'staying', label: days <= 0 ? 'Check-out hôm nay' : `Đang ở · Check-out sau ${days} ngày`, urgent: days <= 0 };
  }
  if (!upcomingStatuses.includes(item.status)) return null;
  const days = Number.isFinite(Number(item.daysUntilCheckin)) ? Number(item.daysUntilCheckin) : dayDiff(item.checkInDate, now);
  if (days < 0) return { level: 'overdue', label: `Trễ ${Math.abs(days)} ngày`, urgent: true };
  if (days === 0) return { level: 'today', label: 'Check-in hôm nay', urgent: true };
  if (days === 1) return { level: 'tomorrow', label: 'Ngày mai', urgent: true };
  if (days <= 3) return { level: 'soon', label: `Còn ${days} ngày`, urgent: false };
  if (days <= 7) return { level: 'week', label: `Còn ${days} ngày`, urgent: false };
  return { level: 'normal', label: `Còn ${days} ngày`, urgent: false };
};

const bookingGroup = (item, now) => {
  if (ongoingStatuses.includes(item.status)) return 'staying';
  if (closedStatuses.includes(item.status)) return 'closed';
  const days = Number.isFinite(Number(item.daysUntilCheckin)) ? Number(item.daysUntilCheckin) : dayDiff(item.checkInDate, now);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'this-week';
  if (days <= 14) return 'next-week';
  return 'later';
};

const groupLabels = {
  overdue: 'Cần xử lý ngay',
  staying: 'Đang ở',
  today: 'Hôm nay',
  tomorrow: 'Ngày mai',
  'this-week': 'Tuần này',
  'next-week': 'Tuần sau',
  later: 'Sau đó',
  closed: 'Đã hoàn thành / Đã hủy'
};

const labels = {
  Hold: 'Chờ thanh toán',
  Pending: 'Chờ xác nhận',
  PendingPayment: 'Chờ thanh toán',
  PaymentFailed: 'Thanh toán lỗi',
  Expired: 'Hết hạn',
  Confirmed: 'Đã xác nhận',
  CheckedIn: 'Đang ở',
  CheckoutPendingPayment: 'Chờ xác nhận trả phòng',
  CheckedOut: 'Đã trả phòng',
  Completed: 'Hoàn thành',
  CancellationRequested: 'Chờ duyệt hủy',
  Cancelled: 'Đã hủy',
  NoShow: 'Không đến'
};

const tabs = [
  ['all', 'Tất cả'],
  ['Pending', 'Chờ xác nhận'],
  ['PendingPayment', 'Chờ thanh toán'],
  ['Confirmed', 'Đã xác nhận'],
  ['upcoming', 'Sắp check-in'],
  ['CheckedIn', 'Đang ở'],
  ['Completed', 'Hoàn thành'],
  ['Cancelled', 'Đã hủy']
];

const paymentState = item => {
  const paid = Number(item.paidAmount) || 0;
  const total = Number(item.totalAmount) || 0;
  if (paid >= total && total > 0) return 'paid';
  if (paid > 0) return 'deposit';
  return 'pending';
};

const paymentLabel = {
  paid: 'Đã thanh toán đủ',
  deposit: 'Đã cọc',
  pending: 'Chờ thanh toán'
};

const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function HostBookings({ items, homestays, run, sort = 'checkin_asc', onSortChange }) {
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [home, setHome] = useState('');
  const [dateType, setDateType] = useState('created');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [payment, setPayment] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [filterOpen, setFilterOpen] = useState(false);

  const perPage = 8;
  const now = today();
  const month = now.slice(0, 7);

  const filtered = useMemo(() => items.filter(x => {
    const hay = `${x.bookingCode} ${x.customerName} ${x.customerPhone || ''}`.toLocaleLowerCase('vi');
    const statusOk = status === 'all'
      || (status === 'upcoming' ? isUpcoming(x, now) : x.status === status)
      || (status === 'Cancelled' && x.status === 'CancellationRequested');
    const dateValue = dateType === 'checkin' ? x.checkInDate : String(x.createdAt).slice(0, 10);
    return statusOk
      && (!quickFilter || (quickFilter === 'new' && x.isNew)
        || (quickFilter === 'today' && upcomingStatuses.includes(x.status) && x.checkInDate === now)
        || (quickFilter === 'pending' && paymentState(x) === 'pending' && ['PendingPayment', 'PaymentFailed'].includes(x.status))
        || (quickFilter === 'revenue' && String(x.createdAt).slice(0, 7) === month && Number(x.paidAmount || 0) > 0))
      && (!query.trim() || hay.includes(query.trim().toLocaleLowerCase('vi')))
      && (!home || String(x.homestayId) === home)
      && (!payment || paymentState(x) === payment)
      && (!from || dateValue >= from)
      && (!to || dateValue <= to);
  }), [items, status, query, home, dateType, from, to, payment, quickFilter, now, month]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((Math.min(page, pages) - 1) * perPage, Math.min(page, pages) * perPage);
  const tomorrow = new Date(`${now}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const stats = {
    new: items.filter(x => x.isNew).length,
    today: items.filter(x => upcomingStatuses.includes(x.status) && x.checkInDate === now).length,
    tomorrow: items.filter(x => upcomingStatuses.includes(x.status) && x.checkInDate === tomorrowKey).length,
    pending: items.filter(x => paymentState(x) === 'pending' && ['PendingPayment', 'PaymentFailed'].includes(x.status)).length,
    revenue: items.filter(x => String(x.createdAt).slice(0, 7) === month).reduce((sum, x) => sum + Number(x.paidAmount || 0), 0)
  };

  const open = async (item, tab = 'overview') => {
    setSelected({ ...item, isNew: false, contactIsNew: false });
    setSelectedTab(tab);
    if (item.isNew || item.contactIsNew) homestayApi.markBookingViewed(item.id).catch(() => {});
  };

  const reset = () => {
    setQuery('');
    setHome('');
    setFrom('');
    setTo('');
    setPayment('');
    setQuickFilter('');
    onSortChange?.('checkin_asc');
    setPage(1);
  };

  const applyQuickFilter = value => {
    setQuickFilter(current => current === value ? '' : value);
    setStatus('all');
    setPage(1);
  };

  const groupCounts = sort === 'checkin_asc' ? filtered.reduce((counts, item) => {
    const key = bookingGroup(item, now);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {}) : {};

  const exportCsv = () => {
    const rows = [
      ['Mã đơn', 'Khách', 'Điện thoại', 'Homestay', 'Phòng', 'Nhận phòng', 'Trả phòng', 'Số đêm', 'Số khách', 'Tổng tiền', 'Đã trả', 'Thanh toán', 'Trạng thái', 'Ngày đặt'],
      ...filtered.map(x => [
        x.bookingCode,
        x.customerName,
        x.customerPhone,
        x.homestayName,
        x.rooms?.join(' / '),
        x.checkInDate,
        x.checkOutDate,
        x.nights,
        x.adultCount + x.childCount,
        x.totalAmount,
        x.paidAmount,
        paymentLabel[paymentState(x)],
        labels[x.status] || x.status,
        x.createdAt
      ])
    ];
    const blob = new Blob([`\ufeff${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-doi-soat-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const decide = async (item, approve) => {
    const ok = await confirmDialog({
      title: approve ? 'Duyệt yêu cầu hủy?' : 'Từ chối yêu cầu hủy?',
      message: approve ? `Duyệt hủy đơn ${item.bookingCode}?` : `Từ chối yêu cầu hủy đơn ${item.bookingCode}?`,
      confirmText: approve ? 'Duyệt hủy' : 'Từ chối yêu cầu',
      variant: approve ? 'danger' : 'warning'
    });
    if (ok) await run(() => homestayApi.decideCancellation(item.id, approve), false).then(() => setSelected(null));
  };

  return (
    <section className="booking-manager">
      <div className="booking-kpis">
        <button type="button" className={quickFilter === 'new' ? 'active' : ''} onClick={() => applyQuickFilter('new')} aria-pressed={quickFilter === 'new'}>
          <div className="booking-kpi-icon"><HostIcon name="bell" size={20} color="#0b4ae6" /></div>
          <div>
            <small>ĐƠN MỚI</small>
            <strong>{stats.new}</strong>
            <span>Chưa được mở</span>
          </div>
        </button>
        <button type="button" className={quickFilter === 'today' ? 'active' : ''} onClick={() => applyQuickFilter('today')} aria-pressed={quickFilter === 'today'}>
          <div className="booking-kpi-icon"><HostIcon name="checkCircle" size={20} color="#0d8244" /></div>
          <div>
            <small>CHECK-IN HÔM NAY</small>
            <strong>{stats.today}</strong>
            <span>Ngày mai: {stats.tomorrow} đơn</span>
          </div>
        </button>
        <button type="button" className={quickFilter === 'pending' ? 'active' : ''} onClick={() => applyQuickFilter('pending')} aria-pressed={quickFilter === 'pending'}>
          <div className="booking-kpi-icon"><HostIcon name="clock" size={20} color="#b25e00" /></div>
          <div>
            <small>CHỜ THANH TOÁN</small>
            <strong>{stats.pending}</strong>
            <span>Cần theo dõi</span>
          </div>
        </button>
        <button type="button" className={quickFilter === 'revenue' ? 'active' : ''} onClick={() => applyQuickFilter('revenue')} aria-pressed={quickFilter === 'revenue'}>
          <div className="booking-kpi-icon"><HostIcon name="wallet" size={20} color="#0b4ae6" /></div>
          <div>
            <small>DOANH THU THÁNG</small>
            <strong>{money(stats.revenue)}</strong>
            <span>Giao dịch thành công</span>
          </div>
        </button>
      </div>

      {items.some(x => x.status === 'PendingPayment' && new Date(x.updatedAt) <= new Date(Date.now() - 15 * 60000)) && (
        <div className="booking-alert">
          <HostIcon name="alertCircle" size={18} color="#b42318" />
          <span>Có đơn chờ thanh toán đã quá thời gian giữ phòng. Hệ thống hiển thị là hết hạn và không giữ tồn phòng.</span>
        </div>
      )}

      <div className="booking-board">
        <header>
          <div>
            <small>QUẢN LÝ VẬN HÀNH</small>
            <h2>Đơn đặt phòng</h2>
            <p>Theo dõi thanh toán, lịch đến và xử lý từng kỳ lưu trú của du khách.</p>
          </div>
          <button className="btn-export-csv" onClick={exportCsv}>
            <HostIcon name="download" size={15} />
            <span>Xuất file CSV</span>
          </button>
        </header>

        <nav className="booking-tabs">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              className={status === key ? 'active' : ''}
              onClick={() => { setStatus(key); setQuickFilter(''); setPage(1); }}
            >
              <span>{label}</span>
              <b>{items.filter(x => key === 'all' || (key === 'upcoming' ? isUpcoming(x, now) : x.status === key)).length}</b>
            </button>
          ))}
        </nav>

        <button hidden type="button" className="mobile-filter-trigger" onClick={() => setFilterOpen(true)} aria-expanded={filterOpen} aria-controls="booking-mobile-filters"><HostIcon name="filter" size={17}/><span>Bộ lọc</span></button>
        {filterOpen && <button hidden type="button" className="mobile-filter-scrim" aria-label="Đóng bộ lọc" onClick={() => setFilterOpen(false)}/>}
        <div id="booking-mobile-filters" className={`booking-filters mobile-filter-sheet ${filterOpen ? 'mobile-open' : ''}`}>
          <div hidden className="mobile-filter-heading"><div><small>BỘ LỌC</small><b>Lọc đơn đặt phòng</b></div><button type="button" onClick={() => setFilterOpen(false)} aria-label="Đóng bộ lọc"><HostIcon name="close" size={18}/></button></div>
          <label className="booking-search">
            <span>Tìm kiếm</span>
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="Mã đơn, tên khách, số điện thoại..."
            />
          </label>
          <label>
            <span>Homestay</span>
            <select value={home} onChange={e => setHome(e.target.value)}>
              <option value="">Tất cả homestay</option>
              {homestays.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label>
            <span>Mốc ngày</span>
            <select value={dateType} onChange={e => setDateType(e.target.value)}>
              <option value="created">Ngày đặt</option>
              <option value="checkin">Ngày check-in</option>
            </select>
          </label>
          <label>
            <span>Từ ngày</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </label>
          <label>
            <span>Đến ngày</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </label>
          <label>
            <span>Thanh toán</span>
            <select value={payment} onChange={e => setPayment(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="pending">Chờ thanh toán</option>
              <option value="deposit">Đã cọc</option>
              <option value="paid">Đã thanh toán đủ</option>
            </select>
          </label>
          <label>
            <span>Sắp xếp</span>
            <select value={sort} onChange={e => { onSortChange?.(e.target.value); setPage(1); }}>
              <option value="checkin_asc">Sắp check-in nhất</option>
              <option value="created_desc">Mới đặt nhất</option>
              <option value="checkout_asc">Check-out sớm nhất</option>
              <option value="amount_desc">Giá trị cao nhất</option>
            </select>
          </label>
          <button className="booking-reset" onClick={reset}>Đặt lại</button>
        </div>

        <div className="booking-list">
          {visible.map((x, index) => {
            const urgency = urgencyFor(x, now);
            const group = bookingGroup(x, now);
            const previousGroup = index > 0 ? bookingGroup(visible[index - 1], now) : null;
            const showGroup = sort === 'checkin_asc' && group !== previousGroup;
            const checkInReady = x.status === 'Confirmed' && dayDiff(x.checkInDate, now) <= 1;
            return <React.Fragment key={x.id}>
            {showGroup && (
              <div className={`booking-time-group group-${group}`}>
                <span>{groupLabels[group]}</span>
                <b>{groupCounts[group] || 0}</b>
              </div>
            )}
            <article className={`${x.isNew ? 'is-new ' : ''}${urgency?.urgent ? `is-urgent urgency-${urgency.level}` : ''}`} onClick={() => open(x)}>
              <div className="booking-primary">
                <span>{x.isNew && <b>Mới</b>}{x.contactIsNew && <b className="contact-updated-chip">Mới cập nhật</b>}{x.bookingCode}</span>
                <h3>{x.customerName}</h3>
                <small>{x.customerPhone || 'Chưa có SĐT'} · Đặt lúc {dateTime(x.createdAt)}</small>
                {urgency && <span className={`booking-urgency booking-urgency-mobile urgency-${urgency.level}`}>{urgency.label}</span>}
              </div>
              <div>
                <small>HOMESTAY / PHÒNG</small>
                <strong>{x.homestayName}</strong>
                <span>{x.details?.map(d => `${d.roomTypeName}${d.roomNumber ? ` · ${d.roomNumber}` : ''}`).join(', ') || 'Chưa xếp phòng'}</span>
              </div>
              <div className="booking-stay">
                <div className="booking-stay-heading">
                  <small>LƯU TRÚ</small>
                  {urgency && <span className={`booking-urgency urgency-${urgency.level}`}>{urgency.label}</span>}
                </div>
                <strong>{date(x.checkInDate)} → {date(x.checkOutDate)}</strong>
                <span>{x.nights} đêm · {x.adultCount + x.childCount} khách</span>
              </div>
              <div className="booking-money">
                <small>TỔNG TIỀN</small>
                <strong>{money(x.totalAmount)}</strong>
                <span className={`payment-${paymentState(x)}`}>{paymentLabel[paymentState(x)]}</span>
              </div>
              <span className={`status status-${x.status.toLowerCase()}`}>{labels[x.status] || x.status}</span>
              <div className="booking-actions" onClick={e => e.stopPropagation()}>
                {x.status === 'PendingPayment' && (
                  <button onClick={async () => {
                    const ok = await confirmDialog({
                      title: 'Xác nhận thanh toán',
                      message: 'Xác nhận đã nhận đủ tiền chuyển khoản/tiền mặt?',
                      confirmText: 'Đã nhận tiền',
                      variant: 'warning'
                    });
                    if (ok) await run(() => homestayApi.confirmOfflinePayment(x.id, 'BankTransfer'), false);
                  }}>Đã nhận tiền</button>
                )}
                {x.status === 'Confirmed' && (
                  <button className={checkInReady ? 'btn-action-highlight' : 'btn-action-secondary'} onClick={() => open(x, 'checkin')}>Check-in</button>
                )}
                {x.status === 'CheckedIn' && (
                  <button className="btn-action-highlight" onClick={() => open(x, 'checkout')}>Trả phòng</button>
                )}
                {x.status === 'CancellationRequested' && (
                  <button onClick={() => decide(x, true)}>Duyệt hủy</button>
                )}
                <button className="btn-detail" onClick={() => open(x, 'overview')}>Chi tiết</button>
              </div>
            </article>
            </React.Fragment>;
          })}
          {!visible.length && <p className="booking-empty">Không có đơn phù hợp với bộ lọc hiện tại.</p>}
        </div>

        <footer className="booking-pagination">
          <span>Hiển thị {visible.length} / {filtered.length} đơn</span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Trang trước">
              <HostIcon name="chevronLeft" size={16} />
            </button>
            <b>{Math.min(page, pages)} / {pages}</b>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Trang sau">
              <HostIcon name="chevronRight" size={16} />
            </button>
          </div>
        </footer>
      </div>

      {selected && <BookingDetail item={selected} initialTab={selectedTab} close={() => setSelected(null)} run={run} decide={decide} />}
    </section>
  );
}

// --- POLICY-DRIVEN PRICING HELPERS ---
const calcEarlyCheckInPolicy = (timeStr, nightlyPrice, policyCheckInOut) => {
  if (!timeStr) return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (từ 14:00)', badge: 'normal' };
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = (h || 0) * 60 + (m || 0);

  const tiers = policyCheckInOut?.earlyCheckInTiers || [
    { from: '00:00:00', to: '06:00:00', percent: 100 },
    { from: '06:00:00', to: '10:00:00', percent: 50 },
    { from: '10:00:00', to: '14:00:00', percent: 0 }
  ];

  for (const tier of tiers) {
    const [fromH, fromM] = (tier.from || '00:00').split(':').map(Number);
    const [toH, toM] = (tier.to || '14:00').split(':').map(Number);
    const fromMin = fromH * 60 + (fromM || 0);
    const toMin = toH * 60 + (toM || 0);
    if (totalMinutes >= fromMin && totalMinutes < toMin) {
      const fee = Math.round(nightlyPrice * (Number(tier.percent) / 100));
      return {
        fee,
        percent: tier.percent,
        label: tier.percent === 0
          ? `Miễn phí nếu phòng sẵn sàng (${String(fromH).padStart(2, '0')}:00 – ${String(toH).padStart(2, '0')}:00)`
          : `Phụ thu ${tier.percent}% giá phòng/đêm (${String(fromH).padStart(2, '0')}:00 – ${String(toH).padStart(2, '0')}:00)`,
        badge: tier.percent === 0 ? 'free' : tier.percent >= 100 ? 'danger' : 'warning'
      };
    }
  }
  return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (từ 14:00)', badge: 'normal' };
};

const calcLateCheckOutPolicy = (timeStr, nightlyPrice, policyCheckInOut) => {
  if (!timeStr) return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (trước 12:00)', badge: 'normal' };
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = (h || 0) * 60 + (m || 0);

  const tiers = policyCheckInOut?.lateCheckOutTiers || [
    { from: '12:00:00', to: '15:00:00', percent: 30 },
    { from: '15:00:00', to: '18:00:00', percent: 50 },
    { from: '18:00:00', to: '23:59:00', percent: 100 }
  ];

  if (totalMinutes <= 12 * 60) {
    return { fee: 0, percent: 0, label: 'Đúng giờ tiêu chuẩn (trước 12:00)', badge: 'normal' };
  }

  for (const tier of tiers) {
    const [fromH, fromM] = (tier.from || '12:00').split(':').map(Number);
    const [toH, toM] = (tier.to || '23:59').split(':').map(Number);
    const fromMin = fromH * 60 + (fromM || 0);
    const toMin = toH * 60 + (toM || 0);
    if (totalMinutes >= fromMin && totalMinutes <= toMin) {
      const fee = Math.round(nightlyPrice * (Number(tier.percent) / 100));
      return {
        fee,
        percent: tier.percent,
        label: `Phụ thu ${tier.percent}% giá phòng/đêm (${String(fromH).padStart(2, '0')}:00 – ${String(toH).padStart(2, '0')}:00)`,
        badge: tier.percent >= 100 ? 'danger' : 'warning'
      };
    }
  }
  return { fee: Math.round(nightlyPrice), percent: 100, label: 'Phụ thu 100% giá phòng/đêm (Sau 18:00)', badge: 'danger' };
};

const calcExtraGuestSurcharge = (actual, bookedAdults, bookedChildren, capacity, guestPolicy, nightlyPrice, nights) => {
  const totalActualAdults = (actual.adults || 0) + (actual.childOver12 || 0);
  const extraAdults = Math.max(0, totalActualAdults - (bookedAdults || 0));
  const adultFeePerNight = Number(capacity?.extraGuestFee) || Number(guestPolicy?.adultExtraBedFee) || Math.round(nightlyPrice * 0.3);
  const adultSurcharge = extraAdults * adultFeePerNight * (nights || 1);

  const totalActualChildren = (actual.childUnder2 || 0) + (actual.child2To6 || 0) + (actual.child6To10 || 0) + (actual.child10To12 || 0);
  const extraChildrenCount = Math.max(0, totalActualChildren - (bookedChildren || 0));

  let childSurcharge = 0;
  if (extraChildrenCount > 0) {
    const childFeePerNight = Number(capacity?.extraChildFee) || Math.round(nightlyPrice * 0.15);
    childSurcharge = extraChildrenCount * childFeePerNight * (nights || 1);
  }

  return {
    totalActualGuests: totalActualAdults + totalActualChildren,
    extraAdults,
    extraChildrenCount,
    adultSurcharge,
    childSurcharge,
    totalSurcharge: adultSurcharge + childSurcharge
  };
};

function BookingActionMenu({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="action-menu-wrapper" ref={menuRef}>
      <button
        type="button"
        className="btn-action-menu"
        onClick={() => setOpen(!open)}
      >
        <span>⋮ Thao tác</span>
        <span style={{ fontSize: '10px', marginLeft: '4px' }}>▼</span>
      </button>

      {open && (
        <div className="action-dropdown-popover">
          <div className="action-dropdown-title">THAO TÁC BOOKING</div>
          <div className="action-dropdown-list">
            {actions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                className={`action-dropdown-item ${act.danger ? 'danger' : ''} ${act.disabled ? 'disabled' : ''}`}
                disabled={act.disabled}
                onClick={() => {
                  if (act.disabled) return;
                  setOpen(false);
                  act.handler();
                }}
              >
                {act.icon && <HostIcon name={act.icon} size={14} />}
                <span>{act.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingDetail({ item: initialItem, initialTab = 'overview', close, run, decide }) {
  const [item, setItem] = useState(initialItem);
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab === 'services') return 'stay';
    if (['overview', 'checkin', 'stay', 'checkout', 'bill', 'history'].includes(initialTab)) return initialTab;
    if (['Hold', 'Confirmed'].includes(initialItem?.status)) return 'checkin';
    if (initialItem?.status === 'CheckedIn') return 'stay';
    if (['CheckedOut', 'Completed'].includes(initialItem?.status)) return 'checkout';
    return 'overview';
  });
  const [note, setNote] = useState(initialItem.hostNote || '');
  const [showIncidentalModal, setShowIncidentalModal] = useState(false);
  const [incidentalCategory, setIncidentalCategory] = useState('service');
  const [isMaximized, setIsMaximized] = useState(false);

  const policy = item.policy || {};
  const capacity = item.details?.[0]?.capacity || {
    baseCapacity: 2,
    maxCapacity: 4,
    maxAdults: 2,
    maxChildren: 2,
    extraGuestAllowed: true,
    extraGuestFee: 150000,
    extraChildFee: 80000
  };

  // Giá phòng 1 đêm làm căn cứ tính
  const pricePerNight = Number(item.details?.[0]?.pricePerNight)
    || (item.nights > 0 ? (Number(item.roomAmount) || Number(item.subtotal)) / item.nights : Number(item.subtotal)) || 500000;

  // 1. Phụ thu nhận sớm / trả muộn
  const existingEarly = (item.additionalCharges || []).find(c => c.type === 'early_checkin');
  const existingLate = (item.additionalCharges || []).find(c => c.type === 'late_checkout');

  const extractTime = (str, fallback) => {
    if (!str) return fallback;
    const match = str.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
    return match ? match[0] : fallback;
  };

  const [checkInTime, setCheckInTime] = useState(() => extractTime(existingEarly?.description, '14:00'));
  const [checkOutTime, setCheckOutTime] = useState(() => extractTime(existingLate?.description, '12:00'));

  const [isEarlyCustom, setIsEarlyCustom] = useState(Boolean(existingEarly));
  const [customEarlyFee, setCustomEarlyFee] = useState(existingEarly ? String(existingEarly.totalPrice) : '');

  const [isLateCustom, setIsLateCustom] = useState(Boolean(existingLate));
  const [customLateFee, setCustomLateFee] = useState(existingLate ? String(existingLate.totalPrice) : '');

  // 2. State Check-in & Đối chiếu CCCD (Module I & IX)
  const [guestIdentityNumber, setGuestIdentityNumber] = useState(item.checkInOut?.guestIdentityNumber || '');
  const [customerPhone, setCustomerPhone] = useState(item.customerPhone || '');
  const [checkInNote, setCheckInNote] = useState(item.checkInOut?.note || '');
  const [propertyDeposit, setPropertyDeposit] = useState(() => {
    const val = item.checkInOut?.propertyDeposit ?? item.checkInOut?.depositAmount;
    return val !== undefined && val !== null ? String(val) : String(policy.assets?.minimumDeposit || 500000);
  });
  const [checkInSaving, setCheckInSaving] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState('');

  // Bộ đếm khách thực tế tại Check-in (Module I)
  const [actualGuests, setActualGuests] = useState({
    adults: item.adultCount || 2,
    childUnder2: 0,
    child2To6: 0,
    child6To10: 0,
    child10To12: item.childCount || 0,
    childOver12: 0
  });

  const guestSurchargeInfo = useMemo(() => {
    return calcExtraGuestSurcharge(
      actualGuests,
      item.adultCount,
      item.childCount,
      capacity,
      policy.guests,
      pricePerNight,
      item.nights || 1
    );
  }, [actualGuests, item.adultCount, item.childCount, capacity, policy.guests, pricePerNight, item.nights]);

  // Thú cưng tại check-in (Module IV)
  const [hasPetAtCheckin, setHasPetAtCheckin] = useState(false);
  const [petCountAtCheckin, setPetCountAtCheckin] = useState(1);

  // 3. State Thêm dịch vụ phát sinh (Module VI & VII & X)
  const [chargeType, setChargeType] = useState('service');
  const [chargeDesc, setChargeDesc] = useState('');
  const [chargeQty, setChargeQty] = useState(1);
  const [chargePrice, setChargePrice] = useState('');
  const [chargeSaving, setChargeSaving] = useState(false);
  const [chargeMessage, setChargeMessage] = useState('');

  // 4. State Gia hạn lưu trú (Module V)
  const [extendNewDate, setExtendNewDate] = useState('');
  const [extendNightlyRate, setExtendNightlyRate] = useState(String(pricePerNight));
  const [extendReason, setExtendReason] = useState('');
  const [extendSaving, setExtendSaving] = useState(false);
  const [extendMessage, setExtendMessage] = useState('');

  // 5. State Đổi phòng (Module III)
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedNewRoomId, setSelectedNewRoomId] = useState('');
  const [isHomestayFault, setIsHomestayFault] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [applyDiff, setApplyDiff] = useState(true);
  const [customDiff, setCustomDiff] = useState('');
  const [roomChangeSaving, setRoomChangeSaving] = useState(false);
  const [roomChangeMessage, setRoomChangeMessage] = useState('');

  // 4 NGHIỆP VỤ BOOKING RIÊNG BIỆT (MODALS)
  const [showRoomChangeModal, setShowRoomChangeModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [showDateChangeModal, setShowDateChangeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Extend quote state
  const [extendQuote, setExtendQuote] = useState(null);
  const [loadingExtendQuote, setLoadingExtendQuote] = useState(false);

  // Date Change state
  const [dateChangeInDate, setDateChangeInDate] = useState(item.checkInDate || '');
  const [dateChangeOutDate, setDateChangeOutDate] = useState(item.checkOutDate || '');
  const [dateChangeReason, setDateChangeReason] = useState('');
  const [dateChangeCustomFee, setDateChangeCustomFee] = useState('');
  const [dateChangeQuote, setDateChangeQuote] = useState(null);
  const [loadingDateChangeQuote, setLoadingDateChangeQuote] = useState(false);
  const [dateChangeSaving, setDateChangeSaving] = useState(false);
  const [dateChangeMessage, setDateChangeMessage] = useState('');

  // Cancel Booking state
  const [cancelReason, setCancelReason] = useState('');
  const [cancelQuote, setCancelQuote] = useState(null);
  const [loadingCancelQuote, setLoadingCancelQuote] = useState(false);
  const [cancelOverrideRefund, setCancelOverrideRefund] = useState('');
  const [cancelOverrideFee, setCancelOverrideFee] = useState('');
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelMessage, setCancelMessage] = useState('');

  // 6. State Trả phòng & Bồi thường tài sản (Module VIII & IX)
  const [inspectionStatus, setInspectionStatus] = useState('intact'); // 'intact' | 'damaged'
  const [damageItemsList, setDamageItemsList] = useState([]);
  const [damageItemName, setDamageItemName] = useState('');
  const [damageItemQty, setDamageItemQty] = useState(1);
  const [damageItemPrice, setDamageItemPrice] = useState('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState('Cash');
  const [checkoutNote, setCheckoutNote] = useState('');
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  // Tính toán phí sớm / muộn động theo policy
  const earlyPolicy = calcEarlyCheckInPolicy(checkInTime, pricePerNight, policy.checkInOut);
  const latePolicy = calcLateCheckOutPolicy(checkOutTime, pricePerNight, policy.checkInOut);

  const effectiveEarlyFee = isEarlyCustom && customEarlyFee !== ''
    ? Math.max(0, Number(customEarlyFee) || 0)
    : earlyPolicy.fee;

  const effectiveLateFee = isLateCustom && customLateFee !== ''
    ? Math.max(0, Number(customLateFee) || 0)
    : latePolicy.fee;

  // Nhóm phụ phí theo phân loại chuẩn
  const chargesGrouped = useMemo(() => {
    const list = item.additionalCharges || [];
    return {
      earlyCheckIn: list.find(c => c.type === 'early_checkin'),
      lateCheckOut: list.find(c => c.type === 'late_checkout'),
      extraGuests: list.filter(c => c.type === 'extra_guest'),
      extraBeds: list.filter(c => c.type === 'extra_bed' || c.type === 'extra_item'),
      pets: list.filter(c => c.type === 'pet'),
      roomChanges: list.filter(c => c.type === 'room_upgrade'),
      stayExtensions: list.filter(c => c.type === 'stay_extension'),
      services: list.filter(c => c.type === 'service' || c.type === 'food_beverage' || c.type === 'laundry' || c.type === 'transport' || c.type === 'cleaning'),
      minibar: list.filter(c => c.type === 'minibar'),
      damage: list.filter(c => c.type === 'damage_compensation'),
      adjustments: list.filter(c => c.type === 'custom_adjustment' || c.type === 'other')
    };
  }, [item.additionalCharges]);

  // Phụ phí phát sinh trong lưu trú (trừ nhận sớm/trả muộn)
  const inStayChargesList = (item.additionalCharges || []).filter(
    c => c.type !== 'early_checkin' && c.type !== 'late_checkout'
  );
  const inStayChargesTotal = inStayChargesList.reduce((sum, c) => sum + Number(c.totalPrice || 0), 0);

  // Giá booking ban đầu (Section 4)
  const pricingSnapshot = item.pricingSnapshot || {};
  const nightsBreakdown = pricingSnapshot.nightsBreakdown || [];

  const initialRoomAmount = Number(pricingSnapshot.originalRoomAmount || item.roomAmount)
    || (Number(item.details?.[0]?.pricePerNight) * (Number(item.nights) || 1))
    || Number(item.subtotal) || 0;
  const initialDiscount = Number(item.discountAmount) || 0;
  const initialBookingTotal = Math.max(0, initialRoomAmount - initialDiscount);
  const initialSeasonalSurcharge = Number(pricingSnapshot.seasonalSurchargeAmount || 0);
  const initialNights = Number(pricingSnapshot.originalNights || pricingSnapshot.nights || item.nights || 1);
  const initialCheckIn = pricingSnapshot.originalCheckIn || item.originalCheckInDate || item.checkInDate;
  const initialCheckOut = pricingSnapshot.originalCheckOut || item.originalCheckOutDate || item.checkOutDate;
  const initialRoomName = pricingSnapshot.roomName || (item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName);

  // Khách ban đầu vs khách thực tế (Section 6)
  const initialAdults = Number(pricingSnapshot.initialAdultCount || item.adultCount || 2);
  const initialChildren = Number(pricingSnapshot.initialChildCount || item.childCount || 0);
  const initialTotalGuests = initialAdults + initialChildren;
  const actualAdultsCount = (actualGuests.adults || 0) + (actualGuests.childOver12 || 0);
  const actualChildrenCount = (actualGuests.childUnder2 || 0) + (actualGuests.child2To6 || 0) + (actualGuests.child6To10 || 0) + (actualGuests.child10To12 || 0);
  const actualTotalGuests = actualAdultsCount + actualChildrenCount;

  // Toggle lọc khoản phát sinh (Section 8) & Xem chi tiết từng đêm (Section 5)
  const [onlyShowActiveCharges, setOnlyShowActiveCharges] = useState(true);
  const [showNightlyDetail, setShowNightlyDetail] = useState(true);

  // Tính toán trực tiếp Hóa đơn lưu trú
  const baseRoomAmount = Number(item.roomAmount)
    || (Number(item.details?.[0]?.pricePerNight) * (Number(item.nights) || 1))
    || Number(item.subtotal) || 0;

  const liveSubtotal = baseRoomAmount + effectiveEarlyFee + effectiveLateFee + inStayChargesTotal;
  const liveTotalAmount = Math.max(0, liveSubtotal - Number(item.discountAmount || 0) + Number(item.serviceFee || 0) + Number(item.taxAmount || 0));
  const liveRemainingDue = liveTotalAmount - Number(item.paidAmount || 0);

  // Tiền cọc tài sản (Module IX - Tách bạch với tiền cọc phòng)
  const recordedPropertyDeposit = Number(item.checkInOut?.propertyDeposit ?? item.checkInOut?.depositAmount ?? 0);
  const recordedDamageTotal = chargesGrouped.damage.reduce((s, c) => s + Number(c.totalPrice || 0), 0);
  const pendingDamageTotal = damageItemsList.reduce((s, d) => s + (d.quantity * d.unitPrice), 0);
  const totalDamageCompensation = recordedDamageTotal + pendingDamageTotal;
  const netPropertyDepositRefund = Math.max(0, recordedPropertyDeposit - totalDamageCompensation);
  const excessDamageOwed = Math.max(0, totalDamageCompensation - recordedPropertyDeposit);

  // Phân loại phát sinh
  const extraGuestsTotal = chargesGrouped.extraGuests.reduce((s, c) => s + Number(c.totalPrice), 0);
  const extraBedsTotal = chargesGrouped.extraBeds.reduce((s, c) => s + Number(c.totalPrice), 0);
  const petsTotal = chargesGrouped.pets.reduce((s, c) => s + Number(c.totalPrice), 0);
  const roomChangesTotal = chargesGrouped.roomChanges.reduce((s, c) => s + Number(c.totalPrice), 0);
  const stayExtensionsTotal = chargesGrouped.stayExtensions.reduce((s, c) => s + Number(c.totalPrice), 0);
  const servicesTotal = chargesGrouped.services.reduce((s, c) => s + Number(c.totalPrice), 0);
  const minibarTotal = chargesGrouped.minibar.reduce((s, c) => s + Number(c.totalPrice), 0);
  const damageTotal = totalDamageCompensation;
  const adjustmentsTotal = chargesGrouped.adjustments.reduce((s, c) => s + Number(c.totalPrice), 0);
  const totalIncidentals = effectiveEarlyFee + effectiveLateFee + inStayChargesTotal + pendingDamageTotal;
  const priceFluctuationDiff = liveTotalAmount - initialBookingTotal;

  // 10 Chỉ số tài chính độc lập (Section 10)
  const paymentsList = item.payments || [];
  const depositPayments = paymentsList.filter(p => p.transactionType === 'Deposit' && p.status === 'Success');
  const depositAmountPaid = depositPayments.reduce((s, p) => s + Number(p.amount), 0) || Number(item.depositAmount || 0);
  const checkinPayments = paymentsList.filter(p => (p.transactionType === 'CheckInPayment' || (p.transactionType === 'Payment' && p.createdAt <= (item.checkInOut?.actualCheckInAt || '9999'))) && p.status === 'Success');
  const paidAtCheckin = checkinPayments.reduce((s, p) => s + Number(p.amount), 0);
  const checkoutPayments = paymentsList.filter(p => p.transactionType === 'FinalPayment' && p.status === 'Success');
  const paidAtCheckout = checkoutPayments.reduce((s, p) => s + Number(p.amount), 0);
  const refundPayments = paymentsList.filter(p => p.transactionType === 'Refund' && p.status === 'Success');
  const totalRefunded = refundPayments.reduce((s, p) => s + Number(p.amount), 0);
  const paidBefore = Math.max(0, Number(item.paidAmount || 0) - paidAtCheckin - paidAtCheckout + totalRefunded);

  const [hostNoteSaving, setHostNoteSaving] = useState(false);
  const [hostNoteMessage, setHostNoteMessage] = useState('');

  // 1. Thao tác Check-in (Đối chiếu CCCD & Thu cọc tài sản & Phụ thu phát sinh)
  const handleCheckIn = async () => {
    if (!guestIdentityNumber.trim()) {
      alert('Vui lòng nhập số CCCD hoặc Hộ chiếu của khách để đối chiếu trước khi xác nhận check-in.');
      return;
    }
    setCheckInSaving(true);
    setCheckInMessage('');
    try {
      const extraItems = [];
      const petFeeTotal = hasPetAtCheckin
        ? (petCountAtCheckin * (policy.pets?.feePerNight || 150000) * (item.nights || 1))
        : 0;

      const payload = {
        guestIdentityNumber: guestIdentityNumber.trim(),
        customerPhone: customerPhone.trim(),
        checkInTime,
        earlyCheckInFee: effectiveEarlyFee,
        propertyDeposit: Number(propertyDeposit) || 0,
        actualGuests,
        extraGuestFee: guestSurchargeInfo.totalSurcharge > 0 ? guestSurchargeInfo.totalSurcharge : null,
        petCount: hasPetAtCheckin ? petCountAtCheckin : 0,
        petFee: petFeeTotal > 0 ? petFeeTotal : null,
        extraItems: extraItems.length ? extraItems : null,
        note: checkInNote.trim() || `Check-in lúc ${checkInTime}, đối chiếu CCCD: ${guestIdentityNumber.trim()}`
      };

      const res = await homestayApi.checkInBooking(item.id, payload);
      setItem(prev => ({
        ...prev,
        status: res.status,
        roomAmount: res.roomAmount || prev.roomAmount,
        subtotal: res.subtotal || prev.subtotal,
        totalAmount: res.totalAmount || prev.totalAmount,
        additionalCharges: res.additionalCharges || prev.additionalCharges,
        checkInOut: {
          ...(prev.checkInOut || {}),
          guestIdentityNumber: res.guestIdentityNumber,
          actualCheckInAt: res.actualCheckInAt,
          propertyDeposit: res.propertyDeposit,
          depositAmount: res.propertyDeposit,
          status: 'CheckedIn'
        }
      }));
      setCheckInMessage(res.message || 'Xác nhận đối chiếu và check-in thành công!');
      run(homestayApi.hostBookings, false);
    } catch (err) {
      alert(err.message || 'Lỗi khi xác nhận check-in.');
    } finally {
      setCheckInSaving(false);
    }
  };

  // 2. Thao tác Thêm khoản phụ phí / dịch vụ phát sinh
  const handleAddCharge = async (overridePayload = null) => {
    const payload = overridePayload || {
      type: chargeType,
      description: chargeDesc.trim(),
      quantity: Number(chargeQty) || 1,
      unitPrice: Number(chargePrice)
    };

    if (!payload.description || payload.quantity <= 0) {
      alert('Vui lòng nhập tên dịch vụ và số lượng hợp lệ.');
      return;
    }
    setChargeSaving(true);
    setChargeMessage('');
    try {
      const res = await homestayApi.addAdditionalCharge(item.id, payload);
      setItem(prev => ({
        ...prev,
        subtotal: res.subtotal,
        totalAmount: res.totalAmount,
        additionalCharges: res.additionalCharges
      }));
      if (!overridePayload) {
        setChargeDesc('');
        setChargePrice('');
        setChargeQty(1);
      }
      setChargeMessage(res.message || 'Đã thêm khoản phát sinh vào hóa đơn!');
      setShowIncidentalModal(false);
      run(homestayApi.hostBookings, false);
    } catch (err) {
      alert(err.message || 'Lỗi khi thêm khoản phát sinh.');
    } finally {
      setChargeSaving(false);
    }
  };

  // 3. Thao tác Xóa khoản phụ phí
  const handleRemoveCharge = async (chargeId) => {
    if (!window.confirm('Bạn có chắc muốn xóa khoản phụ phí này khỏi hóa đơn?')) return;
    try {
      const res = await homestayApi.removeAdditionalCharge(item.id, chargeId);
      setItem(prev => ({
        ...prev,
        subtotal: res.subtotal,
        totalAmount: res.totalAmount,
        additionalCharges: res.additionalCharges
      }));
      run(homestayApi.hostBookings, false);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa khoản phụ phí.');
    }
  };

  // 4. Thao tác Gia hạn lưu trú (Module V)
  const handleExtendStay = async () => {
    if (!extendNewDate || extendNewDate <= item.checkOutDate) {
      alert(`Vui lòng chọn ngày trả phòng mới sau ngày ${item.checkOutDate}.`);
      return;
    }
    setExtendSaving(true);
    setExtendMessage('');
    try {
      const res = await homestayApi.extendStay(item.id, {
        newCheckOutDate: extendNewDate,
        customNightlyRate: Number(extendNightlyRate) || null,
        reason: extendReason.trim()
      });
      setItem(prev => ({
        ...prev,
        checkOutDate: res.newCheckOutDate,
        subtotal: res.subtotal,
        totalAmount: res.totalAmount,
        additionalCharges: res.additionalCharges,
        nights: (prev.nights || 0) + (res.extendedNights || 1)
      }));
      setExtendMessage(res.message || 'Đã gia hạn thành công!');
      setShowIncidentalModal(false);
      setTimeout(() => setShowExtendModal(false), 1200);
      run(homestayApi.hostBookings, false);
    } catch (err) {
      setExtendMessage(err.message || 'Lỗi khi gia hạn lưu trú.');
    } finally {
      setExtendSaving(false);
    }
  };

  // 5. Thao tác Đổi phòng (Module III)
  const loadAvailableRooms = async () => {
    setLoadingRooms(true);
    setSelectedNewRoomId('');
    setRoomChangeMessage('');
    try {
      const res = await homestayApi.getAvailableRoomsForChange(item.id);
      setAvailableRooms(res.availableRooms || []);
    } catch (err) {
      alert(err.message || 'Lỗi khi tải danh sách phòng trống.');
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleChangeRoom = async () => {
    if (!selectedNewRoomId) {
      alert('Vui lòng chọn phòng mới muốn chuyển sang.');
      return;
    }
    setRoomChangeSaving(true);
    setRoomChangeMessage('');
    try {
      const selectedRoom = availableRooms.find(r => String(r.id) === String(selectedNewRoomId));
      const res = await homestayApi.changeBookingRoom(item.id, {
        newRoomId: Number(selectedNewRoomId),
        reason: changeReason.trim(),
        applyDifference: applyDiff,
        customPriceDifference: customDiff !== '' ? Number(customDiff) : null,
        isHomestayFault
      });
      setItem(prev => ({
        ...prev,
        subtotal: res.subtotal,
        totalAmount: res.totalAmount,
        details: (prev.details || []).map(d => String(d.roomId) === String(res.oldRoomId) ? ({
          ...d,
          roomId: res.newRoomId,
          roomNumber: res.newRoomNumber,
          roomTypeName: res.newRoomTypeName || selectedRoom?.roomTypeName || d.roomTypeName
        }) : d)
      }));
      setRoomChangeMessage(res.message || 'Đổi phòng thành công!');
      run(homestayApi.hostBookings, false);
      loadAvailableRooms();
      setTimeout(() => setShowRoomChangeModal(false), 1200);
    } catch (err) {
      setRoomChangeMessage(err.message || 'Lỗi khi thực hiện đổi phòng.');
    } finally {
      setRoomChangeSaving(false);
    }
  };

  // 6. Thao tác Đổi ngày lưu trú (Nghiệp vụ Đổi ngày)
  const fetchDateChangeQuote = async (newIn, newOut, fee = null) => {
    if (!newIn || !newOut || newOut <= newIn) return;
    setLoadingDateChangeQuote(true);
    try {
      const res = await homestayApi.calculateDateChange(item.id, {
        newCheckInDate: newIn,
        newCheckOutDate: newOut,
        customFee: fee !== null && fee !== '' ? Number(fee) : null
      });
      setDateChangeQuote(res);
    } catch {
      setDateChangeQuote(null);
    } finally {
      setLoadingDateChangeQuote(false);
    }
  };

  const handleChangeDates = async () => {
    if (!dateChangeInDate || !dateChangeOutDate || dateChangeOutDate <= dateChangeInDate) {
      alert('Vui lòng chọn ngày nhận phòng và ngày trả phòng hợp lệ.');
      return;
    }
    setDateChangeSaving(true);
    setDateChangeMessage('');
    try {
      const res = await homestayApi.changeBookingDates(item.id, {
        newCheckInDate: dateChangeInDate,
        newCheckOutDate: dateChangeOutDate,
        customFee: dateChangeCustomFee !== '' ? Number(dateChangeCustomFee) : null,
        reason: dateChangeReason.trim()
      });
      setItem(prev => ({
        ...prev,
        checkInDate: res.newCheckInDate,
        checkOutDate: res.newCheckOutDate,
        nights: res.newNights,
        roomAmount: res.newRoomAmount,
        subtotal: res.subtotal,
        totalAmount: res.totalAmount
      }));
      setDateChangeMessage(res.message || 'Đổi ngày lưu trú thành công!');
      run(homestayApi.hostBookings, false);
      setTimeout(() => setShowDateChangeModal(false), 1200);
    } catch (err) {
      alert(err.message || 'Lỗi khi đổi ngày lưu trú.');
    } finally {
      setDateChangeSaving(false);
    }
  };

  // 7. Thao tác Gia hạn lưu trú Quote
  const fetchExtendQuote = async (newOut, rate = null) => {
    if (!newOut || newOut <= item.checkOutDate) return;
    setLoadingExtendQuote(true);
    try {
      const res = await homestayApi.calculateExtension(item.id, {
        newCheckOutDate: newOut,
        customNightlyRate: rate !== null && rate !== '' ? Number(rate) : null
      });
      setExtendQuote(res);
    } catch {
      setExtendQuote(null);
    } finally {
      setLoadingExtendQuote(false);
    }
  };

  // 8. Thao tác Hủy đơn đặt phòng (Nghiệp vụ Hủy đơn)
  const fetchCancelQuote = async () => {
    setLoadingCancelQuote(true);
    try {
      const res = await homestayApi.calculateCancellation(item.id);
      setCancelQuote(res);
      setCancelOverrideRefund(String(res.refundAmount || 0));
      setCancelOverrideFee(String(res.cancellationFee || 0));
    } catch (err) {
      alert(err.message || 'Lỗi khi tính toán hoàn tiền hủy đơn.');
    } finally {
      setLoadingCancelQuote(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn HỦY đơn đặt phòng ${item.bookingCode}?\nThao tác này sẽ chuyển đơn sang trạng thái ĐÃ HỦY và giải phóng phòng.`)) return;
    setCancelSaving(true);
    setCancelMessage('');
    try {
      const res = await homestayApi.cancelBooking(item.id, {
        reason: cancelReason.trim(),
        overrideRefundAmount: cancelOverrideRefund !== '' ? Number(cancelOverrideRefund) : null,
        overrideCancellationFee: cancelOverrideFee !== '' ? Number(cancelOverrideFee) : null
      });
      setItem(prev => ({
        ...prev,
        status: 'Cancelled',
        cancellation: {
          refundAmount: res.refundAmount,
          cancellationFee: res.cancellationFee,
          status: 'Cancelled'
        }
      }));
      setCancelMessage(res.message || 'Đã hủy đơn thành công!');
      run(homestayApi.hostBookings, false);
      setTimeout(() => setShowCancelModal(false), 1200);
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy đơn đặt phòng.');
    } finally {
      setCancelSaving(false);
    }
  };

  // 6. Thao tác Trả phòng & Quyết toán (Module VIII & IX & Checkout)
  const handleCheckOut = async () => {
    const balance = liveRemainingDue;
    const paymentAmount = balance > 0 ? balance : 0;
    const refundAmount = balance < 0 ? Math.abs(balance) : 0;

    let confirmMsg = `XÁC NHẬN QUYẾT TOÁN TRẢ PHÒNG (CHECK-OUT):\n\n`;
    confirmMsg += `1. TIỀN PHÒNG & DỊCH VỤ: ${balance > 0 ? `Thu thêm ${money(paymentAmount)}` : balance < 0 ? `Hoàn lại tiền cọc ${money(refundAmount)}` : 'Đã thanh toán đủ (0đ)'}\n`;
    confirmMsg += `2. CỌC TÀI SẢN: Cọc giữ ${money(recordedPropertyDeposit)} - Thiệt hại ${money(totalDamageCompensation)} = ${netPropertyDepositRefund > 0 ? `Hoàn trả cọc tài sản ${money(netPropertyDepositRefund)}` : excessDamageOwed > 0 ? `Thu thêm tiền bồi thường ${money(excessDamageOwed)}` : '0đ'}\n\n`;
    confirmMsg += checkoutPaymentMethod === 'Cash'
      ? `Phương thức: Tiền mặt.\nXác nhận hoàn tất và giải phóng phòng?`
      : `Phương thức: VNPay.\nHệ thống sẽ mở lại cổng VNPay; chỉ hoàn tất và giải phóng phòng sau khi thanh toán thành công.`;

    if (!window.confirm(confirmMsg)) return;

    setCheckoutSaving(true);
    setCheckoutMessage('');
    try {
      const res = await homestayApi.checkOutBooking(item.id, {
        paymentMethod: checkoutPaymentMethod,
        paymentAmount,
        refundAmount,
        checkOutTime,
        lateCheckoutFee: effectiveLateFee,
        propertyDepositRefund: netPropertyDepositRefund,
        damageItems: damageItemsList.length ? damageItemsList : null,
        note: checkoutNote.trim()
      });
      if (res.requiresOnlinePayment && res.paymentUrl) {
        setCheckoutMessage(res.message || 'Đang chuyển đến cổng thanh toán VNPay...');
        window.location.assign(res.paymentUrl);
        return;
      }
      setItem(prev => ({
        ...prev,
        status: res.status,
        paymentStatus: res.paymentStatus,
        paidAmount: prev.paidAmount + paymentAmount - refundAmount,
        checkInOut: {
          ...(prev.checkInOut || {}),
          actualCheckOutAt: res.actualCheckOutAt,
          status: 'CheckedOut'
        }
      }));
      setCheckoutMessage(res.message || 'Đã hoàn tất trả phòng thành công!');
      run(homestayApi.hostBookings, false);
    } catch (err) {
      setCheckoutMessage(err.message || 'Lỗi khi xử lý trả phòng.');
    } finally {
      setCheckoutSaving(false);
    }
  };

  const copy = () => navigator.clipboard?.writeText(item.customerPhone || '');
  const saveNote = async () => {
    setHostNoteSaving(true);
    setHostNoteMessage('');
    try {
      const res = await homestayApi.updateBookingNote(item.id, note);
      setItem(prev => ({
        ...prev,
        hostNote: note,
        updatedAt: new Date().toISOString()
      }));
      setHostNoteMessage(res.message || 'Đã lưu ghi chú nội bộ thành công!');
      run(homestayApi.hostBookings, false);
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu ghi chú nội bộ.');
    } finally {
      setHostNoteSaving(false);
    }
  };

  const print = () => {
    const win = window.open('', '_blank', 'width=880,height=980');
    if (!win) return;
    const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    win.document.write(`
      <title>Hóa đơn quyết toán ${safe(item.bookingCode)}</title>
      <style>
        body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 32px; color: #1e293b; background: #fff; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #09275f; padding-bottom: 16px; margin-bottom: 20px; }
        h1 { color: #09275f; font-size: 22px; margin: 0 0 4px; }
        h2 { color: #475569; font-size: 15px; margin: 0; font-weight: 600; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
        .meta-grid p { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th, td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        th { background: #f1f5f9; color: #09275f; font-weight: 700; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .total-row { background: #eff6ff; font-weight: bold; border-top: 2px solid #3b82f6; border-bottom: 2px solid #3b82f6; }
        .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 16px 0; }
        .deposit-box { background: #fefce8; border-color: #fde047; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 40px; text-align: center; }
        .sig-block { min-width: 150px; }
        .sig-space { height: 60px; }
      </style>
      <div class="header">
        <div>
          <h1>TRIPIO · HÓA ĐƠN QUYẾT TOÁN LƯU TRÚ</h1>
          <h2>Mã đơn: ${safe(item.bookingCode)}</h2>
        </div>
        <div style="text-align: right;">
          <strong>${safe(item.homestayName)}</strong><br/>
          <small>Thời gian quyết toán: ${new Date().toLocaleString('vi-VN')}</small>
        </div>
      </div>

      <div class="meta-grid">
        <div>
          <p>Khách hàng: <b>${safe(item.customerName)}</b></p>
          <p>Số điện thoại: <b>${safe(item.customerPhone || '—')}</b></p>
          <p>CCCD/Hộ chiếu: <b>${safe(item.checkInOut?.guestIdentityNumber || '—')}</b></p>
          <p>Quốc gia: <b>${safe(item.customerCountry || 'Việt Nam')}</b></p>
        </div>
        <div>
          <p>Phòng: <b>${safe(item.details?.map(d => `${d.roomTypeName}${d.roomNumber ? ` · ${d.roomNumber}` : ''}`).join(', ') || 'Chưa xếp phòng')}</b></p>
          <p>Lưu trú: <b>${safe(date(item.checkInDate))} → ${safe(date(item.checkOutDate))} (${safe(item.nights)} đêm)</b></p>
          <p>Khách lúc đặt: <b>${safe(item.adultCount)} lớn, ${safe(item.childCount)} trẻ</b></p>
          <p>Khách thực tế: <b>${safe(actualAdultsCount)} lớn, ${safe(actualChildrenCount)} trẻ</b></p>
        </div>
      </div>

      <h3>1. BẢNG KÊ CHI TIẾT TIỀN PHÒNG & KHOẢN PHÁT SINH (13 HẠNG MỤC)</h3>
      <table>
        <thead>
          <tr>
            <th>STT</th>
            <th>Hạng mục</th>
            <th>Phân loại</th>
            <th class="right">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Tiền phòng ban đầu (${safe(item.nights)} đêm)</td>
            <td>Phòng gốc</td>
            <td class="right">${safe(money(initialRoomAmount))}</td>
          </tr>
          ${initialDiscount > 0 ? `
          <tr>
            <td>2</td>
            <td>Khuyến mãi giảm trừ</td>
            <td>Chiết khấu</td>
            <td class="right">-${safe(money(initialDiscount))}</td>
          </tr>` : ''}
          ${effectiveEarlyFee > 0 ? `
          <tr>
            <td>3</td>
            <td>Phụ thu nhận phòng sớm (Check-in lúc ${safe(checkInTime)})</td>
            <td>Nhận sớm</td>
            <td class="right">+${safe(money(effectiveEarlyFee))}</td>
          </tr>` : ''}
          ${effectiveLateFee > 0 ? `
          <tr>
            <td>4</td>
            <td>Phụ thu trả phòng muộn (Check-out lúc ${safe(checkOutTime)})</td>
            <td>Trả muộn</td>
            <td class="right">+${safe(money(effectiveLateFee))}</td>
          </tr>` : ''}
          ${extraGuestsTotal > 0 ? `
          <tr>
            <td>5</td>
            <td>Phụ thu thêm khách / trẻ em</td>
            <td>Phụ thu khách</td>
            <td class="right">+${safe(money(extraGuestsTotal))}</td>
          </tr>` : ''}
          ${extraBedsTotal > 0 ? `
          <tr>
            <td>6</td>
            <td>Giường phụ & vật dụng phòng thêm</td>
            <td>Giường phụ</td>
            <td class="right">+${safe(money(extraBedsTotal))}</td>
          </tr>` : ''}
          ${servicesTotal > 0 ? `
          <tr>
            <td>7</td>
            <td>Dịch vụ tiện ích (Bữa sáng, xe máy, BBQ...)</td>
            <td>Dịch vụ</td>
            <td class="right">+${safe(money(servicesTotal))}</td>
          </tr>` : ''}
          ${minibarTotal > 0 ? `
          <tr>
            <td>8</td>
            <td>Minibar đồ uống & snack</td>
            <td>Minibar</td>
            <td class="right">+${safe(money(minibarTotal))}</td>
          </tr>` : ''}
          ${petsTotal > 0 ? `
          <tr>
            <td>9</td>
            <td>Phụ phí lưu trú thú cưng</td>
            <td>Thú cưng</td>
            <td class="right">+${safe(money(petsTotal))}</td>
          </tr>` : ''}
          ${stayExtensionsTotal > 0 ? `
          <tr>
            <td>10</td>
            <td>Gia hạn thời gian lưu trú</td>
            <td>Gia hạn</td>
            <td class="right">+${safe(money(stayExtensionsTotal))}</td>
          </tr>` : ''}
          ${roomChangesTotal > 0 ? `
          <tr>
            <td>11</td>
            <td>Chênh lệch đổi / nâng hạng phòng</td>
            <td>Đổi phòng</td>
            <td class="right">+${safe(money(roomChangesTotal))}</td>
          </tr>` : ''}
          ${damageTotal > 0 ? `
          <tr>
            <td>12</td>
            <td>Bồi thường thiệt hại tài sản phòng</td>
            <td>Bồi thường</td>
            <td class="right">+${safe(money(damageTotal))}</td>
          </tr>` : ''}
          ${adjustmentsTotal !== 0 ? `
          <tr>
            <td>13</td>
            <td>Điều chỉnh khác</td>
            <td>Điều chỉnh</td>
            <td class="right">${adjustmentsTotal >= 0 ? `+${safe(money(adjustmentsTotal))}` : `-${safe(money(Math.abs(adjustmentsTotal)))}`}</td>
          </tr>` : ''}
          <tr class="total-row">
            <td colspan="3">TỔNG HÓA ĐƠN LƯU TRÚ CUỐI CÙNG</td>
            <td class="right">${safe(money(liveTotalAmount))}</td>
          </tr>
          <tr>
            <td colspan="3">Tiền khách đã thanh toán (Cọc phòng / Online)</td>
            <td class="right">${safe(money(item.paidAmount))}</td>
          </tr>
          <tr style="font-weight: bold; font-size: 14px;">
            <td colspan="3">${liveRemainingDue > 0 ? 'CÒN PHẢI THU' : liveRemainingDue < 0 ? 'CẦN HOÀN TIỀN CỌC PHÒNG' : 'TÌNH TRẠNG CÔNG NỢ'}</td>
            <td class="right" style="color: ${liveRemainingDue > 0 ? '#b91c1c' : '#15803d'}">
              ${liveRemainingDue !== 0 ? safe(money(Math.abs(liveRemainingDue))) : 'Đã thanh toán đủ (0đ)'}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="box deposit-box">
        <h3 style="margin-top: 0; color: #854d0e;">2. QUYẾT TOÁN TIỀN CỌC TÀI SẢN (SEPARATE DEPOSIT CHANNEL)</h3>
        <p>• Tiền cọc tài sản đã thu khi Check-in: <b>${safe(money(recordedPropertyDeposit))}</b></p>
        <p>• Tổng bồi thường thiệt hại tài sản khấu trừ: <b style="color: #b91c1c;">-${safe(money(damageTotal))}</b></p>
        <p style="font-size: 14px; font-weight: bold; margin-top: 10px; color: ${netPropertyDepositRefund > 0 ? '#15803d' : '#854d0e'}">
          ➔ HOÀN TRẢ CỌC TÀI SẢN CHO KHÁCH: ${safe(money(netPropertyDepositRefund))}
          ${excessDamageOwed > 0 ? ` (Khách cần nộp thêm tiền bồi thường phần vượt: ${safe(money(excessDamageOwed))})` : ''}
        </p>
      </div>

      <div class="signatures">
        <div class="sig-block">
          <strong>Khách hàng</strong>
          <div class="sig-space"></div>
          <div>${safe(item.customerName)}</div>
        </div>
        <div class="sig-block">
          <strong>Đại diện Homestay</strong>
          <div class="sig-space"></div>
          <div>${safe(item.homestayName)}</div>
        </div>
      </div>

      <div class="footer">
        <span>In từ phần mềm Tripio Host Management</span>
        <span>Mã tra cứu: ${safe(item.bookingCode)}</span>
      </div>
    `);
    win.document.close();
    win.print();
  };

  const bookingActions = useMemo(() => {
    const list = [];
    if (!['Cancelled', 'CheckedOut', 'Completed'].includes(item.status)) {
      list.push({
        label: '+ Thêm khoản phát sinh',
        icon: 'plus',
        handler: () => {
          setIncidentalCategory('service');
          setShowIncidentalModal(true);
        }
      });
    }

    if (['Confirmed', 'CheckedIn'].includes(item.status)) {
      list.push({
        label: 'Đổi phòng',
        icon: 'key',
        handler: () => {
          loadAvailableRooms();
          setShowRoomChangeModal(true);
        }
      });
      list.push({
        label: 'Gia hạn lưu trú',
        icon: 'clock',
        handler: () => {
          const nextDay = new Date(item.checkOutDate);
          nextDay.setDate(nextDay.getDate() + 1);
          const nextStr = nextDay.toISOString().slice(0, 10);
          setExtendNewDate(nextStr);
          setExtendReason('');
          setExtendMessage('');
          fetchExtendQuote(nextStr);
          setShowExtendModal(true);
        }
      });
    }

    if (!['Cancelled', 'CheckedOut', 'Completed'].includes(item.status)) {
      list.push({
        label: 'Đổi ngày lưu trú',
        icon: 'calendar',
        handler: () => {
          setDateChangeInDate(item.checkInDate || '');
          setDateChangeOutDate(item.checkOutDate || '');
          setDateChangeReason('');
          setDateChangeCustomFee('');
          setDateChangeMessage('');
          fetchDateChangeQuote(item.checkInDate, item.checkOutDate);
          setShowDateChangeModal(true);
        }
      });
    }

    list.push({
      label: 'In hóa đơn quyết toán',
      icon: 'printer',
      handler: print
    });

    if (['Hold', 'Confirmed'].includes(item.status)) {
      list.push({
        label: 'Hủy đơn đặt phòng',
        icon: 'close',
        danger: true,
        handler: () => {
          setCancelReason('');
          setCancelMessage('');
          fetchCancelQuote();
          setShowCancelModal(true);
        }
      });
    }

    return list;
  }, [item, print, loadAvailableRooms, fetchExtendQuote, fetchDateChangeQuote, fetchCancelQuote]);

  return (
    <div className={`booking-modal ${isMaximized ? 'is-maximized' : ''}`} onMouseDown={e => e.target === e.currentTarget && close()}>
      <section>
        {/* REFACTORED HEADER BAR (SECTION XXII) */}
        <div className="booking-header-bar">
          <div className="booking-header-code-name">
            <small>CHI TIẾT ĐƠN ĐẶT PHÒNG</small>
            <h2>{item.bookingCode}</h2>
            <p><strong>{item.customerName}</strong><span>{item.homestayName}{item.details?.[0]?.roomNumber ? ` · Phòng ${item.details[0].roomNumber}` : ''}</span></p>
          </div>

          <div className="booking-header-badges">
            <span className={`status status-${item.status.toLowerCase()}`}>{labels[item.status] || item.status}</span>
            <span className={`payment-${paymentState(item)}`}>
              {depositAmountPaid > 0 ? `Đã cọc ${money(depositAmountPaid)}` : 'Chưa đặt cọc'}
            </span>
            {liveRemainingDue > 0 ? (
              <span className="badge-debt-due">Còn thiếu {money(liveRemainingDue)}</span>
            ) : liveRemainingDue < 0 ? (
              <span className="badge-debt-refund">Cần hoàn {money(Math.abs(liveRemainingDue))}</span>
            ) : (
              <span className="badge-debt-settled">Đã thanh toán đủ</span>
            )}
            {item.checkInOut?.guestIdentityNumber && (
              <span className="identity-verified-pill">
                <HostIcon name="check" size={13} />
                <span>CCCD: {item.checkInOut.guestIdentityNumber}</span>
              </span>
            )}
            {recordedPropertyDeposit > 0 && (
              <span className="badge-property-deposit">
                <span>Cọc tài sản: {money(recordedPropertyDeposit)}</span>
              </span>
            )}
          </div>

          <div className="booking-header-right">
            {/* DUY NHẤT 1 PRIMARY ACTION THEO TRẠNG THÁI */}
            {['Hold', 'Confirmed'].includes(item.status) && (
              <button
                type="button"
                className="btn-primary-action action-green"
                onClick={() => setActiveTab('checkin')}
                title="Tiến hành nhận phòng cho khách"
              >
                <HostIcon name="check" size={16} />
                <span>✓ Check-in</span>
              </button>
            )}

            {item.status === 'CheckedIn' && (
              <button
                type="button"
                className="btn-primary-action action-green"
                onClick={() => setActiveTab('checkout')}
                title="Tiến hành kiểm tra & trả phòng cho khách"
              >
                <HostIcon name="check" size={16} />
                <span>✓ Tiến hành Check-out</span>
              </button>
            )}

            {['CheckedOut', 'Completed'].includes(item.status) && (
              <button
                type="button"
                className="btn-primary-action"
                onClick={print}
                title="In hóa đơn quyết toán hoàn tất"
              >
                <HostIcon name="printer" size={16} />
                <span>In hóa đơn</span>
              </button>
            )}

            {item.status === 'Cancelled' && (
              <button
                type="button"
                className="btn-primary-action"
                onClick={print}
                title="In chứng từ đơn đã hủy"
              >
                <HostIcon name="printer" size={16} />
                <span>In phiếu hủy</span>
              </button>
            )}

            {/* ACTION DROPDOWN MENU [⋮ Thao tác ▼] */}
            <BookingActionMenu actions={bookingActions} />

            <button
              type="button"
              className="booking-modal-expand"
              onClick={() => setIsMaximized(value => !value)}
              aria-label={isMaximized ? 'Thu nhỏ cửa sổ' : 'Phóng to cửa sổ'}
              title={isMaximized ? 'Thu nhỏ' : 'Phóng to'}
              aria-pressed={isMaximized}
            >
              {isMaximized ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 20v-5h5M4 9l5-5M20 15l-5 5" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>
              )}
            </button>

            <button className="booking-modal-close" onClick={close} aria-label="Đóng">
              <HostIcon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* 6 MAIN TABS NAV */}
        <div className="lifecycle-tabs-nav" role="tablist" aria-label="Các phần của đơn đặt phòng">
          <button
            type="button"
            className={`lifecycle-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            role="tab" aria-selected={activeTab === 'overview'}
          >
            <HostIcon name="bookings" size={15} />
            <span>Tổng quan</span>
          </button>

          <button
            type="button"
            className={`lifecycle-tab-btn ${activeTab === 'checkin' ? 'active' : ''}`}
            onClick={() => setActiveTab('checkin')}
            role="tab" aria-selected={activeTab === 'checkin'}
          >
            <HostIcon name="key" size={15} />
            <span>Check-in</span>
            {item.checkInOut?.guestIdentityNumber && <span className="tab-pill-success">Đã đối chiếu</span>}
          </button>

          <button
            type="button"
            className={`lifecycle-tab-btn ${activeTab === 'stay' ? 'active' : ''}`}
            onClick={() => setActiveTab('stay')}
            role="tab" aria-selected={activeTab === 'stay'}
          >
            <HostIcon name="tag" size={15} />
            <span>Đang ở & dịch vụ</span>
            {inStayChargesList.length > 0 && <span className="tab-pill-count">{inStayChargesList.length}</span>}
          </button>

          <button
            type="button"
            className={`lifecycle-tab-btn ${activeTab === 'checkout' ? 'active' : ''}`}
            onClick={() => setActiveTab('checkout')}
            role="tab" aria-selected={activeTab === 'checkout'}
          >
            <HostIcon name="calendar" size={15} />
            <span>Check-out</span>
            {['CheckedOut', 'Completed'].includes(item.status) && <span className="tab-pill-success">Đã trả</span>}
          </button>

          <button
            type="button"
            className={`lifecycle-tab-btn ${activeTab === 'bill' ? 'active' : ''}`}
            onClick={() => setActiveTab('bill')}
            role="tab" aria-selected={activeTab === 'bill'}
          >
            <HostIcon name="finance" size={15} />
            <span>Hóa đơn</span>
            {liveRemainingDue > 0 && <span className="tab-pill-warning">Còn nợ</span>}
          </button>

          <button
            type="button"
            className={`lifecycle-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
            role="tab" aria-selected={activeTab === 'history'}
          >
            <HostIcon name="clock" size={15} />
            <span>Lịch sử</span>
            {(item.payments?.length || 0) + (item.auditLogs?.length || 0) > 0 && (
              <span className="tab-pill-count">{(item.payments?.length || 0) + (item.auditLogs?.length || 0)}</span>
            )}
          </button>
        </div>

        {/* TAB 1: TỔNG QUAN & LƯU TRÚ (Section 2, 3, 13, 16) */}
        {activeTab === 'overview' && (
          <div className="tab-content-pane overview-pane" role="tabpanel">
            {/* SECTION 13: TIẾN TRÌNH VÒNG ĐỜI KÈM TIMESTAMP */}
            <section className="booking-timeline" style={{ marginTop: 0 }}>
              <h3>Tiến trình vòng đời đơn đặt phòng (Lịch sử trạng thái)</h3>
              <div>
                <span className="done">
                  <b><HostIcon name="check" size={12} /></b>
                  <small>1. Đã đặt đơn</small>
                  <em>{dateTime(item.createdAt)}</em>
                </span>
                <span className={depositAmountPaid > 0 ? 'done' : ''}>
                  <b>{depositAmountPaid > 0 ? <HostIcon name="check" size={12} /> : '2'}</b>
                  <small>2. Đã cọc / TT</small>
                  <em>{depositAmountPaid > 0 ? (depositPayments[0] ? dateTime(depositPayments[0].createdAt) : dateTime(item.createdAt)) : 'Chưa cọc'}</em>
                </span>
                <span className={['Confirmed', 'CheckedIn', 'CheckedOut', 'Completed'].includes(item.status) ? 'done' : ''}>
                  <b>{['Confirmed', 'CheckedIn', 'CheckedOut', 'Completed'].includes(item.status) ? <HostIcon name="check" size={12} /> : '3'}</b>
                  <small>3. Xác nhận</small>
                  <em>{['Confirmed', 'CheckedIn', 'CheckedOut', 'Completed'].includes(item.status) ? dateTime(item.createdAt) : 'Chờ xác nhận'}</em>
                </span>
                <span className={['CheckedIn', 'CheckedOut', 'Completed'].includes(item.status) ? 'done' : ''}>
                  <b>{['CheckedIn', 'CheckedOut', 'Completed'].includes(item.status) ? <HostIcon name="check" size={12} /> : '4'}</b>
                  <small>4. Check-in (Đang ở)</small>
                  <em>{item.checkInOut?.actualCheckInAt ? dateTime(item.checkInOut.actualCheckInAt) : 'Chưa check-in'}</em>
                </span>
                <span className={['CheckedOut', 'Completed'].includes(item.status) ? 'done' : ''}>
                  <b>{['CheckedOut', 'Completed'].includes(item.status) ? <HostIcon name="check" size={12} /> : '5'}</b>
                  <small>5. Check-out (Trả phòng)</small>
                  <em>{item.checkInOut?.actualCheckOutAt ? dateTime(item.checkInOut.actualCheckOutAt) : 'Chưa check-out'}</em>
                </span>
                <span className={['CheckedOut', 'Completed'].includes(item.status) ? 'done' : ''}>
                  <b>{['CheckedOut', 'Completed'].includes(item.status) ? <HostIcon name="check" size={12} /> : '6'}</b>
                  <small>6. Hoàn tất</small>
                  <em>{['CheckedOut', 'Completed'].includes(item.status) ? dateTime(item.checkInOut?.actualCheckOutAt || item.updatedAt) : 'Chờ hoàn tất'}</em>
                </span>
              </div>
            </section>

            {/* SECTION 16: SO SÁNH GIÁ BAN ĐẦU VÀ GIÁ CUỐI CÙNG (DÒNG CHẢY BIẾN ĐỘNG) */}
            <div className={`price-fluctuation-card ${priceFluctuationDiff === 0 ? 'no-change' : ''}`}>
              <div className="price-fluctuation-title">
                <span>Biến động giá booking (So sánh Giá ban đầu vs Giá cuối cùng)</span>
                <span className={priceFluctuationDiff > 0 ? 'text-danger' : priceFluctuationDiff < 0 ? 'text-success' : ''}>
                  {priceFluctuationDiff > 0 ? `Biến động tăng: +${money(priceFluctuationDiff)}` : priceFluctuationDiff < 0 ? `Biến động giảm: -${money(Math.abs(priceFluctuationDiff))}` : 'Không biến động (0đ)'}
                </span>
              </div>
              <div className="price-fluctuation-flow">
                <div className="price-flow-step">
                  <small>Giá booking ban đầu</small>
                  <strong>{money(initialBookingTotal)}</strong>
                </div>
                <span className="price-flow-arrow">➔</span>
                <div className="price-flow-step positive">
                  <small>Các khoản phát sinh</small>
                  <strong>+{money(totalIncidentals)}</strong>
                </div>
                <span className="price-flow-arrow">➔</span>
                <div className="price-flow-step negative">
                  <small>Các khoản giảm trừ</small>
                  <strong>-{money(initialDiscount)}</strong>
                </div>
                <span className="price-flow-arrow">➔</span>
                <div className="price-flow-step final">
                  <small>TỔNG GIÁ CUỐI CÙNG</small>
                  <strong>{money(liveTotalAmount)}</strong>
                </div>
              </div>
            </div>

            {/* SECTION 7: ĐỐI CHIẾU DỮ LIỆU BAN ĐẦU VÀ TRẠNG THÁI HIỆN TẠI (KHÔNG GHI ĐÈ DỮ LIỆU GỐC) */}
            <div className="baseline-comparison-card">
              <div className="baseline-comparison-header">
                <div>
                  <span className="baseline-title">Đối chiếu Dữ liệu ban đầu & Trạng thái hiện tại</span>
                  <p className="baseline-subtitle">
                    Nguyên tắc bảo toàn dữ liệu: Thông tin ban đầu + Các thay đổi (Đổi ngày, Đổi phòng, Gia hạn, Phụ thu) = Trạng thái hiện tại
                  </p>
                </div>
              </div>
              <div className="baseline-comparison-grid">
                <div className="baseline-col-box">
                  <small>1. DỮ LIỆU BAN ĐẦU (ORIGINAL)</small>
                  <b>{day(initialCheckIn)} ➔ {day(initialCheckOut)}</b>
                  <span>Số đêm: <strong>{initialNights} đêm</strong></span>
                  <span>Phòng: <strong>{initialRoomName}</strong></span>
                  <span>Tiền phòng gốc: <strong>{money(initialRoomAmount)}</strong></span>
                  <span>Tổng booking ban đầu: <strong style={{ color: '#0284c7' }}>{money(initialBookingTotal)}</strong></span>
                </div>
                <div className="baseline-col-box">
                  <small>2. TRẠNG THÁI HIỆN TẠI (CURRENT)</small>
                  <b>{day(item.checkInDate)} ➔ {day(item.checkOutDate)}</b>
                  <span>Số đêm: <strong>{item.nights} đêm</strong></span>
                  <span>Phòng: <strong>{item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName}</strong></span>
                  <span>Tiền phòng hiện tại: <strong>{money(item.roomAmount || item.subtotal)}</strong></span>
                  <span>Tổng hóa đơn hiện tại: <strong style={{ color: '#09275f' }}>{money(liveTotalAmount)}</strong></span>
                </div>
                <div className="baseline-col-box">
                  <small>3. BIẾN ĐỘNG / ĐIỀU CHỈNH</small>
                  <b>{item.nights !== initialNights ? (item.nights > initialNights ? `+${item.nights - initialNights} đêm` : `${item.nights - initialNights} đêm`) : 'Thời gian không đổi'}</b>
                  <span>Đổi phòng: <strong>{item.roomChangeLogs?.length ? `${item.roomChangeLogs.length} lần đổi phòng` : 'Không đổi'}</strong></span>
                  <span>Phát sinh: <strong>+{money(inStayChargesTotal + effectiveEarlyFee + effectiveLateFee)}</strong></span>
                  <span>Biến động tổng tiền: <strong style={{ color: priceFluctuationDiff > 0 ? '#b91c1c' : priceFluctuationDiff < 0 ? '#15803d' : '#64748b' }}>
                    {priceFluctuationDiff > 0 ? `+${money(priceFluctuationDiff)}` : priceFluctuationDiff < 0 ? `-${money(Math.abs(priceFluctuationDiff))}` : '0đ'}
                  </strong></span>
                  <span>Công nợ: <strong style={{ color: liveRemainingDue > 0 ? '#b91c1c' : '#15803d' }}>
                    {liveRemainingDue > 0 ? `Còn thiếu ${money(liveRemainingDue)}` : liveRemainingDue < 0 ? `Cần hoàn ${money(Math.abs(liveRemainingDue))}` : 'Đã thanh toán đủ'}
                  </strong></span>
                </div>
              </div>
            </div>

            {/* SECTION 6: LỊCH SỬ CÁC NGHIỆP VỤ THAY ĐỔI BOOKING */}
            <div className="mutation-history-container" style={{ margin: '18px 0', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#09275f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HostIcon name="clock" size={16} />
                  <span>Lịch sử các nghiệp vụ thay đổi booking</span>
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Ghi nhận tất cả thay đổi Đổi ngày, Đổi phòng, Gia hạn, Phụ thu, Hủy đơn
                </span>
              </div>

              <div className="mutation-timeline">
                {/* Event 1: Khởi tạo đơn đặt phòng */}
                <div className="mutation-event-card initial">
                  <div className="mutation-event-time">
                    {dateTime(item.createdAt)}
                  </div>
                  <div className="mutation-event-body">
                    <div className="mutation-event-title">
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1e40af', fontSize: '11px', fontWeight: 700 }}>KHỞI TẠO ĐƠN</span>
                      <span>Đặt phòng ban đầu</span>
                    </div>
                    <div className="mutation-event-details">
                      Khách hàng <b>{item.customerName}</b> đặt <b>{initialRoomName}</b> từ <b>{day(initialCheckIn)}</b> đến <b>{day(initialCheckOut)}</b> ({initialNights} đêm).
                    </div>
                    <div className="mutation-event-meta">
                      Giá phòng ban đầu: <b>{money(initialRoomAmount)}</b> · Tổng thanh toán ban đầu: <b>{money(initialBookingTotal)}</b>
                    </div>
                  </div>
                </div>

                {/* Event 2: Các lần Đổi ngày lưu trú */}
                {(item.dateChanges || []).map(dc => (
                  <div key={dc.id} className="mutation-event-card date-change">
                    <div className="mutation-event-time">
                      {dateTime(dc.createdAt)}
                    </div>
                    <div className="mutation-event-body">
                      <div className="mutation-event-title">
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: 700 }}>ĐỔI NGÀY LƯU TRÚ</span>
                        <span>Thay đổi lịch lưu trú</span>
                      </div>
                      <div className="mutation-event-details">
                        Kỳ cũ: <b>{day(dc.oldCheckInDate)} ➔ {day(dc.oldCheckOutDate)}</b> → Kỳ mới: <b style={{ color: '#0284c7' }}>{day(dc.newCheckInDate)} ➔ {day(dc.newCheckOutDate)}</b>
                      </div>
                      <div className="mutation-event-meta">
                        Phí đổi ngày: <b>{dc.dateChangeFee > 0 ? money(dc.dateChangeFee) : 'Miễn phí'}</b> · Chênh lệch giá phòng: <b>{dc.priceDifference > 0 ? `+${money(dc.priceDifference)}` : dc.priceDifference < 0 ? `-${money(Math.abs(dc.priceDifference))}` : '0đ'}</b> · Tổng điều chỉnh: <b style={{ color: '#0284c7' }}>{money(dc.totalAmountDifference)}</b>
                        {dc.reason && <span> · Lý do: <em>{dc.reason}</em></span>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Event 3: Các lần Đổi phòng */}
                {(item.roomChangeLogs || []).map(rcl => (
                  <div key={rcl.id} className="mutation-event-card room-change">
                    <div className="mutation-event-time">
                      {dateTime(rcl.createdAt)}
                    </div>
                    <div className="mutation-event-body">
                      <div className="mutation-event-title">
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#ede9fe', color: '#6d28d9', fontSize: '11px', fontWeight: 700 }}>ĐỔI PHÒNG / NÂNG HẠNG</span>
                        <span>Chuyển sang phòng khác</span>
                      </div>
                      <div className="mutation-event-details">
                        Phòng cũ: <b>{rcl.oldRoomNumber ? `Phòng ${rcl.oldRoomNumber}` : `#${rcl.oldRoomId}`}</b> → Phòng mới: <b style={{ color: '#7c3aed' }}>{rcl.newRoomNumber ? `Phòng ${rcl.newRoomNumber}` : `#${rcl.newRoomId}`}</b> (Còn {rcl.remainingNights} đêm)
                      </div>
                      <div className="mutation-event-meta">
                        Chênh lệch: <b>{rcl.priceDifference > 0 ? `+${money(rcl.priceDifference)} (Phụ thu)` : rcl.priceDifference < 0 ? `-${money(Math.abs(rcl.priceDifference))} (Giảm trừ)` : 'Miễn phí / Bằng giá (0đ)'}</b> · Thực hiện bởi: <b>{rcl.initiatedBy || 'Host'}</b>
                        {rcl.reason && <span> · Lý do: <em>{rcl.reason}</em></span>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Event 4: Các lần Gia hạn lưu trú */}
                {(item.extensions || []).map(ext => (
                  <div key={ext.id} className="mutation-event-card extend">
                    <div className="mutation-event-time">
                      {dateTime(ext.createdAt)}
                    </div>
                    <div className="mutation-event-body">
                      <div className="mutation-event-title">
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#d1fae5', color: '#047857', fontSize: '11px', fontWeight: 700 }}>GIA HẠN LƯU TRÚ</span>
                        <span>Gia hạn thêm số đêm</span>
                      </div>
                      <div className="mutation-event-details">
                        Ngày trả phòng cũ: <b>{day(ext.oldCheckOutDate)}</b> → Ngày trả phòng mới: <b style={{ color: '#059669' }}>{day(ext.newCheckOutDate)}</b> (+{ext.extendedNights} đêm)
                      </div>
                      <div className="mutation-event-meta">
                        Chi phí gia hạn: <b style={{ color: '#059669' }}>+{money(ext.totalCost)}</b>
                        {ext.reason && <span> · Lý do: <em>{ext.reason}</em></span>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Event 5: Hủy đơn nếu có */}
                {(item.cancellation || item.status === 'Cancelled') && (
                  <div className="mutation-event-card cancel">
                    <div className="mutation-event-time">
                      {dateTime(item.cancellation?.cancelledAt || item.updatedAt)}
                    </div>
                    <div className="mutation-event-body">
                      <div className="mutation-event-title">
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700 }}>HỦY ĐƠN ĐẶT PHÒNG</span>
                        <span>Đơn đã bị hủy</span>
                      </div>
                      <div className="mutation-event-details">
                        Đơn đặt phòng đã được hủy. Phòng đã giải phóng về trạng thái <b>Trống (Available)</b>.
                      </div>
                      <div className="mutation-event-meta">
                        Số tiền hoàn trả khách: <b style={{ color: '#15803d' }}>{money(item.cancellation?.refundAmount || 0)}</b> · Phí hủy phòng: <b style={{ color: '#b91c1c' }}>{money(item.cancellation?.cancellationFee || 0)}</b>
                        {item.cancellation?.reason && <span> · Lý do: <em>{item.cancellation.reason}</em></span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="booking-detail-grid">
              {/* SECTION 2: THÔNG TIN KHÁCH HÀNG & ĐỐI CHIẾU */}
              <article>
                <h3>Người liên hệ & Đối chiếu {item.contactIsNew && <span className="contact-updated-chip">Mới cập nhật</span>}</h3>
                <dl>
                  <dt>Họ tên khách</dt>
                  <dd><strong>{item.customerName}</strong></dd>
                  <dt>Số điện thoại</dt>
                  <dd>
                    {item.customerPhone || 'Chưa cập nhật'}
                    {item.customerPhone && (
                      <span className="phone-actions">
                        <button onClick={copy}>Sao chép</button>
                        <a href={`tel:${item.customerPhone}`}>Gọi ngay</a>
                      </span>
                    )}
                  </dd>
                  <dt>Email</dt>
                  <dd><a href={`mailto:${item.customerEmail}`}>{item.customerEmail}</a></dd>
                  <dt>Khách nhận phòng</dt>
                  <dd><strong>{item.guestName || item.customerName}</strong></dd>
                  <dt>CCCD / Hộ chiếu</dt>
                  <dd>
                    {item.checkInOut?.guestIdentityNumber ? (
                      <div>
                        <span className="cccd-badge">Đã đối chiếu: {item.checkInOut.guestIdentityNumber}</span>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          Thời gian: {dateTime(item.checkInOut.actualCheckInAt)} · Người đối chiếu: <strong>{item.checkInOut.checkedInByName || 'Host / Quản lý'}</strong>
                        </div>
                      </div>
                    ) : (
                      <span className="cccd-empty">Chưa đối chiếu (Thực hiện tại Tab Thao tác)</span>
                    )}
                  </dd>
                  <dt>Quốc gia cư trú</dt>
                  <dd>{item.customerCountry || 'Việt Nam'}</dd>
                  <dt>Cọc đảm bảo tài sản</dt>
                  <dd>
                    {recordedPropertyDeposit > 0 ? (
                      <strong style={{ color: '#b45309' }}>{money(recordedPropertyDeposit)} (Đã giữ riêng biệt)</strong>
                    ) : (
                      <span className="cccd-empty">Chưa thu cọc tài sản</span>
                    )}
                  </dd>
                  <dt>Ghi chú của khách</dt>
                  <dd className="preline">{item.customerNote || 'Không có yêu cầu đặc biệt'}</dd>
                </dl>
              </article>

              {/* SECTION 3: KỲ LƯU TRÚ & PHÒNG ĐÃ ĐẶT */}
              <article>
                <h3>Kỳ lưu trú & Phòng đã đặt</h3>
                <dl>
                  <dt>Homestay</dt>
                  <dd><strong>{item.homestayName}</strong></dd>
                  <dt>Phòng bố trí</dt>
                  <dd>
                    <strong>
                      {item.details?.map(d => `${d.roomTypeName}${d.roomNumber ? ` · Phòng ${d.roomNumber}` : ''}`).join(', ') || 'Chưa xếp phòng'}
                    </strong>
                  </dd>
                  <dt>Thời gian lưu trú</dt>
                  <dd><strong>{date(item.checkInDate)} → {date(item.checkOutDate)}</strong></dd>
                  <dt>Thời lượng</dt>
                  <dd>{item.nights} đêm</dd>
                  <dt>Khách lúc đặt</dt>
                  <dd>{item.adultCount} người lớn · {item.childCount} trẻ em</dd>
                  <dt>Khách thực tế</dt>
                  <dd>
                    <strong>{actualAdultsCount} người lớn · {actualChildrenCount} trẻ em</strong>
                    {actualTotalGuests !== initialTotalGuests && (
                      <span style={{ color: '#d97706', marginLeft: '6px', fontSize: '12px' }}>
                        (Phát sinh: {initialTotalGuests} ➔ {actualTotalGuests} khách)
                      </span>
                    )}
                  </dd>
                  <dt>Check-in chuẩn / thực tế</dt>
                  <dd>Chuẩn: 14:00 · Thực tế: <strong>{item.checkInOut?.actualCheckInAt ? extractTime(item.checkInOut.actualCheckInAt, checkInTime) : `${checkInTime} (dự kiến)`}</strong></dd>
                  <dt>Check-out chuẩn / thực tế</dt>
                  <dd>Chuẩn: 12:00 · Thực tế: <strong>{item.checkInOut?.actualCheckOutAt ? extractTime(item.checkInOut.actualCheckOutAt, checkOutTime) : `${checkOutTime} (dự kiến)`}</strong></dd>
                  <dt>Sức chứa tiêu chuẩn</dt>
                  <dd>Tiêu chuẩn: {capacity.baseCapacity} khách · Tối đa: {capacity.maxCapacity} khách</dd>
                </dl>
              </article>
            </div>
          </div>
        )}

        {/* TAB 2: GIAI ĐOẠN CHECK-IN (SECTION 1 & MODULE I, IV, IX) */}
        {activeTab === 'checkin' && (
          <div className="tab-content-pane lifecycle-stage-pane">
            <div className="stage-intro-card">
              <div className="stage-intro-icon"><HostIcon name="key" size={24} /></div>
              <div>
                <h4>Giai đoạn 1: Check-in & Đối chiếu thông tin khách lưu trú</h4>
                <p>Đối chiếu CCCD/Hộ chiếu, xác nhận số khách thực tế và giờ nhận phòng. Giữ riêng tiền cọc đảm bảo tài sản (Property Deposit) tách bạch khỏi tiền phòng.</p>
              </div>
            </div>

            {item.status === 'CheckedIn' ? (
              <div className="stage-status-card success">
                <div className="status-indicator-badge">
                  <HostIcon name="check" size={18} />
                  <strong>Khách đang lưu trú tại Homestay</strong>
                </div>
                <div className="checkin-summary-grid">
                  <div>
                    <small>Số CCCD / Hộ chiếu đã đối chiếu</small>
                    <b>{item.checkInOut?.guestIdentityNumber || 'Chưa nhập'}</b>
                  </div>
                  <div>
                    <small>Số điện thoại khách</small>
                    <b>{item.customerPhone || 'Chưa cập nhật'}</b>
                  </div>
                  <div>
                    <small>Thời gian nhận phòng thực tế</small>
                    <b>{dateTime(item.checkInOut?.actualCheckInAt || item.updatedAt)}</b>
                  </div>
                  <div>
                    <small>Cọc tài sản đang giữ</small>
                    <b style={{ color: '#b45309' }}>{money(recordedPropertyDeposit)}</b>
                  </div>
                </div>
                {item.checkInOut?.note && (
                  <p className="checkin-recorded-note">Ghi chú đối chiếu: <em>{item.checkInOut.note}</em></p>
                )}
                <div className="stage-actions-row">
                  <button type="button" className="btn-lifecycle-next" onClick={() => setActiveTab('stay')}>
                    <span>Chuyển sang Quản lý Lưu trú & Dịch vụ (Giai đoạn 2)</span>
                    <HostIcon name="chevronRight" size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="stage-form-card">
                {/* 1. Đối chiếu CCCD & SĐT */}
                <div className="form-sub-header">
                  <h5>1. Đối chiếu thông tin cá nhân khách</h5>
                  <span>Bắt buộc kiểm tra căn cước công dân hoặc hộ chiếu trước khi bàn giao phòng</span>
                </div>

                <div className="form-grid-2">
                  <div className="field-group">
                    <label>Số CCCD / Hộ chiếu khách <span className="req">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: 079090123456 hoặc B1234567"
                      value={guestIdentityNumber}
                      onChange={e => setGuestIdentityNumber(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label>Số điện thoại đối chiếu</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="VD: 0901234567"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* 2. Giờ nhận phòng & Early Check-in */}
                <div className="form-sub-header" style={{ marginTop: '20px' }}>
                  <h5>2. Giờ nhận phòng thực tế & Phụ thu nhận sớm</h5>
                  <span>Chính sách: Chuẩn từ 14:00 (0đ) · 10-14h: Miễn phí nếu sẵn sàng · 6-10h: +50% · Trước 6h: +100%</span>
                </div>

                <div className="timing-col" style={{ marginTop: '8px' }}>
                  <div className="timing-input-row">
                    <input
                      type="time"
                      className="timing-time-input"
                      value={checkInTime}
                      onChange={e => {
                        setCheckInTime(e.target.value);
                        setIsEarlyCustom(false);
                      }}
                    />
                    <span className={`timing-badge-tag ${earlyPolicy.badge}`}>
                      {earlyPolicy.percent > 0 ? `+${earlyPolicy.percent}%` : earlyPolicy.badge === 'free' ? 'Miễn phí' : 'Đúng giờ'}
                    </span>
                    <strong className="timing-fee-display">
                      Phụ thu: +{money(effectiveEarlyFee)}
                    </strong>
                  </div>

                  <div className="timing-presets">
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkInTime === '14:00' ? 'active' : ''}`}
                      onClick={() => { setCheckInTime('14:00'); setIsEarlyCustom(false); }}
                    >
                      14:00 (Chuẩn)
                    </button>
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkInTime === '11:00' ? 'active' : ''}`}
                      onClick={() => { setCheckInTime('11:00'); setIsEarlyCustom(false); }}
                    >
                      11:00 (Miễn phí)
                    </button>
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkInTime === '08:00' ? 'active' : ''}`}
                      onClick={() => { setCheckInTime('08:00'); setIsEarlyCustom(false); }}
                    >
                      08:00 (+50%)
                    </button>
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkInTime === '05:00' ? 'active' : ''}`}
                      onClick={() => { setCheckInTime('05:00'); setIsEarlyCustom(false); }}
                    >
                      05:00 (+100%)
                    </button>
                  </div>
                  <small className="timing-tier-desc">{earlyPolicy.label}</small>

                  <label className="timing-override-toggle">
                    <input
                      type="checkbox"
                      checked={isEarlyCustom}
                      onChange={e => {
                        setIsEarlyCustom(e.target.checked);
                        if (e.target.checked && customEarlyFee === '') {
                          setCustomEarlyFee(String(earlyPolicy.fee));
                        }
                      }}
                    />
                    <span>Tự điều chỉnh mức phụ thu nhận sớm (để miễn phí hoặc tăng/giảm)</span>
                  </label>
                  {isEarlyCustom && (
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      className="timing-override-input"
                      value={customEarlyFee}
                      onChange={e => setCustomEarlyFee(e.target.value)}
                      placeholder="Nhập số tiền phụ thu nhận sớm (0 = miễn phí)"
                    />
                  )}
                </div>

                {/* 3. Kiểm đếm khách thực tế & Sức chứa */}
                <div className="form-sub-header" style={{ marginTop: '20px' }}>
                  <h5>3. Số lượng khách thực tế & Đối chiếu sức chứa phòng</h5>
                  <span>Sức chứa phòng: Tiêu chuẩn {capacity.baseCapacity} khách · Tối đa {capacity.maxCapacity} khách</span>
                </div>

                <div className={`guest-capacity-banner ${guestSurchargeInfo.totalActualGuests > capacity.maxCapacity ? 'warning' : ''}`}>
                  <div className="guest-capacity-info">
                    <span>Đơn đặt: <strong>{item.adultCount} người lớn, {item.childCount} trẻ em</strong></span>
                    <span>Thực tế đến: <strong>{guestSurchargeInfo.totalActualGuests} người</strong></span>
                    <span>Tối đa phòng: <strong>{capacity.maxCapacity} người</strong></span>
                  </div>
                  {guestSurchargeInfo.totalActualGuests > capacity.maxCapacity && (
                    <span className="balance-badge-due">⚠️ Vượt quá sức chứa tối đa của phòng!</span>
                  )}
                </div>

                <div className="guest-tier-grid">
                  <div className="guest-tier-card">
                    <header>
                      <strong>Người lớn (≥12 tuổi)</strong>
                      <small>Tiêu chuẩn theo đơn</small>
                    </header>
                    <div className="guest-counter-ctrl">
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, adults: Math.max(1, p.adults - 1) }))}
                      >-</button>
                      <span>{actualGuests.adults}</span>
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, adults: p.adults + 1 }))}
                      >+</button>
                    </div>
                  </div>

                  <div className="guest-tier-card">
                    <header>
                      <strong>Trẻ em &lt;2 tuổi</strong>
                      <small>Miễn phí lưu trú</small>
                    </header>
                    <div className="guest-counter-ctrl">
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, childUnder2: Math.max(0, p.childUnder2 - 1) }))}
                      >-</button>
                      <span>{actualGuests.childUnder2}</span>
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, childUnder2: p.childUnder2 + 1 }))}
                      >+</button>
                    </div>
                  </div>

                  <div className="guest-tier-card">
                    <header>
                      <strong>Trẻ 2 - &lt;6 tuổi</strong>
                      <small>{policy.guests?.child2To6SurchargePercent > 0 ? `+${policy.guests.child2To6SurchargePercent}%` : 'Miễn phí'}</small>
                    </header>
                    <div className="guest-counter-ctrl">
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, child2To6: Math.max(0, p.child2To6 - 1) }))}
                      >-</button>
                      <span>{actualGuests.child2To6}</span>
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, child2To6: p.child2To6 + 1 }))}
                      >+</button>
                    </div>
                  </div>

                  <div className="guest-tier-card">
                    <header>
                      <strong>Trẻ 6 - &lt;10 tuổi</strong>
                      <small>+50% phụ thu</small>
                    </header>
                    <div className="guest-counter-ctrl">
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, child6To10: Math.max(0, p.child6To10 - 1) }))}
                      >-</button>
                      <span>{actualGuests.child6To10}</span>
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, child6To10: p.child6To10 + 1 }))}
                      >+</button>
                    </div>
                  </div>

                  <div className="guest-tier-card">
                    <header>
                      <strong>Trẻ 10 - &lt;12 tuổi</strong>
                      <small>+70% phụ thu</small>
                    </header>
                    <div className="guest-counter-ctrl">
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, child10To12: Math.max(0, p.child10To12 - 1) }))}
                      >-</button>
                      <span>{actualGuests.child10To12}</span>
                      <button
                        type="button"
                        onClick={() => setActualGuests(p => ({ ...p, child10To12: p.child10To12 + 1 }))}
                      >+</button>
                    </div>
                  </div>
                </div>

                {guestSurchargeInfo.totalSurcharge > 0 && (
                  <div className="diff-highlight-line" style={{ background: '#fef3c7', padding: '10px 14px', borderRadius: '8px', marginTop: '12px' }}>
                    <span>Phụ thu phát sinh thêm khách ({guestSurchargeInfo.extraAdults} lớn, {guestSurchargeInfo.extraChildrenCount} nhỏ - {item.nights} đêm):</span>
                    <strong className="text-danger">+{money(guestSurchargeInfo.totalSurcharge)} (Tự động cộng vào Bill)</strong>
                  </div>
                )}

                {/* 4. Thú cưng đi kèm */}
                {policy.pets?.allowed !== false && (
                  <div style={{ marginTop: '16px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                      <input
                        type="checkbox"
                        checked={hasPetAtCheckin}
                        onChange={e => setHasPetAtCheckin(e.target.checked)}
                      />
                      <span>Khách có mang theo thú cưng ({money(policy.pets?.feePerNight || 150000)} / bé / đêm)</span>
                    </label>
                    {hasPetAtCheckin && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>Số lượng thú cưng:</span>
                        <input
                          type="number"
                          min="1"
                          max={policy.pets?.maximumPerRoom || 2}
                          value={petCountAtCheckin}
                          onChange={e => setPetCountAtCheckin(Math.max(1, Number(e.target.value) || 1))}
                          style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                        <strong className="text-primary">
                          Phụ thu: +{money(petCountAtCheckin * (policy.pets?.feePerNight || 150000) * (item.nights || 1))}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Cọc đảm bảo tài sản */}
                <div className="form-sub-header" style={{ marginTop: '20px' }}>
                  <h5>4. Tiền cọc đảm bảo tài sản (Property Deposit - Giữ riêng biệt)</h5>
                  <span>Gợi ý chính sách: {money(policy.assets?.minimumDeposit || 500000)} đến {money(policy.assets?.maximumDeposit || 2000000)}. Hoàn trả 100% khi trả phòng nếu không hư hại.</span>
                </div>

                <div className="field-group" style={{ marginTop: '8px' }}>
                  <label>Số tiền cọc tài sản thu khi nhận phòng (VNĐ):</label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    className="form-input"
                    value={propertyDeposit}
                    onChange={e => setPropertyDeposit(e.target.value)}
                    placeholder="VD: 500000"
                  />
                </div>

                <div className="field-group" style={{ marginTop: '16px' }}>
                  <label>Ghi chú kiểm tra và bàn giao phòng:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Đã đối chiếu CCCD gốc, đã nhận đủ chìa khóa, khách đã gửi cọc tài sản..."
                    value={checkInNote}
                    onChange={e => setCheckInNote(e.target.value)}
                  />
                </div>

                {checkInMessage && (
                  <div className="timing-message-alert" style={{ marginTop: '14px' }}>
                    <HostIcon name="check" size={16} />
                    <span>{checkInMessage}</span>
                  </div>
                )}

                <div className="stage-actions-row">
                  <button
                    type="button"
                    className="btn-lifecycle-action checkin"
                    onClick={handleCheckIn}
                    disabled={checkInSaving}
                  >
                    <HostIcon name="key" size={16} />
                    <span>{checkInSaving ? 'Đang xử lý nhận phòng...' : 'Xác nhận đối chiếu & Cho nhận phòng (Check-in)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GIAI ĐOẠN ĐANG Ở & QUẢN LÝ LƯU TRÚ (IN-STAY) */}
        {activeTab === 'stay' && (
          <div className="tab-content-pane lifecycle-stage-pane">
            <div className="stage-intro-card">
              <div className="stage-intro-icon"><HostIcon name="tag" size={24} /></div>
              <div>
                <h4>Giai đoạn 2: Quản lý Lưu trú, Tiện ích & Thay đổi phòng</h4>
                <p>Theo dõi tình trạng lưu trú, xử lý thêm dịch vụ, đổi phòng hoặc gia hạn thời gian lưu trú với hệ thống tự động cập nhật hóa đơn thời gian thực.</p>
              </div>
            </div>

            {/* THÔNG TIN LƯU TRÚ HIỆN TẠI */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <small style={{ color: '#64748b' }}>Phòng đang ở</small>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#09275f' }}>
                    {item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName} ({item.details?.[0]?.roomTypeName || 'Tiêu chuẩn'})
                  </div>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>Kỳ lưu trú hiện tại</small>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>
                    {day(item.checkInDate)} ➔ {day(item.checkOutDate)} ({item.nights} đêm)
                  </div>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>Số khách thực tế</small>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{actualTotalGuests} khách</div>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>Giá phòng / đêm</small>
                  <div style={{ fontWeight: 700, color: '#0284c7' }}>{money(pricePerNight)}</div>
                </div>
                <div>
                  <small style={{ color: '#64748b' }}>Trạng thái</small>
                  <div><span className={`status status-${item.status.toLowerCase()}`}>{labels[item.status] || item.status}</span></div>
                </div>
              </div>
            </div>

            {/* 3 NÚT THAO TÁC NGHIỆP VỤ RIÊNG BIỆT */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <button
                type="button"
                className="btn-op-action incidental"
                style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  setIncidentalCategory('service');
                  setShowIncidentalModal(true);
                }}
              >
                <HostIcon name="plus" size={16} />
                <span>+ Thêm khoản phát sinh</span>
              </button>

              {['Confirmed', 'CheckedIn'].includes(item.status) && (
                <button
                  type="button"
                  className="btn-op-action room-change"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => {
                    loadAvailableRooms();
                    setShowRoomChangeModal(true);
                  }}
                >
                  <HostIcon name="key" size={16} />
                  <span>Đổi phòng lưu trú</span>
                </button>
              )}

              {['Confirmed', 'CheckedIn'].includes(item.status) && (
                <button
                  type="button"
                  className="btn-op-action extend-stay"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => {
                    const nextDay = new Date(item.checkOutDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    const nextStr = nextDay.toISOString().slice(0, 10);
                    setExtendNewDate(nextStr);
                    setExtendReason('');
                    setExtendMessage('');
                    fetchExtendQuote(nextStr);
                    setShowExtendModal(true);
                  }}
                >
                  <HostIcon name="clock" size={16} />
                  <span>Gia hạn lưu trú</span>
                </button>
              )}
            </div>

            {/* DANH SÁCH DỊCH VỤ PHÁT SINH TRONG KỲ LƯU TRÚ */}
            <div className="stage-form-card">
              <div className="card-section-title">
                <h5>Danh sách khoản phát sinh trong kỳ lưu trú</h5>
                <button
                  type="button"
                  className="btn-open-incidentals"
                  style={{ height: '30px', fontSize: '12px' }}
                  onClick={() => {
                    setIncidentalCategory('service');
                    setShowIncidentalModal(true);
                  }}
                >
                  <HostIcon name="plus" size={13} />
                  <span>+ Thêm phát sinh</span>
                </button>
              </div>

              <div className="services-table-wrap">
                <table className="lifecycle-table">
                  <thead>
                    <tr>
                      <th>Khoản mục / Dịch vụ</th>
                      <th>Phân loại</th>
                      <th>Số lượng</th>
                      <th>Đơn giá</th>
                      <th>Thành tiền</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inStayChargesList.map(charge => (
                      <tr key={charge.id}>
                        <td><strong>{charge.description}</strong></td>
                        <td><span className="charge-type-pill">{charge.type}</span></td>
                        <td>{charge.quantity}</td>
                        <td>{money(charge.unitPrice)}</td>
                        <td><strong className="text-primary">+{money(charge.totalPrice)}</strong></td>
                        <td>
                          <button
                            type="button"
                            className="btn-table-del"
                            title="Xóa khỏi hóa đơn"
                            onClick={() => handleRemoveCharge(charge.id)}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!inStayChargesList.length && (
                      <tr>
                        <td colSpan="6" className="text-empty">Chưa có dịch vụ phát sinh nào trong thời gian lưu trú.</td>
                      </tr>
                    )}
                  </tbody>
                  {inStayChargesList.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan="4"><b>Tổng phát sinh trong kỳ nghỉ:</b></td>
                        <td colSpan="2"><b className="text-primary">+{money(inStayChargesTotal)}</b></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {chargeMessage && (
                <div className="timing-message-alert" style={{ marginTop: '10px' }}>
                  <HostIcon name="check" size={15} />
                  <span>{chargeMessage}</span>
                </div>
              )}

              <div className="stage-actions-row" style={{ marginTop: '20px' }}>
                <button type="button" className="btn-lifecycle-next" onClick={() => setActiveTab('checkout')}>
                  <span>Chuyển sang Trả phòng & Quyết toán (Giai đoạn 3)</span>
                  <HostIcon name="chevronRight" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GIAI ĐOẠN CHECK-OUT & QUYẾT TOÁN (MODULE VIII, IX) */}
        {activeTab === 'checkout' && (
          <div className="tab-content-pane lifecycle-stage-pane">
            <div className="stage-intro-card">
              <div className="stage-intro-icon"><HostIcon name="calendar" size={24} /></div>
              <div>
                <h4>Giai đoạn 3: Trả phòng & Quyết toán Hóa đơn cuối cùng</h4>
                <p>Kiểm tra phòng, tính bồi thường hư hại (nếu có), quyết toán riêng biệt Tiền phòng và Tiền cọc tài sản, sau đó giải phóng phòng sang trạng thái Dọn phòng.</p>
              </div>
            </div>

            {['CheckedOut', 'Completed'].includes(item.status) ? (
              <div className="stage-status-card success">
                <div className="status-indicator-badge">
                  <HostIcon name="check" size={18} />
                  <strong>Đơn đặt phòng này đã hoàn tất trả phòng (Check-out)</strong>
                </div>
                <p>Phòng đã được giải phóng và chuyển sang trạng thái <b>Dọn phòng (Cleaning)</b>.</p>
                <div className="stage-actions-row">
                  <button type="button" className="btn-print" onClick={print}>
                    <HostIcon name="printer" size={15} />
                    <span>In hóa đơn quyết toán hoàn tất</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="stage-form-card">
                {/* 1. Giờ trả phòng thực tế & Phụ thu muộn */}
                <div className="form-sub-header">
                  <h5>1. Giờ trả phòng thực tế & Phụ thu muộn (Late Check-out)</h5>
                  <span>Chính sách: Chuẩn trước 12:00 (0đ) · 12-15h: +30% · 15-18h: +50% · Sau 18h: +100%</span>
                </div>

                <div className="timing-col" style={{ marginTop: '8px' }}>
                  <div className="timing-input-row">
                    <input
                      type="time"
                      className="timing-time-input"
                      value={checkOutTime}
                      onChange={e => {
                        setCheckOutTime(e.target.value);
                        setIsLateCustom(false);
                      }}
                    />
                    <span className={`timing-badge-tag ${latePolicy.badge}`}>
                      {latePolicy.percent > 0 ? `+${latePolicy.percent}%` : 'Đúng giờ'}
                    </span>
                    <strong className="timing-fee-display">
                      Phụ thu trả muộn: +{money(effectiveLateFee)}
                    </strong>
                  </div>

                  <div className="timing-presets">
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkOutTime === '12:00' ? 'active' : ''}`}
                      onClick={() => { setCheckOutTime('12:00'); setIsLateCustom(false); }}
                    >
                      12:00 (Chuẩn)
                    </button>
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkOutTime === '14:00' ? 'active' : ''}`}
                      onClick={() => { setCheckOutTime('14:00'); setIsLateCustom(false); }}
                    >
                      14:00 (+30%)
                    </button>
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkOutTime === '16:30' ? 'active' : ''}`}
                      onClick={() => { setCheckOutTime('16:30'); setIsLateCustom(false); }}
                    >
                      16:30 (+50%)
                    </button>
                    <button
                      type="button"
                      className={`timing-preset-btn ${checkOutTime === '19:00' ? 'active' : ''}`}
                      onClick={() => { setCheckOutTime('19:00'); setIsLateCustom(false); }}
                    >
                      19:00 (+100%)
                    </button>
                  </div>
                  <small className="timing-tier-desc">{latePolicy.label}</small>

                  <label className="timing-override-toggle">
                    <input
                      type="checkbox"
                      checked={isLateCustom}
                      onChange={e => {
                        setIsLateCustom(e.target.checked);
                        if (e.target.checked && customLateFee === '') {
                          setCustomLateFee(String(latePolicy.fee));
                        }
                      }}
                    />
                    <span>Tự chỉnh mức phụ thu trả muộn (0 = Miễn phí trả muộn cho khách)</span>
                  </label>
                  {isLateCustom && (
                    <input
                      type="number"
                      min="0"
                      step="10000"
                      className="timing-override-input"
                      value={customLateFee}
                      onChange={e => setCustomLateFee(e.target.value)}
                      placeholder="Nhập số tiền phụ thu trả muộn mong muốn"
                    />
                  )}
                </div>

                {/* 2. Kiểm tra tài sản phòng */}
                <div className="form-sub-header" style={{ marginTop: '22px' }}>
                  <h5>2. Kiểm tra bàn giao phòng & Bồi thường tài sản</h5>
                  <span>Kiểm tra đồ đạc, thiết bị, chìa khóa và khăn phòng theo bảng giá quy định</span>
                </div>

                <div className="inspection-card">
                  <div className="inspection-radios">
                    <label className={`inspection-radio-label ${inspectionStatus === 'intact' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="inspectionStatus"
                        value="intact"
                        checked={inspectionStatus === 'intact'}
                        onChange={() => setInspectionStatus('intact')}
                      />
                      <span>✓ Phòng nguyên vẹn, đầy đủ tài sản (Không hư hại)</span>
                    </label>
                    <label className={`inspection-radio-label ${inspectionStatus === 'damaged' ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="inspectionStatus"
                        value="damaged"
                        checked={inspectionStatus === 'damaged'}
                        onChange={() => setInspectionStatus('damaged')}
                      />
                      <span>⚠️ Phát hiện hư hỏng / mất mát tài sản</span>
                    </label>
                  </div>

                  {inspectionStatus === 'damaged' && (
                    <div style={{ marginTop: '16px' }}>
                      <small style={{ fontWeight: 'bold', color: '#09275f' }}>Bảng giá bồi thường quy định trong chính sách:</small>
                      <div className="preset-services-list" style={{ marginTop: '6px' }}>
                        {(policy.assets?.items || [
                          { name: 'Mất / hỏng Chìa khóa / Thẻ từ', unitPrice: 200000 },
                          { name: 'Mất / hỏng Điều khiển TV / Máy lạnh', unitPrice: 300000 },
                          { name: 'Ố bẩn / rách Khăn tắm', unitPrice: 150000 },
                          { name: 'Làm vỡ ly, cốc thủy tinh', unitPrice: 50000 }
                        ]).map((ai, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="preset-service-btn"
                            onClick={() => {
                              setDamageItemName(ai.name);
                              setDamageItemPrice(String(ai.unitPrice));
                              setDamageItemQty(1);
                            }}
                          >
                            <span>{ai.name}</span>
                            <b className="text-danger">{money(ai.unitPrice)}</b>
                          </button>
                        ))}
                      </div>

                      {/* Form nhập món hư hỏng */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ flex: 2, minWidth: '200px' }}
                          placeholder="Tên tài sản hư hỏng / mất mát..."
                          value={damageItemName}
                          onChange={e => setDamageItemName(e.target.value)}
                        />
                        <input
                          type="number"
                          min="1"
                          className="form-input"
                          style={{ width: '80px' }}
                          value={damageItemQty}
                          onChange={e => setDamageItemQty(Math.max(1, Number(e.target.value) || 1))}
                        />
                        <input
                          type="number"
                          step="10000"
                          className="form-input"
                          style={{ width: '130px' }}
                          placeholder="Số tiền bồi thường"
                          value={damageItemPrice}
                          onChange={e => setDamageItemPrice(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-add-charge"
                          onClick={() => {
                            if (!damageItemName || !damageItemPrice) return;
                            setDamageItemsList(prev => [
                              ...prev,
                              {
                                id: Date.now(),
                                name: damageItemName.trim(),
                                quantity: Number(damageItemQty) || 1,
                                unitPrice: Number(damageItemPrice)
                              }
                            ]);
                            setDamageItemName('');
                            setDamageItemPrice('');
                            setDamageItemQty(1);
                          }}
                        >
                          + Ghi nhận hư hại
                        </button>
                      </div>

                      {damageItemsList.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                          <table className="lifecycle-table">
                            <thead>
                              <tr>
                                <th>Tài sản hư hại</th>
                                <th>SL</th>
                                <th>Đơn giá</th>
                                <th>Tổng bồi thường</th>
                                <th>Thao tác</th>
                              </tr>
                            </thead>
                            <tbody>
                              {damageItemsList.map(di => (
                                <tr key={di.id}>
                                  <td>{di.name}</td>
                                  <td>{di.quantity}</td>
                                  <td>{money(di.unitPrice)}</td>
                                  <td><strong className="text-danger">+{money(di.quantity * di.unitPrice)}</strong></td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn-table-del"
                                      onClick={() => setDamageItemsList(prev => prev.filter(x => x.id !== di.id))}
                                    >
                                      Xóa
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. BẢNG QUYẾT TOÁN 2 KÊNH TÁCH BẠCH */}
                <div className="form-sub-header" style={{ marginTop: '22px' }}>
                  <h5>3. Bảng Quyết toán cuối cùng (Tách bạch Cọc phòng vs Cọc tài sản)</h5>
                  <span>Tiền cọc tài sản được quản lý riêng và không cộng gộp làm mờ số liệu tiền phòng</span>
                </div>

                <div className="deposit-split-container">
                  {/* KÊNH 1: TIỀN PHÒNG & DỊCH VỤ */}
                  <div className="deposit-channel-card room-channel">
                    <div>
                      <div className="deposit-channel-header">
                        <h6>KÊNH 1: TIỀN PHÒNG & DỊCH VỤ</h6>
                        <span className="live-badge">Lưu trú</span>
                      </div>
                      <div className="deposit-channel-row">
                        <span>Tiền phòng gốc:</span>
                        <b>{money(baseRoomAmount)}</b>
                      </div>
                      {effectiveEarlyFee > 0 && (
                        <div className="deposit-channel-row highlight">
                          <span>Phụ thu nhận sớm:</span>
                          <b>+{money(effectiveEarlyFee)}</b>
                        </div>
                      )}
                      {effectiveLateFee > 0 && (
                        <div className="deposit-channel-row highlight">
                          <span>Phụ thu trả muộn:</span>
                          <b>+{money(effectiveLateFee)}</b>
                        </div>
                      )}
                      {inStayChargesTotal > 0 && (
                        <div className="deposit-channel-row highlight">
                          <span>Tổng phát sinh trong kỳ nghỉ:</span>
                          <b>+{money(inStayChargesTotal)}</b>
                        </div>
                      )}
                      {item.discountAmount > 0 && (
                        <div className="deposit-channel-row">
                          <span>Giảm giá khuyến mãi:</span>
                          <b>-{money(item.discountAmount)}</b>
                        </div>
                      )}
                      <div className="deposit-channel-row" style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px' }}>
                        <span>Tổng tiền lưu trú:</span>
                        <strong>{money(liveTotalAmount)}</strong>
                      </div>
                      <div className="deposit-channel-row">
                        <span>Tiền khách đã thanh toán:</span>
                        <b>{money(item.paidAmount)}</b>
                      </div>
                    </div>

                    <div className="deposit-channel-total">
                      <strong>CÔNG NỢ TIỀN PHÒNG:</strong>
                      {liveRemainingDue > 0 ? (
                        <b className="text-danger">Thu thêm +{money(liveRemainingDue)}</b>
                      ) : liveRemainingDue < 0 ? (
                        <b className="text-success">Hoàn khách {money(Math.abs(liveRemainingDue))}</b>
                      ) : (
                        <b className="text-success">Đã đủ 100%</b>
                      )}
                    </div>
                  </div>

                  {/* KÊNH 2: TIỀN CỌC ĐẢM BẢO TÀI SẢN */}
                  <div className="deposit-channel-card property-channel">
                    <div>
                      <div className="deposit-channel-header">
                        <h6>KÊNH 2: CỌC TÀI SẢN (SEPARATE)</h6>
                        <span className="live-badge" style={{ background: '#fef3c7', color: '#b45309' }}>Tài sản</span>
                      </div>
                      <div className="deposit-channel-row">
                        <span>Tiền cọc tài sản đã thu:</span>
                        <b>{money(recordedPropertyDeposit)}</b>
                      </div>
                      <div className="deposit-channel-row highlight">
                        <span>Tổng thiệt hại bồi thường:</span>
                        <b className="text-danger">-{money(totalDamageCompensation)}</b>
                      </div>
                      <div className="deposit-channel-row" style={{ fontStyle: 'italic', fontSize: '11px', color: '#64748b' }}>
                        (Cọc tài sản - Thiệt hại tài sản = Hoàn trả khách)
                      </div>
                    </div>

                    <div className="deposit-channel-total">
                      <strong>QUYẾT TOÁN CỌC TÀI SẢN:</strong>
                      {netPropertyDepositRefund > 0 ? (
                        <b className="text-success">Hoàn lại cọc {money(netPropertyDepositRefund)}</b>
                      ) : excessDamageOwed > 0 ? (
                        <b className="text-danger">Khách nộp thêm +{money(excessDamageOwed)}</b>
                      ) : (
                        <b>Không hoàn (0đ)</b>
                      )}
                    </div>
                  </div>
                </div>

                {/* PHƯƠNG THỨC THANH TOÁN QUYẾT TOÁN */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
                  <label style={{ fontWeight: 'bold', color: '#09275f' }}>Phương thức thanh toán khoản chênh lệch:</label>
                  <div className="payment-method-radios" style={{ marginTop: '8px' }}>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="checkoutPayMethod"
                        value="Cash"
                        checked={checkoutPaymentMethod === 'Cash'}
                        onChange={() => setCheckoutPaymentMethod('Cash')}
                      />
                      <span>Tiền mặt (Cash)</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="checkoutPayMethod"
                        value="BankTransfer"
                        checked={checkoutPaymentMethod === 'BankTransfer'}
                        onChange={() => setCheckoutPaymentMethod('BankTransfer')}
                      />
                      <span>Chuyển khoản qua VNPay</span>
                    </label>
                  </div>
                </div>

                <div className="field-group" style={{ marginTop: '16px' }}>
                  <label>Ghi chú quyết toán trả phòng:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Khách đã bàn giao đầy đủ chìa khóa, đã hoàn cọc tài sản..."
                    value={checkoutNote}
                    onChange={e => setCheckoutNote(e.target.value)}
                  />
                </div>

                {checkoutMessage && (
                  <div className={checkoutMessage.includes('Lỗi') || checkoutMessage.includes('lỗi') ? 'bo-message error' : 'timing-message-alert'} style={{ marginTop: '12px' }} role="alert">
                    <HostIcon name={checkoutMessage.includes('Lỗi') || checkoutMessage.includes('lỗi') ? 'alert' : 'check'} size={15} />
                    <span>{checkoutMessage}</span>
                  </div>
                )}

                <div className="stage-actions-row">
                  <button
                    type="button"
                    className="btn-lifecycle-action checkout"
                    onClick={handleCheckOut}
                    disabled={checkoutSaving}
                  >
                    <HostIcon name="calendar" size={16} />
                    <span>
                      {checkoutSaving
                        ? 'Đang xử lý trả phòng...'
                        : liveRemainingDue > 0
                          ? `Xác nhận thu đủ ${money(liveRemainingDue)} & Hoàn tất Check-out`
                          : liveRemainingDue < 0
                            ? `Xác nhận hoàn ${money(Math.abs(liveRemainingDue))} & Hoàn tất Check-out`
                            : 'Xác nhận Quyết toán & Hoàn tất Check-out'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: HÓA ĐƠN & CÔNG NỢ (BREAKDOWN TỪNG ĐÊM VÀ 13 HẠNG MỤC) */}
        {activeTab === 'bill' && (
          <div className="tab-content-pane">
            {/* CHI TIẾT GIÁ PHÒNG THEO TỪNG ĐÊM */}
            <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>Chi tiết giá phòng theo từng đêm lưu trú</h3>
                <button
                  type="button"
                  className="btn-table-del"
                  style={{ background: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }}
                  onClick={() => setShowNightlyDetail(prev => !prev)}
                >
                  {showNightlyDetail ? 'Thu gọn bảng đêm' : 'Xem chi tiết giá từng đêm'}
                </button>
              </div>

              {showNightlyDetail && (
                <div style={{ overflowX: 'auto' }}>
                  <table className="nightly-table">
                    <thead>
                      <tr>
                        <th>Đêm lưu trú</th>
                        <th>Giá phòng gốc</th>
                        <th>Phụ thu theo ngày (Lễ / Cuối tuần)</th>
                        <th style={{ textAlign: 'right' }}>Thành tiền đêm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nightsBreakdown.map((nb, idx) => (
                        <tr key={idx}>
                          <td><b>Đêm {idx + 1}:</b> {plainDate(nb.date || item.checkInDate)}</td>
                          <td>{money(nb.basePrice)}</td>
                          <td>
                            {nb.surchargePercent > 0 ? (
                              <span className="nightly-surcharge-tag">
                                {nb.surchargeReason || `+${nb.surchargePercent}%`}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Tiêu chuẩn</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{money(nb.finalPrice || nb.basePrice)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#eff6ff', fontWeight: 'bold' }}>
                        <td colSpan="3">TỔNG TIỀN PHÒNG GỐC ({nightsBreakdown.length || item.nights} ĐÊM):</td>
                        <td style={{ textAlign: 'right', color: '#1d4ed8' }}>{money(initialRoomAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            {/* HÓA ĐƠN CHI TIẾT 13 DÒNG BREAKDOWN */}
            <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Hóa đơn lưu trú chi tiết (Breakdown 13 hạng mục)</h3>
                <button type="button" className="btn-print" onClick={print}>
                  <HostIcon name="printer" size={14} />
                  <span>In hóa đơn quyết toán</span>
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="bill-breakdown-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>STT</th>
                      <th>Khoản mục cấu thành hóa đơn</th>
                      <th>Phân loại</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="bill-item-num">1</td>
                      <td><b>Tiền phòng gốc ban đầu</b> ({item.nights} đêm)</td>
                      <td>Phòng gốc</td>
                      <td style={{ textAlign: 'right' }}><b>{money(initialRoomAmount)}</b></td>
                    </tr>
                    {initialDiscount > 0 && (
                      <tr>
                        <td className="bill-item-num">2</td>
                        <td>Khuyến mãi giảm giá</td>
                        <td>Chiết khấu</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-neg">-{money(initialDiscount)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="bill-item-num">3</td>
                      <td>Voucher giảm trừ</td>
                      <td>Mã giảm giá</td>
                      <td style={{ textAlign: 'right', color: '#94a3b8' }}>-0đ</td>
                    </tr>
                    {effectiveEarlyFee > 0 && (
                      <tr>
                        <td className="bill-item-num">4</td>
                        <td>Phụ thu nhận phòng sớm (Check-in lúc {checkInTime})</td>
                        <td>Nhận sớm</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(effectiveEarlyFee)}</td>
                      </tr>
                    )}
                    {effectiveLateFee > 0 && (
                      <tr>
                        <td className="bill-item-num">5</td>
                        <td>Phụ thu trả phòng muộn (Check-out lúc {checkOutTime})</td>
                        <td>Trả muộn</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(effectiveLateFee)}</td>
                      </tr>
                    )}
                    {extraGuestsTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">6</td>
                        <td>Phụ thu thêm khách / trẻ em</td>
                        <td>Khách thêm</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(extraGuestsTotal)}</td>
                      </tr>
                    )}
                    {extraBedsTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">7</td>
                        <td>Giường phụ & vật dụng phòng thêm</td>
                        <td>Giường phụ</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(extraBedsTotal)}</td>
                      </tr>
                    )}
                    {servicesTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">8</td>
                        <td>Dịch vụ tiện ích (Bữa sáng, xe máy, BBQ...)</td>
                        <td>Dịch vụ</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(servicesTotal)}</td>
                      </tr>
                    )}
                    {minibarTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">9</td>
                        <td>Minibar đồ uống & snack</td>
                        <td>Minibar</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(minibarTotal)}</td>
                      </tr>
                    )}
                    {petsTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">10</td>
                        <td>Phụ phí lưu trú thú cưng</td>
                        <td>Thú cưng</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(petsTotal)}</td>
                      </tr>
                    )}
                    {stayExtensionsTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">11</td>
                        <td>Gia hạn thời gian lưu trú</td>
                        <td>Gia hạn</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(stayExtensionsTotal)}</td>
                      </tr>
                    )}
                    {roomChangesTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">12</td>
                        <td>Chênh lệch đổi / nâng hạng phòng</td>
                        <td>Đổi phòng</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(roomChangesTotal)}</td>
                      </tr>
                    )}
                    {damageTotal > 0 && (
                      <tr>
                        <td className="bill-item-num">13</td>
                        <td>Bồi thường thiệt hại tài sản phòng</td>
                        <td>Bồi thường</td>
                        <td style={{ textAlign: 'right' }} className="bill-val-pos">+{money(damageTotal)}</td>
                      </tr>
                    )}
                    {adjustmentsTotal !== 0 && (
                      <tr>
                        <td className="bill-item-num">14</td>
                        <td>Điều chỉnh khác</td>
                        <td>Điều chỉnh</td>
                        <td style={{ textAlign: 'right' }} className={adjustmentsTotal > 0 ? 'bill-val-pos' : 'bill-val-neg'}>
                          {adjustmentsTotal > 0 ? `+${money(adjustmentsTotal)}` : `-${money(Math.abs(adjustmentsTotal))}`}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bill-total-row">
                      <td colSpan="3"><b>TỔNG HÓA ĐƠN LƯU TRÚ CUỐI CÙNG (FINAL TOTAL):</b></td>
                      <td style={{ textAlign: 'right' }}><strong className="text-primary" style={{ fontSize: '16px' }}>{money(liveTotalAmount)}</strong></td>
                    </tr>
                    <tr>
                      <td colSpan="3">Tiền khách đã thanh toán (Đã cọc + Đã trả trước):</td>
                      <td style={{ textAlign: 'right' }}><b>{money(item.paidAmount)}</b></td>
                    </tr>
                    <tr style={{ background: '#f8fafc', fontWeight: 800 }}>
                      <td colSpan="3">
                        {liveRemainingDue > 0 ? 'CÒN PHẢI THU (REMAINING DUE):' : liveRemainingDue < 0 ? 'CẦN HOÀN TIỀN CỌC PHÒNG CHO KHÁCH:' : 'TÌNH TRẠNG CÔNG NỢ TIỀN PHÒNG:'}
                      </td>
                      <td style={{ textAlign: 'right', color: liveRemainingDue > 0 ? '#b91c1c' : '#15803d', fontSize: '15px' }}>
                        {liveRemainingDue !== 0 ? money(Math.abs(liveRemainingDue)) : 'Đã thanh toán đủ 100%'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </article>

            {/* QUYẾT TOÁN CỌC TÀI SẢN RIÊNG BIỆT */}
            <div style={{ marginTop: '20px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '18px 20px' }}>
              <h4 style={{ margin: '0 0 10px', color: '#92400e' }}>Quyết toán tiền cọc tài sản (Separate Property Deposit Channel)</h4>
              <p style={{ margin: '0 0 6px', fontSize: '13px' }}>• Tiền cọc tài sản đã thu: <b>{money(recordedPropertyDeposit)}</b></p>
              <p style={{ margin: '0 0 6px', fontSize: '13px' }}>• Thiệt hại tài sản khấu trừ: <b style={{ color: '#b91c1c' }}>-{money(damageTotal)}</b></p>
              <div style={{ borderTop: '1px solid #fde68a', paddingTop: '8px', marginTop: '8px', fontWeight: 800, fontSize: '14px', color: netPropertyDepositRefund > 0 ? '#15803d' : '#92400e' }}>
                ➔ HOÀN TRẢ CỌC TÀI SẢN CHO KHÁCH: {money(netPropertyDepositRefund)}
                {excessDamageOwed > 0 && <span style={{ color: '#b91c1c', marginLeft: '6px' }}>(Khách nộp thêm bồi thường: {money(excessDamageOwed)})</span>}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: LỊCH SỬ THAY ĐỔI & GIAO DỊCH (TRANSACTIONS, MUTATIONS, AUDIT & NOTES) */}
        {activeTab === 'history' && (
          <div className="tab-content-pane lifecycle-stage-pane">
            <div className="stage-intro-card">
              <div className="stage-intro-icon"><HostIcon name="wallet" size={24} /></div>
              <div>
                <h4>Lịch sử thay đổi, Giao dịch thanh toán & Vết thao tác</h4>
                <p>Theo dõi toàn diện các dòng tiền thanh toán, lịch sử biến động đơn (đổi ngày, đổi phòng, gia hạn, hủy đơn), audit log và ghi chú nội bộ.</p>
              </div>
            </div>

            {/* Financial indicators snapshot bar */}
            <div className="financial-metrics-grid" style={{ marginBottom: '20px' }}>
              <div className="financial-metric-card primary">
                <small>Tổng giá booking cuối cùng</small>
                <strong>{money(liveTotalAmount)}</strong>
                <span>(Tiền phòng + Dịch vụ)</span>
              </div>
              <div className="financial-metric-card success">
                <small>Khách đã thanh toán phòng</small>
                <strong>{money(item.paidAmount || 0)}</strong>
                <span>(Bao gồm cọc phòng: {money(item.depositAmount || 0)})</span>
              </div>
              <div className={`financial-metric-card ${liveRemainingDue > 0 ? 'warning' : liveRemainingDue < 0 ? 'danger' : 'info'}`}>
                <small>{liveRemainingDue > 0 ? 'Còn phải thu' : liveRemainingDue < 0 ? 'Cần hoàn lại' : 'Công nợ phòng'}</small>
                <strong>{liveRemainingDue > 0 ? money(liveRemainingDue) : liveRemainingDue < 0 ? money(Math.abs(liveRemainingDue)) : '0đ'}</strong>
                <span>{liveRemainingDue === 0 ? 'Đã thu đủ 100%' : liveRemainingDue > 0 ? 'Chưa thanh toán hết' : 'Thừa cọc cần trả khách'}</span>
              </div>
              <div className="financial-metric-card info">
                <small>Cọc tài sản (Property Deposit)</small>
                <strong>{money(recordedPropertyDeposit)}</strong>
                <span>Đã bồi thường: {money(totalDamageCompensation)} · Hoàn: {money(netPropertyDepositRefund)}</span>
              </div>
            </div>

            {/* Transactions table */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px', overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#09275f' }}>Danh sách giao dịch thanh toán</h3>
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Mã GD / ID</th>
                    <th>Phân loại dòng tiền</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Trạng thái</th>
                    <th>Thời gian thực hiện</th>
                    <th>Người thực hiện / Ghi nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.payments || []).map(p => {
                    const isRefund = p.transactionType === 'Refund';
                    const typeLabel =
                      p.transactionType === 'Deposit' ? 'Cọc phòng ban đầu (Deposit)' :
                      p.transactionType === 'CheckInPayment' ? 'Thanh toán khi nhận phòng' :
                      p.transactionType === 'FinalPayment' ? 'Quyết toán khi trả phòng' :
                      p.transactionType === 'Refund' ? 'Hoàn tiền' :
                      p.transactionType === 'PropertyDeposit' ? 'Cọc đảm bảo tài sản' :
                      p.transactionType || 'Thanh toán';

                    const typeBadgeClass =
                      p.transactionType === 'Deposit' ? 'deposit' :
                      p.transactionType === 'FinalPayment' || p.transactionType === 'CheckInPayment' ? 'final' :
                      p.transactionType === 'Refund' ? 'refund' : 'deposit';

                    const statusClass =
                      p.status === 'Success' ? 'success' :
                      p.status === 'Pending' ? 'pending' : 'failed';

                    const statusLabel =
                      p.status === 'Success' ? 'Thành công' :
                      p.status === 'Pending' ? 'Chờ xử lý' : 'Thất bại';

                    const methodLabel =
                      p.paymentMethod === 'Cash' ? 'Tiền mặt (Cash)' :
                      p.paymentMethod === 'BankTransfer' ? 'Chuyển khoản (Bank)' :
                      p.paymentMethod === 'VNPay' ? 'Cổng VNPay' :
                      p.paymentMethod || 'Không xác định';

                    return (
                      <tr key={p.id}>
                        <td><strong>{p.transactionId || p.paymentCode || `PAY-${p.id}`}</strong></td>
                        <td><span className={`trans-type-badge ${typeBadgeClass}`}>{typeLabel}</span></td>
                        <td>
                          <b className={isRefund ? 'text-danger' : 'text-success'}>
                            {isRefund ? `-${money(p.amount)}` : `+${money(p.amount)}`}
                          </b>
                        </td>
                        <td>{methodLabel}</td>
                        <td><span className={`trans-status-badge ${statusClass}`}>{statusLabel}</span></td>
                        <td>{dateTime(p.createdAt || p.paymentTime)}</td>
                        <td>{p.recordedBy || p.payerName || item.customerName || 'Hệ thống'}</td>
                      </tr>
                    );
                  })}
                  {(!item.payments || !item.payments.length) && (
                    <tr>
                      <td colSpan="7" className="text-empty" style={{ textAlign: 'center', padding: '24px' }}>
                        Chưa có lịch sử giao dịch trực tuyến nào được lưu trên hệ thống. Khách hàng đã thanh toán qua thỏa thuận trực tiếp hoặc đang ghi nhận tiền mặt.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* VẾT THAO TÁC AUDIT TRAIL */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 14px', fontSize: '16px', color: '#09275f' }}>Lịch sử thao tác & Vết thay đổi (Audit Trail)</h3>
              <div className="audit-timeline">
                {(item.auditLogs || []).map(log => {
                  const actionLabel =
                    log.action === 'CheckIn' ? 'Check-in nhận phòng & Đối chiếu CCCD' :
                    log.action === 'AddCharge' ? 'Thêm khoản phát sinh / Dịch vụ' :
                    log.action === 'RemoveCharge' ? 'Xóa khoản phụ phí' :
                    log.action === 'ChangeRoom' ? 'Đổi phòng lưu trú' :
                    log.action === 'ExtendStay' ? 'Gia hạn thời gian lưu trú' :
                    log.action === 'CheckOut' ? 'Check-out trả phòng & Quyết toán' :
                    log.action === 'booking.contact_updated' ? 'Khách cập nhật người liên hệ' :
                    log.action === 'UpdateNote' ? 'Cập nhật ghi chú nội bộ' : log.action;

                  const actorDisplayName = log.actorName || (log.actorRole === 'Host' ? 'Chủ nhà / Quản lý' : log.actorRole === 'Admin' ? 'Quản trị viên' : log.actorRole === 'Customer' ? item.customerName : 'Hệ thống');

                  return (
                    <div key={log.id} className="audit-card">
                      <div className="audit-icon-wrap">
                        <HostIcon name="check" size={16} />
                      </div>
                      <div className="audit-main">
                        <div className="audit-header">
                          <span className="audit-action-tag">{actionLabel}</span>
                          <span>
                            {dateTime(log.createdAt)} · Thực hiện bởi: <strong>{actorDisplayName}</strong> {log.actorRole && <span style={{ color: '#64748b' }}>({log.actorRole})</span>}
                          </span>
                        </div>
                        {log.details && (
                          <div className="audit-details-text">
                            {log.details}
                          </div>
                        )}
                        {log.reason && (
                          <div className="audit-reason-text">
                            Lý do: <em>{log.reason}</em>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!item.auditLogs || !item.auditLogs.length) && (
                  <p className="text-empty" style={{ textAlign: 'center', padding: '16px' }}>Chưa có bản ghi vết thao tác nào cho đơn đặt phòng này.</p>
                )}
              </div>
            </div>

            {/* GHI CHÚ NỘI BỘ */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '18px 20px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#09275f' }}>Ghi chú nội bộ dành cho Host & Quản lý</h3>
              <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b' }}>Chỉ nhân viên nội bộ và Host nhìn thấy thông tin này, khách hàng không xem được.</p>
              <textarea
                className="form-input"
                style={{ width: '100%', minHeight: '90px', padding: '12px', resize: 'vertical' }}
                placeholder="Ghi chú về thói quen của khách, dặn dò nhân viên dọn phòng, lưu ý bàn giao..."
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-lifecycle-action"
                  style={{ background: '#09275f', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={saveNote}
                  disabled={hostNoteSaving}
                >
                  <HostIcon name="check" size={16} />
                  <span>{hostNoteSaving ? 'Đang lưu ghi chú...' : 'Lưu ghi chú nội bộ'}</span>
                </button>
              </div>
              {hostNoteMessage && (
                <div className="timing-message-alert" style={{ marginTop: '12px' }}>
                  <HostIcon name="check" size={15} />
                  <span>{hostNoteMessage}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* POPUP "+ THÊM KHOẢN PHÁT SINH" ĐẦY ĐỦ 8 NHÓM */}
        {showIncidentalModal && (
          <div className="incidental-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowIncidentalModal(false)}>
            <div className="incidental-modal-container">
              <header className="incidental-modal-header">
                <h3><HostIcon name="plus" size={18} /> Thêm khoản phát sinh vào Hóa đơn (Bill)</h3>
                <button type="button" className="booking-modal-close" onClick={() => setShowIncidentalModal(false)}>
                  <HostIcon name="close" size={18} />
                </button>
              </header>

              <nav className="incidental-category-nav">
                <button
                  type="button"
                  className={`incidental-category-btn ${incidentalCategory === 'service' ? 'active' : ''}`}
                  onClick={() => setIncidentalCategory('service')}
                >
                  <HostIcon name="tag" size={13} />
                  <span>Dịch vụ & Tiện ích</span>
                </button>
                {policy.minibar?.enabled !== false && (
                  <button
                    type="button"
                    className={`incidental-category-btn ${incidentalCategory === 'minibar' ? 'active' : ''}`}
                    onClick={() => setIncidentalCategory('minibar')}
                  >
                    <span>🥤 Minibar</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`incidental-category-btn ${incidentalCategory === 'extra_bed' ? 'active' : ''}`}
                  onClick={() => setIncidentalCategory('extra_bed')}
                >
                  <HostIcon name="bed" size={13} />
                  <span>Giường phụ & Vật dụng</span>
                </button>
                {policy.pets?.allowed !== false && (
                  <button
                    type="button"
                    className={`incidental-category-btn ${incidentalCategory === 'pet' ? 'active' : ''}`}
                    onClick={() => setIncidentalCategory('pet')}
                  >
                    <span>🐶 Thú cưng</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`incidental-category-btn ${incidentalCategory === 'damage' ? 'active' : ''}`}
                  onClick={() => setIncidentalCategory('damage')}
                >
                  <span>⚠️ Bồi thường tài sản</span>
                </button>
                <button
                  type="button"
                  className={`incidental-category-btn ${incidentalCategory === 'adjustment' ? 'active' : ''}`}
                  onClick={() => setIncidentalCategory('adjustment')}
                >
                  <span>⚖️ Điều chỉnh khác (+/-)</span>
                </button>
              </nav>

              <div className="incidental-modal-body">
                {/* 1. DỊCH VỤ PHÁT SINH */}
                {incidentalCategory === 'service' && (
                  <div>
                    <small style={{ fontWeight: 'bold', color: '#09275f' }}>Chọn nhanh dịch vụ cấu hình theo Homestay:</small>
                    <div className="catalog-item-grid" style={{ marginTop: '10px' }}>
                      {(policy.services?.items || [
                        { name: 'Bữa sáng buffet / Alacarte', unitPrice: policy.breakfast?.adultPrice || 100000, unit: 'suất' },
                        { name: 'Thuê xe máy tay ga', unitPrice: policy.vehicle?.scooterDailyPrice || 160000, unit: 'ngày' },
                        { name: 'Thuê xe máy xe số', unitPrice: policy.vehicle?.manualMotorbikeDailyPrice || 120000, unit: 'ngày' },
                        { name: 'Đưa đón sân bay (1 chiều)', unitPrice: policy.vehicle?.airportPickupPrice || 300000, unit: 'chuyến' },
                        { name: 'Bếp nướng BBQ sân vườn & than', unitPrice: 200000, unit: 'lần' },
                        { name: 'Giặt sấy quần áo nhanh', unitPrice: 50000, unit: 'kg' }
                      ]).map((s, idx) => (
                        <div
                          key={idx}
                          className="catalog-item-card"
                          onClick={() => {
                            handleAddCharge({
                              type: 'service',
                              description: `${s.name}`,
                              quantity: 1,
                              unitPrice: s.unitPrice
                            });
                          }}
                        >
                          <span className="catalog-item-name">{s.name}</span>
                          <span className="catalog-item-price">{money(s.unitPrice)}</span>
                          <span className="catalog-item-meta">Đơn vị: {s.unit || 'lượt'} · Bấm để thêm ngay</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. MINIBAR */}
                {incidentalCategory === 'minibar' && policy.minibar?.enabled !== false && (
                  <div>
                    <small style={{ fontWeight: 'bold', color: '#09275f' }}>Danh mục Minibar phòng (Cấu hình tự động theo chính sách):</small>
                    <div className="catalog-item-grid" style={{ marginTop: '10px' }}>
                      {(policy.minibar?.items || [
                        { name: 'Nước suối Aquafina/Lavie (500ml)', unitPrice: 15000 },
                        { name: 'Coca Cola / Pepsi / 7Up (Lon)', unitPrice: 20000 },
                        { name: 'Bia lon Heineken / Tiger', unitPrice: 30000 },
                        { name: 'Mì ly ăn liền', unitPrice: 25000 },
                        { name: 'Snack khoai tây / Hạt điều', unitPrice: 20000 }
                      ]).map((m, idx) => (
                        <div
                          key={idx}
                          className="catalog-item-card"
                          onClick={() => {
                            handleAddCharge({
                              type: 'minibar',
                              description: `Minibar: ${m.name}`,
                              quantity: 1,
                              unitPrice: m.unitPrice
                            });
                          }}
                        >
                          <span className="catalog-item-name">{m.name}</span>
                          <span className="catalog-item-price">{money(m.unitPrice)}</span>
                          <span className="catalog-item-meta">Minibar · Bấm để thêm vào bill</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. GIƯỜNG PHỤ & VẬT DỤNG */}
                {incidentalCategory === 'extra_bed' && (
                  <div>
                    <small style={{ fontWeight: 'bold', color: '#09275f' }}>Giường phụ & Vật dụng thêm (Cấu hình theo chính sách):</small>
                    <div className="catalog-item-grid" style={{ marginTop: '10px' }}>
                      <div
                        className="catalog-item-card"
                        onClick={() => {
                          const nights = Math.max(1, item.nights || 1);
                          handleAddCharge({
                            type: 'extra_bed',
                            description: `Giường phụ người lớn (${nights} đêm)`,
                            quantity: 1,
                            unitPrice: (policy.guests?.adultExtraBedFee || 200000) * nights
                          });
                        }}
                      >
                        <span className="catalog-item-name">Giường phụ người lớn</span>
                        <span className="catalog-item-price">{money(policy.guests?.adultExtraBedFee || 200000)}/đêm</span>
                        <span className="catalog-item-meta">Tính theo {item.nights} đêm lưu trú</span>
                      </div>

                      <div
                        className="catalog-item-card"
                        onClick={() => {
                          const nights = Math.max(1, item.nights || 1);
                          handleAddCharge({
                            type: 'extra_bed',
                            description: `Giường phụ trẻ em (${nights} đêm)`,
                            quantity: 1,
                            unitPrice: (policy.guests?.childExtraBedFee || 100000) * nights
                          });
                        }}
                      >
                        <span className="catalog-item-name">Giường phụ trẻ em</span>
                        <span className="catalog-item-price">{money(policy.guests?.childExtraBedFee || 100000)}/đêm</span>
                        <span className="catalog-item-meta">Tính theo {item.nights} đêm lưu trú</span>
                      </div>

                      <div
                        className="catalog-item-card"
                        onClick={() => {
                          const nights = Math.max(1, item.nights || 1);
                          handleAddCharge({
                            type: 'extra_item',
                            description: `Chăn gối nệm phụ (${nights} đêm)`,
                            quantity: 1,
                            unitPrice: (policy.guests?.extraBeddingFee || 50000) * nights
                          });
                        }}
                      >
                        <span className="catalog-item-name">Bộ chăn gối nệm phụ</span>
                        <span className="catalog-item-price">{money(policy.guests?.extraBeddingFee || 50000)}/đêm</span>
                        <span className="catalog-item-meta">Tính theo {item.nights} đêm lưu trú</span>
                      </div>

                      <div
                        className="catalog-item-card"
                        onClick={() => {
                          const fee = policy.guests?.babyCotFee || 0;
                          handleAddCharge({
                            type: 'extra_item',
                            description: `Nôi em bé sơ sinh`,
                            quantity: 1,
                            unitPrice: fee
                          });
                        }}
                      >
                        <span className="catalog-item-name">Nôi em bé sơ sinh</span>
                        <span className="catalog-item-price">{policy.guests?.babyCotFee ? money(policy.guests.babyCotFee) : 'Miễn phí'}</span>
                        <span className="catalog-item-meta">Theo yêu cầu của khách</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. THÚ CƯNG */}
                {incidentalCategory === 'pet' && policy.pets?.allowed !== false && (
                  <div>
                    <p>Chính sách homestay: Tối đa <b>{policy.pets?.maximumPerRoom || 1} thú cưng</b> / phòng. Phí quy định: <b>{money(policy.pets?.feePerNight || 150000)} / đêm</b>.</p>
                    <button
                      type="button"
                      className="btn-add-charge"
                      onClick={() => {
                        const nights = Math.max(1, item.nights || 1);
                        handleAddCharge({
                          type: 'pet',
                          description: `Phụ phí thú cưng (1 bé × ${nights} đêm)`,
                          quantity: 1,
                          unitPrice: (policy.pets?.feePerNight || 150000) * nights
                        });
                      }}
                    >
                      + Thêm phụ phí 1 thú cưng ({money((policy.pets?.feePerNight || 150000) * (item.nights || 1))})
                    </button>
                  </div>
                )}

                {/* 5. BỒI THƯỜNG TÀI SẢN */}
                {incidentalCategory === 'damage' && (
                  <div>
                    <small style={{ fontWeight: 'bold', color: '#09275f' }}>Danh mục bồi thường hư hỏng theo quy định:</small>
                    <div className="catalog-item-grid" style={{ marginTop: '10px' }}>
                      {(policy.assets?.items || [
                        { name: 'Mất / hỏng Chìa khóa / Thẻ từ', unitPrice: 200000 },
                        { name: 'Mất / hỏng Điều khiển TV / Máy lạnh', unitPrice: 300000 },
                        { name: 'Ố bẩn / rách Khăn tắm', unitPrice: 150000 },
                        { name: 'Làm vỡ ly cốc thủy tinh', unitPrice: 50000 },
                        { name: 'Bẩn ga trải giường cần giặt tẩy', unitPrice: 250000 }
                      ]).map((a, idx) => (
                        <div
                          key={idx}
                          className="catalog-item-card"
                          onClick={() => {
                            handleAddCharge({
                              type: 'damage_compensation',
                              description: `Bồi thường: ${a.name}`,
                              quantity: 1,
                              unitPrice: a.unitPrice
                            });
                          }}
                        >
                          <span className="catalog-item-name">{a.name}</span>
                          <span className="catalog-item-price text-danger">{money(a.unitPrice)}</span>
                          <span className="catalog-item-meta">Bồi thường tài sản · Bấm để thêm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. ĐIỀU CHỈNH KHÁC (+/-) */}
                {incidentalCategory === 'adjustment' && (
                  <div style={{ maxWidth: '500px' }}>
                    <div className="field-group">
                      <label>Mô tả khoản điều chỉnh <span className="req">*</span></label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: Giảm trừ do cúp điện tạm thời / Phụ thu dọn rác BBQ..."
                        value={chargeDesc}
                        onChange={e => setChargeDesc(e.target.value)}
                      />
                    </div>
                    <div className="field-group" style={{ marginTop: '10px' }}>
                      <label>Số tiền (VNĐ - Số âm để giảm trừ, số dương để phụ thu):</label>
                      <input
                        type="number"
                        step="10000"
                        className="form-input"
                        placeholder="VD: -100000 hoặc 150000"
                        value={chargePrice}
                        onChange={e => setChargePrice(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-add-charge"
                      style={{ marginTop: '14px' }}
                      onClick={() => handleAddCharge({
                        type: 'custom_adjustment',
                        description: chargeDesc.trim(),
                        quantity: 1,
                        unitPrice: Number(chargePrice) || 0
                      })}
                      disabled={chargeSaving || !chargeDesc}
                    >
                      Xác nhận Điều chỉnh vào Bill
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL 1: ĐỔI NGÀY LƯU TRÚ (DATE CHANGE)
            ======================================================== */}
        {showDateChangeModal && (
          <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowDateChangeModal(false)}>
            <div className="op-modal-container" style={{ maxWidth: '680px' }}>
              <header className="op-modal-header">
                <h3><HostIcon name="calendar" size={18} /> Đổi ngày lưu trú (Change Booking Dates)</h3>
                <button type="button" className="booking-modal-close" onClick={() => setShowDateChangeModal(false)}>
                  <HostIcon name="close" size={18} />
                </button>
              </header>

              <div className="op-modal-body">
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Khách hàng: <strong style={{ color: '#09275f' }}>{item.customerName}</strong> · Phòng: <strong>{item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Lịch lưu trú hiện tại: <b>{day(item.checkInDate)} ➔ {day(item.checkOutDate)}</b> ({item.nights} đêm)
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="field-group">
                    <label>Ngày nhận phòng mới <span className="req">*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      value={dateChangeInDate}
                      onChange={e => {
                        const val = e.target.value;
                        setDateChangeInDate(val);
                        fetchDateChangeQuote(val, dateChangeOutDate, dateChangeCustomFee);
                      }}
                    />
                  </div>
                  <div className="field-group">
                    <label>Ngày trả phòng mới <span className="req">*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      min={dateChangeInDate || undefined}
                      value={dateChangeOutDate}
                      onChange={e => {
                        const val = e.target.value;
                        setDateChangeOutDate(val);
                        fetchDateChangeQuote(dateChangeInDate, val, dateChangeCustomFee);
                      }}
                    />
                  </div>
                </div>

                {loadingDateChangeQuote && (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#64748b' }}>Đang tính toán chính sách và kiểm tra phòng trống...</div>
                )}

                {/* SECTION XXI: REAL-TIME PREVIEW FLOW */}
                {dateChangeQuote && (
                  <div className="preview-flow-card">
                    <div className="preview-flow-title">
                      <span>Dự toán điều chỉnh lịch lưu trú (Real-Time Preview)</span>
                      {dateChangeQuote.isAvailable ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                          ✅ Phòng còn trống
                        </span>
                      ) : (
                        <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                          ❌ Phòng đã bị trùng lịch
                        </span>
                      )}
                    </div>

                    <div className="preview-flow-grid">
                      <div className="preview-flow-box">
                        <small>1. TRƯỚC THAY ĐỔI</small>
                        <b>{day(item.checkInDate)} ➔ {day(item.checkOutDate)}</b>
                        <span>Số đêm: <strong>{item.nights} đêm</strong></span>
                        <span>Tiền phòng: <strong>{money(item.roomAmount || item.subtotal)}</strong></span>
                        <span>Công nợ: <strong style={{ color: liveRemainingDue > 0 ? '#b91c1c' : '#15803d' }}>
                          {liveRemainingDue > 0 ? `Thiếu ${money(liveRemainingDue)}` : 'Đã thanh toán đủ'}
                        </strong></span>
                      </div>
                      <div className="preview-flow-box">
                        <small>2. SAU THAY ĐỔI</small>
                        <b>{day(dateChangeQuote.newCheckInDate || dateChangeInDate)} ➔ {day(dateChangeQuote.newCheckOutDate || dateChangeOutDate)}</b>
                        <span>Số đêm: <strong>{dateChangeQuote.newNights} đêm</strong></span>
                        <span>Tiền phòng mới: <strong>{money(dateChangeQuote.newRoomAmount)}</strong></span>
                        <span>Công nợ mới: <strong style={{ color: (dateChangeQuote.debtAfter ?? (liveRemainingDue + dateChangeQuote.totalAmountDifference)) > 0 ? '#b91c1c' : '#15803d' }}>
                          {(dateChangeQuote.debtAfter ?? (liveRemainingDue + dateChangeQuote.totalAmountDifference)) > 0
                            ? `Thiếu ${money(dateChangeQuote.debtAfter ?? (liveRemainingDue + dateChangeQuote.totalAmountDifference))}`
                            : 'Đã thanh toán đủ'}
                        </strong></span>
                      </div>
                    </div>

                    <div className="preview-change-summary">
                      <div className="preview-change-row">
                        <span>Khoảng cách trước Check-in:</span>
                        <b>{dateChangeQuote.daysBeforeCheckIn} ngày (Khung phí: {dateChangeQuote.feePercent}%)</b>
                      </div>
                      <div className="preview-change-row">
                        <span>Phí đổi ngày quy định:</span>
                        <b className="text-preview-orange">+{money(dateChangeQuote.calculatedDateChangeFee)}</b>
                      </div>
                      <div className="preview-change-row">
                        <span>Chênh lệch tiền phòng ({dateChangeQuote.newNights} đêm vs {item.nights} đêm):</span>
                        <b className={dateChangeQuote.priceDifference > 0 ? 'text-preview-red' : dateChangeQuote.priceDifference < 0 ? 'text-preview-green' : ''}>
                          {dateChangeQuote.priceDifference > 0 ? `+${money(dateChangeQuote.priceDifference)}` : dateChangeQuote.priceDifference < 0 ? `-${money(Math.abs(dateChangeQuote.priceDifference))}` : '0đ'}
                        </b>
                      </div>
                      <div className="preview-change-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', fontWeight: 800 }}>
                        <span style={{ color: '#09275f' }}>➔ TỔNG ĐIỀU CHỈNH HÓA ĐƠN:</span>
                        <b style={{ fontSize: '14px', color: dateChangeQuote.totalAmountDifference > 0 ? '#b91c1c' : dateChangeQuote.totalAmountDifference < 0 ? '#15803d' : '#09275f' }}>
                          {dateChangeQuote.totalAmountDifference > 0 ? `+${money(dateChangeQuote.totalAmountDifference)} (Thu thêm)` : dateChangeQuote.totalAmountDifference < 0 ? `-${money(Math.abs(dateChangeQuote.totalAmountDifference))} (Giảm trừ)` : '0đ'}
                        </b>
                      </div>
                    </div>
                  </div>
                )}

                <div className="field-group" style={{ marginBottom: '14px' }}>
                  <label>Điều chỉnh phí đổi ngày (VNĐ - Để trống để áp dụng theo chính sách):</label>
                  <input
                    type="number"
                    step="10000"
                    className="form-input"
                    placeholder={`Mặc định theo chính sách: ${dateChangeQuote ? money(dateChangeQuote.calculatedDateChangeFee) : '0đ'}`}
                    value={dateChangeCustomFee}
                    onChange={e => {
                      const val = e.target.value;
                      setDateChangeCustomFee(val);
                      fetchDateChangeQuote(dateChangeInDate, dateChangeOutDate, val);
                    }}
                  />
                </div>

                <div className="field-group" style={{ marginBottom: '14px' }}>
                  <label>Lý do đổi ngày lưu trú <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Khách dời lịch bay / Thỏa thuận đổi lịch..."
                    value={dateChangeReason}
                    onChange={e => setDateChangeReason(e.target.value)}
                  />
                </div>

                {dateChangeMessage && (
                  <div className="timing-message-alert" style={{ marginBottom: '14px' }}>
                    <HostIcon name="check" size={15} />
                    <span>{dateChangeMessage}</span>
                  </div>
                )}
              </div>

              <footer className="op-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowDateChangeModal(false)}>Quay lại</button>
                <button
                  type="button"
                  className="btn-modal-submit"
                  onClick={handleChangeDates}
                  disabled={dateChangeSaving || loadingDateChangeQuote || !dateChangeQuote?.isAvailable || !dateChangeReason.trim()}
                >
                  {dateChangeSaving ? 'Đang cập nhật...' : 'Xác nhận Đổi ngày lưu trú'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL 2: ĐỔI PHÒNG (ROOM CHANGE / UPGRADE)
            ======================================================== */}
        {showRoomChangeModal && (
          <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowRoomChangeModal(false)}>
            <div className="op-modal-container" style={{ maxWidth: '680px' }}>
              <header className="op-modal-header">
                <h3><HostIcon name="key" size={18} /> Đổi phòng lưu trú (Change Room / Upgrade)</h3>
                <button type="button" className="booking-modal-close" onClick={() => setShowRoomChangeModal(false)}>
                  <HostIcon name="close" size={18} />
                </button>
              </header>

              <div className="op-modal-body">
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Phòng hiện tại: <strong style={{ color: '#09275f' }}>{item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName}</strong> ({item.details?.[0]?.roomTypeName || 'Tiêu chuẩn'})
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Số khách thực tế của đơn: <b>{actualTotalGuests} khách</b> ({actualAdultsCount} người lớn, {actualChildrenCount} trẻ em)
                  </div>
                </div>

                <div className="field-group" style={{ marginBottom: '14px' }}>
                  <label>Chọn phòng trống mới muốn chuyển sang <span className="req">*</span></label>
                  {loadingRooms ? (
                    <div style={{ padding: '10px', color: '#64748b' }}>Đang tải danh sách phòng trống...</div>
                  ) : (
                    availableRooms.length ? (
                      <select
                        className="form-input"
                        value={selectedNewRoomId}
                        onChange={e => setSelectedNewRoomId(e.target.value)}
                      >
                        <option value="">-- Chọn phòng trống chuyển sang --</option>
                        {availableRooms.map(r => (
                          <option key={r.id} value={r.id}>
                            Phòng {r.roomNumber} - {r.roomTypeName} (tối đa {r.maxCapacity} khách) - {money(r.pricePerNight)}/đêm {r.priceDifference > 0 ? `[+${money(r.priceDifference)} cho ${r.remainingNights} đêm]` : r.priceDifference < 0 ? `[-${money(Math.abs(r.priceDifference))} cho ${r.remainingNights} đêm]` : '[Bằng giá]'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="bo-message error" role="status">Không có phòng phù hợp sức chứa và còn trống trong thời gian lưu trú còn lại.</div>
                    )
                  )}
                </div>

                {/* SECTION XXI: REAL-TIME PREVIEW FLOW */}
                {(() => {
                  const selRoom = availableRooms.find(r => String(r.id) === String(selectedNewRoomId));
                  if (!selRoom) return null;
                  const isOverCapacity = actualTotalGuests > (selRoom.maxCapacity || 99);
                  const policyDiff = isHomestayFault && selRoom.diffPerNight > 0 ? 0 : (customDiff !== '' ? Number(customDiff) || 0 : selRoom.priceDifference || 0);
                  const effectiveDiff = applyDiff ? policyDiff : 0;
                  const newDebt = liveRemainingDue + effectiveDiff;
                  return (
                    <div className="preview-flow-card" style={{ marginBottom: '16px' }}>
                      <div className="preview-flow-title">
                        <span>Dự toán đổi phòng (Real-Time Preview)</span>
                        {isOverCapacity ? (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                            ⚠️ Vượt sức chứa ({selRoom.maxCapacity} người)
                          </span>
                        ) : (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                            ✅ Phù hợp sức chứa ({selRoom.baseCapacity}-{selRoom.maxCapacity} người)
                          </span>
                        )}
                      </div>

                      <div className="preview-flow-grid">
                        <div className="preview-flow-box">
                          <small>1. PHÒNG HIỆN TẠI</small>
                          <b>{item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName}</b>
                          <span>Đơn giá: <strong>{money(pricePerNight)}/đêm</strong></span>
                          <span>Công nợ phòng: <strong style={{ color: liveRemainingDue > 0 ? '#b91c1c' : '#15803d' }}>
                            {liveRemainingDue > 0 ? `Thiếu ${money(liveRemainingDue)}` : 'Đã đủ'}
                          </strong></span>
                        </div>
                        <div className="preview-flow-box">
                          <small>2. PHÒNG MỚI</small>
                          <b>Phòng {selRoom.roomNumber} ({selRoom.roomTypeName})</b>
                          <span>Đơn giá mới: <strong>{money(selRoom.pricePerNight)}/đêm</strong></span>
                          <span>Công nợ dự kiến: <strong style={{ color: newDebt > 0 ? '#b91c1c' : '#15803d' }}>
                            {newDebt > 0 ? `Thiếu ${money(newDebt)}` : 'Đã thanh toán đủ'}
                          </strong></span>
                        </div>
                      </div>

                      <div className="preview-change-summary">
                        <div className="preview-change-row">
                          <span>Chênh lệch niêm yết ({selRoom.remainingNights} đêm còn lại):</span>
                          <b>{selRoom.priceDifference > 0 ? `+${money(selRoom.priceDifference)}` : selRoom.priceDifference < 0 ? `-${money(Math.abs(selRoom.priceDifference))}` : '0đ'}</b>
                        </div>
                        {isHomestayFault && selRoom.diffPerNight > 0 && (
                          <div className="preview-change-row">
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>Chính sách Lỗi Homestay:</span>
                            <b style={{ color: '#16a34a' }}>Miễn phí nâng hạng (0đ)</b>
                          </div>
                        )}
                        <div className="preview-change-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', fontWeight: 800 }}>
                          <span style={{ color: '#09275f' }}>➔ THỰC THU CHÊNH LỆCH VÀO BILL:</span>
                          <b style={{ fontSize: '14px', color: effectiveDiff > 0 ? '#b91c1c' : effectiveDiff < 0 ? '#15803d' : '#09275f' }}>
                            {effectiveDiff > 0 ? `+${money(effectiveDiff)} (Thu thêm)` : effectiveDiff < 0 ? `-${money(Math.abs(effectiveDiff))} (Giảm trừ)` : 'Miễn phí / Bằng giá (0đ)'}
                          </b>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={isHomestayFault}
                      onChange={e => setIsHomestayFault(e.target.checked)}
                    />
                    <span>Lỗi phát sinh từ phía Homestay (Sự cố phòng, kỹ thuật...) ➔ Miễn phí đổi / nâng hạng phòng cho khách</span>
                  </label>
                </div>

                {!isHomestayFault && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="field-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={applyDiff}
                          onChange={e => setApplyDiff(e.target.checked)}
                        />
                        <span>Thu chênh lệch giá vào Hóa đơn</span>
                      </label>
                    </div>
                    {applyDiff && (
                      <div className="field-group">
                        <label>Chênh lệch tùy chỉnh (VNĐ, để trống lấy tự động):</label>
                        <input
                          type="number"
                          step="10000"
                          className="form-input"
                          placeholder="Mặc định theo giá phòng"
                          value={customDiff}
                          onChange={e => setCustomDiff(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="field-group" style={{ marginBottom: '14px' }}>
                  <label>Lý do đổi phòng <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Khách muốn nâng hạng phòng view hồ / Điều hòa phòng cũ gặp sự cố..."
                    value={changeReason}
                    onChange={e => setChangeReason(e.target.value)}
                  />
                </div>

                {roomChangeMessage && (
                  <div className={roomChangeMessage.includes('thành công') ? 'timing-message-alert' : 'bo-message error'} style={{ marginBottom: '14px' }} role="alert">
                    <HostIcon name={roomChangeMessage.includes('thành công') ? 'check' : 'alert'} size={15} />
                    <span>{roomChangeMessage}</span>
                  </div>
                )}
              </div>

              <footer className="op-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowRoomChangeModal(false)}>Quay lại</button>
                <button
                  type="button"
                  className="btn-modal-submit"
                  onClick={handleChangeRoom}
                  disabled={roomChangeSaving || !selectedNewRoomId || !changeReason.trim()}
                >
                  {roomChangeSaving ? 'Đang xử lý đổi phòng...' : 'Xác nhận Đổi phòng'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL 3: GIA HẠN LƯU TRÚ (EXTEND STAY)
            ======================================================== */}
        {showExtendModal && (
          <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowExtendModal(false)}>
            <div className="op-modal-container" style={{ maxWidth: '680px' }}>
              <header className="op-modal-header">
                <h3><HostIcon name="clock" size={18} /> Gia hạn lưu trú (Extend Stay)</h3>
                <button type="button" className="booking-modal-close" onClick={() => setShowExtendModal(false)}>
                  <HostIcon name="close" size={18} />
                </button>
              </header>

              <div className="op-modal-body">
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Phòng: <strong style={{ color: '#09275f' }}>{item.details?.[0]?.roomNumber ? `Phòng ${item.details[0].roomNumber}` : item.roomName}</strong> · Khách: <strong>{item.customerName}</strong>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Ngày trả phòng hiện tại: <b style={{ color: '#b45309' }}>{day(item.checkOutDate)}</b> (Đã ở: {item.nights} đêm)
                  </div>
                </div>

                <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '13px', color: '#166534', marginBottom: '14px' }}>
                  💡 <b>Lưu ý nghiệp vụ:</b> Nếu khách chỉ muốn trả phòng muộn vài giờ trong ngày trả phòng (ví dụ đến 15:00 hoặc 18:00), vui lòng sử dụng <b>Phụ thu Late Check-out</b> tại mục Check-out thay vì gia hạn theo đêm.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="field-group">
                    <label>Ngày trả phòng mới <span className="req">*</span></label>
                    <input
                      type="date"
                      className="form-input"
                      min={(() => {
                        const d = new Date(item.checkOutDate);
                        d.setDate(d.getDate() + 1);
                        return d.toISOString().slice(0, 10);
                      })()}
                      value={extendNewDate}
                      onChange={e => {
                        const val = e.target.value;
                        setExtendNewDate(val);
                        fetchExtendQuote(val, extendNightlyRate);
                      }}
                    />
                  </div>
                  <div className="field-group">
                    <label>Đơn giá mỗi đêm gia hạn (VNĐ):</label>
                    <input
                      type="number"
                      step="10000"
                      className="form-input"
                      value={extendNightlyRate}
                      onChange={e => {
                        const val = e.target.value;
                        setExtendNightlyRate(val);
                        fetchExtendQuote(extendNewDate, val);
                      }}
                    />
                  </div>
                </div>

                {loadingExtendQuote && (
                  <div style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>Đang kiểm tra phòng trống và tính chi phí gia hạn...</div>
                )}

                {/* SECTION XXI: REAL-TIME PREVIEW FLOW */}
                {extendQuote && (
                  <div className="preview-flow-card" style={{ marginBottom: '14px' }}>
                    <div className="preview-flow-title">
                      <span>Dự toán gia hạn lưu trú (Real-Time Preview)</span>
                      {extendQuote.isAvailable ? (
                        <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                          ✅ Phòng còn trống
                        </span>
                      ) : (
                        <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                          ❌ Phòng đã bị trùng lịch
                        </span>
                      )}
                    </div>

                    <div className="preview-flow-grid">
                      <div className="preview-flow-box">
                        <small>1. KỲ LƯU TRÚ HIỆN TẠI</small>
                        <b>Trả phòng: {day(item.checkOutDate)}</b>
                        <span>Tổng số đêm: <strong>{item.nights} đêm</strong></span>
                        <span>Công nợ hiện tại: <strong style={{ color: liveRemainingDue > 0 ? '#b91c1c' : '#15803d' }}>
                          {liveRemainingDue > 0 ? `Thiếu ${money(liveRemainingDue)}` : 'Đã thanh toán đủ'}
                        </strong></span>
                      </div>
                      <div className="preview-flow-box">
                        <small>2. SAU GIA HẠN</small>
                        <b>Trả phòng mới: {day(extendQuote.newCheckOutDate || extendNewDate)}</b>
                        <span>Tổng số đêm mới: <strong>{(extendQuote.newTotalNights || item.nights + extendQuote.extendedNights)} đêm</strong></span>
                        <span>Công nợ sau gia hạn: <strong style={{ color: (extendQuote.debtAfter ?? (liveRemainingDue + extendQuote.totalCost)) > 0 ? '#b91c1c' : '#15803d' }}>
                          {(extendQuote.debtAfter ?? (liveRemainingDue + extendQuote.totalCost)) > 0
                            ? `Thiếu ${money(extendQuote.debtAfter ?? (liveRemainingDue + extendQuote.totalCost))}`
                            : 'Đã thanh toán đủ'}
                        </strong></span>
                      </div>
                    </div>

                    {extendQuote.breakdown && extendQuote.breakdown.length > 0 && (
                      <div style={{ margin: '10px 0', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <small style={{ fontWeight: 700, color: '#09275f' }}>Bảng giá chi tiết từng đêm gia hạn thêm:</small>
                        {extendQuote.breakdown.map((b, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                            <span>{day(b.date)} ({b.isWeekend ? 'Cuối tuần' : 'Ngày thường'}):</span>
                            <strong>{money(b.price)}</strong>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="preview-change-summary">
                      <div className="preview-change-row">
                        <span>Số đêm gia hạn thêm:</span>
                        <b className="text-preview-blue">+{extendQuote.extendedNights} đêm</b>
                      </div>
                      <div className="preview-change-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '6px', fontWeight: 800 }}>
                        <span style={{ color: '#09275f' }}>➔ TỔNG TIỀN GIA HẠN THÊM VÀO BILL:</span>
                        <b style={{ fontSize: '15px', color: '#0284c7' }}>+{money(extendQuote.totalCost)}</b>
                      </div>
                    </div>
                  </div>
                )}

                <div className="field-group" style={{ marginBottom: '14px' }}>
                  <label>Lý do gia hạn lưu trú <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Khách gia hạn thêm lịch công tác / Thích không gian homestay..."
                    value={extendReason}
                    onChange={e => setExtendReason(e.target.value)}
                  />
                </div>

                {extendMessage && (
                  <div className={extendMessage.includes('Lỗi') || extendMessage.includes('lỗi') ? 'bo-message error' : 'timing-message-alert'} style={{ marginBottom: '14px' }} role="alert">
                    <HostIcon name={extendMessage.includes('Lỗi') || extendMessage.includes('lỗi') ? 'alert' : 'check'} size={15} />
                    <span>{extendMessage}</span>
                  </div>
                )}
              </div>

              <footer className="op-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowExtendModal(false)}>Quay lại</button>
                <button
                  type="button"
                  className="btn-modal-submit"
                  onClick={handleExtendStay}
                  disabled={extendSaving || loadingExtendQuote || !extendQuote?.isAvailable || !extendReason.trim()}
                >
                  {extendSaving ? 'Đang lưu gia hạn...' : 'Xác nhận Gia hạn lưu trú'}
                </button>
              </footer>
            </div>
          </div>
        )}

        {/* ========================================================
            MODAL 4: HỦY ĐƠN ĐẶT PHÒNG (CANCEL BOOKING)
            ======================================================== */}
        {showCancelModal && (
          <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setShowCancelModal(false)}>
            <div className="op-modal-container" style={{ maxWidth: '680px' }}>
              <header className="op-modal-header" style={{ borderBottomColor: '#fee2e2' }}>
                <h3 style={{ color: '#b91c1c' }}><HostIcon name="close" size={18} /> Hủy đơn đặt phòng (Cancel Booking)</h3>
                <button type="button" className="booking-modal-close" onClick={() => setShowCancelModal(false)}>
                  <HostIcon name="close" size={18} />
                </button>
              </header>

              <div className="op-modal-body">
                <div className="timing-message-alert error" style={{ marginBottom: '14px' }}>
                  ⚠️ <b>Cảnh báo quan trọng:</b> Thao tác này sẽ chuyển đơn sang trạng thái <b>ĐÃ HỦY (Cancelled)</b>, phòng sẽ được giải phóng ngay lập tức về trạng thái <b>TRỐNG (Available)</b>, và ghi nhận giao dịch hoàn tiền tương ứng.
                </div>

                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    Khách hàng: <strong style={{ color: '#09275f' }}>{item.customerName}</strong> ({item.customerPhone}) · Mã đơn: <b>{item.bookingCode}</b>
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Kỳ lưu trú: <b>{day(item.checkInDate)} ➔ {day(item.checkOutDate)}</b> ({item.nights} đêm)
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                    Tổng tiền đơn: <b>{money(liveTotalAmount)}</b> · Đã thanh toán / Đã cọc: <b style={{ color: '#15803d' }}>{money(item.paidAmount)}</b>
                  </div>
                </div>

                {loadingCancelQuote && (
                  <div style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>Đang tính toán chính sách hủy và số tiền hoàn...</div>
                )}

                {/* SECTION XXI: REAL-TIME PREVIEW FLOW */}
                {cancelQuote && (
                  <div className="preview-flow-card" style={{ marginBottom: '14px' }}>
                    <div className="preview-flow-title">
                      <span>Dự toán chính sách hủy & Hoàn tiền (Real-Time Preview)</span>
                      <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                        Áp dụng chính sách hủy
                      </span>
                    </div>

                    <div className="preview-flow-grid">
                      <div className="preview-flow-box">
                        <small>1. THÔNG TIN ĐƠN & CỌC</small>
                        <b>Tổng giá trị: {money(liveTotalAmount)}</b>
                        <span>Tiền khách đã nộp: <strong>{money(item.paidAmount)}</strong></span>
                        <span>Cọc phòng quy định: <strong>{money(item.depositAmount)}</strong></span>
                      </div>
                      <div className="preview-flow-box">
                        <small>2. DỰ TOÁN HOÀN TRẢ</small>
                        <b>Khoảng cách: {cancelQuote.daysBeforeCheckIn} ngày trước Check-in</b>
                        <span>Tỷ lệ hoàn tiền: <strong style={{ color: '#15803d' }}>{cancelQuote.refundPercent}%</strong></span>
                        <span>Hoàn lại khách: <strong style={{ color: '#15803d' }}>{money(cancelOverrideRefund !== '' ? Number(cancelOverrideRefund) : cancelQuote.refundAmount)}</strong></span>
                      </div>
                    </div>

                    <div className="preview-change-summary">
                      <div className="preview-change-row">
                        <span>Tiền hoàn trả cho khách:</span>
                        <b className="text-preview-green">{money(cancelOverrideRefund !== '' ? Number(cancelOverrideRefund) : cancelQuote.refundAmount)}</b>
                      </div>
                      <div className="preview-change-row">
                        <span>Phí phạt hủy phòng giữ lại:</span>
                        <b className="text-preview-red">{money(cancelOverrideFee !== '' ? Number(cancelOverrideFee) : cancelQuote.cancellationFee)}</b>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="field-group">
                    <label>Số tiền hoàn lại cho khách (VNĐ):</label>
                    <input
                      type="number"
                      step="10000"
                      className="form-input"
                      value={cancelOverrideRefund}
                      onChange={e => setCancelOverrideRefund(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label>Phí hủy phòng giữ lại (VNĐ):</label>
                    <input
                      type="number"
                      step="10000"
                      className="form-input"
                      value={cancelOverrideFee}
                      onChange={e => setCancelOverrideFee(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group" style={{ marginBottom: '14px' }}>
                  <label>Lý do hủy đơn đặt phòng <span className="req">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Khách hủy do sự cố máy bay / Yêu cầu hủy theo thỏa thuận..."
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                  />
                </div>

                {cancelMessage && (
                  <div className="timing-message-alert" style={{ marginBottom: '14px' }}>
                    <HostIcon name="check" size={15} />
                    <span>{cancelMessage}</span>
                  </div>
                )}
              </div>

              <footer className="op-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowCancelModal(false)}>Quay lại</button>
                <button
                  type="button"
                  className="btn-modal-submit danger"
                  onClick={handleCancelBooking}
                  disabled={cancelSaving || !cancelReason.trim()}
                >
                  {cancelSaving ? 'Đang xử lý hủy...' : 'Xác nhận Hủy đơn đặt phòng'}
                </button>
              </footer>
            </div>
          </div>
        )}

        <footer>
          <button type="button" className="btn-close-modal" onClick={close}>Đóng</button>
        </footer>
      </section>
    </div>
  );
}

