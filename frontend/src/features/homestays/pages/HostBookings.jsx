import React, { useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { confirmDialog } from '../../../shared/feedback/feedback.js';
import BookingDetail from './HostBookingDetail.jsx';
import { money, date, dateTime, today, dayDiff, upcomingStatuses, isUpcoming, urgencyFor, bookingGroup, groupLabels, labels, tabs, paymentState, paymentLabel, csvCell } from './hostBookingUtils.js';

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
  const [selectedStage, setSelectedStage] = useState('CHECK_IN');
  const [filterOpen, setFilterOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const getInitialStage = (bookingStatus) => {
    switch (bookingStatus) {
      case 'Hold':
      case 'Confirmed':
        return 'CHECK_IN';
      case 'CheckedIn':
        return 'STAYING';
      case 'CheckedOut':
      case 'Completed':
        return 'CHECK_OUT';
      case 'Cancelled':
      case 'CancellationRequested':
        return 'OVERVIEW';
      default:
        return 'CHECK_IN';
    }
  };

  const open = async (item, requestedStage = null) => {
    setSelected({ ...item, isNew: false, contactIsNew: false });
    let stage = requestedStage;
    if (!stage || stage === 'overview') {
      stage = getInitialStage(item.status);
    } else if (stage === 'checkin' || stage === 'CHECK_IN') {
      stage = 'CHECK_IN';
    } else if (stage === 'checkout' || stage === 'stay' || stage === 'STAYING') {
      // RULE 4, 18, 19: When booking is CheckedIn (Staying), clicking 'Trả phòng' MUST OPEN STAGE 2 ('STAYING')!
      // NEVER auto-open Stage 3 ('CHECK_OUT')!
      if (item.status === 'CheckedIn') {
        stage = 'STAYING';
      } else {
        stage = 'CHECK_OUT';
      }
    }
    setSelectedStage(stage);
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
                {group === 'closed' && <button hidden type="button" className="mobile-history-toggle" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen}>{historyOpen ? 'Thu gọn' : 'Xem danh sách'}<HostIcon name={historyOpen ? 'chevronDown' : 'chevronRight'} size={14}/></button>}
              </div>
            )}
            <article className={`${x.isNew ? 'is-new ' : ''}${urgency?.urgent ? `is-urgent urgency-${urgency.level} ` : ''}${group === 'closed' && !historyOpen ? 'mobile-history-collapsed' : ''}`} onClick={() => open(x)}>
              <div className="booking-primary">
                <span>{x.isNew && group !== 'closed' && <b>Mới</b>}{x.contactIsNew && group !== 'closed' && <b className="contact-updated-chip">Mới cập nhật</b>}{x.bookingCode}</span>
                <h3>{x.customerName}</h3>
                <small>{x.customerPhone || 'Chưa có SĐT'} · Đặt lúc {dateTime(x.createdAt)}</small>
                {urgency && <span className={`booking-urgency booking-urgency-mobile urgency-${urgency.level}`}>{urgency.label}</span>}
              </div>
              <div className="booking-property">
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
                <div hidden className="mobile-booking-date-pair"><span><small>NHẬN PHÒNG</small><b>{date(x.checkInDate)}</b></span><i><HostIcon name="arrowRight" size={15}/></i><span><small>TRẢ PHÒNG</small><b>{date(x.checkOutDate)}</b></span></div>
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
                  <button className={checkInReady ? 'btn-action-highlight' : 'btn-action-secondary'} onClick={() => open(x, 'CHECK_IN')}>
                    {urgency?.level === 'overdue' ? 'Check-in trễ' : 'Check-in'}
                  </button>
                )}
                {x.status === 'CheckedIn' && (
                  <button className="btn-action-highlight" onClick={() => open(x, 'STAYING')}>
                    Kiểm tra & trả phòng
                  </button>
                )}
                {x.status === 'CheckoutPendingPayment' && (
                  <button className="btn-action-highlight" onClick={() => open(x, 'CHECK_OUT')}>
                    Thanh toán & hoàn tất
                  </button>
                )}
                {x.status === 'CancellationRequested' && (
                  <button onClick={() => decide(x, true)}>Duyệt hủy</button>
                )}
                <button className="btn-detail" onClick={() => open(x)}>Chi tiết</button>
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

      {selected && <BookingDetail item={selected} initialStage={selectedStage} close={() => setSelected(null)} run={run} decide={decide} />}
    </section>
  );
}
