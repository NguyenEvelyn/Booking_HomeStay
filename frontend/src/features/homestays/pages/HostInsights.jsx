import React, { useEffect, useMemo, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';

const money = v => `${new Intl.NumberFormat('vi-VN').format(Number(v) || 0)}đ`;
const ms = 86400000;
const labels = {
  Confirmed: 'Đã xác nhận',
  CheckedIn: 'Đang ở',
  Completed: 'Hoàn thành',
  PendingPayment: 'Chờ thanh toán',
  Cancelled: 'Đã hủy',
  Expired: 'Hết hạn'
};
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const calendarDayWidth = 66;
const calendarLabelWidth = 240;

function Stat({ name, value, detail, icon, iconColor = '#0b4ae6' }) {
  return (
    <article className="stat-card">
      {icon && (
        <div className="stat-card-icon">
          <HostIcon name={icon} size={20} color={iconColor} />
        </div>
      )}
      <div>
        <small>{name}</small>
        <strong>{value}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <section className="host-panel">
      <header>
        <div>
          <small>PHÂN TÍCH VẬN HÀNH</small>
          <h2>{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

export function CalendarBoard({ items, homestays, rooms = [], run }) {
  const now = new Date();
  const [at, setAt] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [open, setOpen] = useState(new Set());
  const [home, setHome] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const scroll = useRef(null);

  const y = at.getFullYear();
  const m = at.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const last = `${y}-${String(m + 1).padStart(2, '0')}-${days}`;
  const today = iso(now);
  const current = y === now.getFullYear() && m === now.getMonth();

  const homes = homestays.filter(h => (!home || String(h.id) === home) && (!city || h.province === city));
  const cities = [...new Set(homestays.map(h => h.province).filter(Boolean))];

  const active = useMemo(() => items.filter(x => (
    x.checkInDate <= last
    && x.checkOutDate > first
    && (!status || x.status === status)
    && (!home || String(x.homestayId) === home)
    && (!city || homestays.find(h => h.id === x.homestayId)?.province === city)
    && (!q.trim() || `${x.bookingCode} ${x.customerName}`.toLowerCase().includes(q.trim().toLowerCase()))
  )), [items, last, first, status, home, city, q, homestays]);

  const nights = active.filter(x => !['Cancelled', 'Expired'].includes(x.status)).reduce((s, x) => (
    s + Math.max(0, (Math.min(new Date(x.checkOutDate), new Date(y, m + 1, 1)) - Math.max(new Date(x.checkInDate), new Date(y, m, 1))) / ms)
  ), 0);
  const capacity = Math.max(1, rooms.filter(r => homes.some(h => h.id === r.homestayId)).length) * days;

  const move = n => setAt(new Date(y, m + n, 1));
  const scrollToday = () => {
    if (!current) {
      setAt(new Date(now.getFullYear(), now.getMonth(), 1));
      return;
    }

    const viewportWidth = scroll.current?.clientWidth || 0;
    const todayCenter = calendarLabelWidth + (now.getDate() - 0.5) * calendarDayWidth;
    scroll.current?.scrollTo({
      left: Math.max(0, todayCenter - viewportWidth / 2),
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    const id = setTimeout(scrollToday, 80);
    return () => clearTimeout(id);
  }, [y, m]);

  const toggle = id => setOpen(old => {
    const n = new Set(old);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const rows = [];
  homes.forEach(h => {
    rows.push({ kind: 'home', key: `h${h.id}`, h });
    if (open.has(h.id)) {
      const rs = rooms.filter(r => r.homestayId === h.id);
      (rs.length ? rs : [{ id: `empty${h.id}`, roomNumber: 'Chưa xếp phòng' }]).forEach(r => {
        rows.push({ kind: 'room', key: `r${r.id}`, h, r });
      });
    }
  });

  const events = row => active.filter(x => (
    x.homestayId === row.h.id
    && (row.kind === 'home'
      ? !open.has(row.h.id)
      : String(row.r.id).startsWith('empty')
        ? x.details?.every(d => !d.roomId)
        : x.details?.some(d => d.roomId === row.r.id))
  ));

  const action = async (x, target) => {
    const verb = target === 'paid' ? 'Xác nhận thanh toán' : target === 'CheckedIn' ? 'Check-in' : 'Check-out';
    const ok = await confirmDialog({
      title: `${verb} đơn ${x.bookingCode}?`,
      message: `Khách ${x.customerName} · ${x.checkInDate} → ${x.checkOutDate}`,
      confirmText: verb,
      variant: target === 'paid' ? 'warning' : 'default'
    });
    if (!ok) return;
    const result = await run(() => target === 'paid'
      ? homestayApi.confirmOfflinePayment(x.id, 'BankTransfer')
      : homestayApi.updateBookingStatus(x.id, target), false);
    if (result) {
      setSelected(null);
      toast.success(`Đã ${verb.toLowerCase()} thành công.`);
    }
  };

  return (
    <div className="booking-calendar">
      <div className="calendar-summary">
        <Stat name={`THÁNG ${m + 1}/${y}`} value={`${active.length} booking`} icon="calendar" iconColor="#0b4ae6" />
        <Stat name="TỶ LỆ LẤP ĐẦY" value={`${Math.min(100, Math.round(nights / capacity * 100))}%`} detail={`${nights}/${capacity} đêm phòng`} icon="pieChart" iconColor="#0d8244" />
        <Stat name="CHECK-IN HÔM NAY" value={items.filter(x => x.checkInDate === today && !['Cancelled', 'Expired'].includes(x.status)).length} icon="userCheck" iconColor="#0b4ae6" />
        <Stat name="CHECK-OUT HÔM NAY" value={items.filter(x => x.checkOutDate === today && !['Cancelled', 'Expired'].includes(x.status)).length} icon="clock" iconColor="#64748b" />
        <Stat name="CHỜ THANH TOÁN" value={items.filter(x => x.status === 'PendingPayment').length} icon="wallet" iconColor="#b25e00" />
      </div>

      <section className="calendar-shell">
        <header className="calendar-main-head">
          <div>
            <small>LỊCH VẬN HÀNH</small>
            <h2>Tháng {m + 1}/{y}</h2>
            <p>Mở rộng cơ sở để xem và thao tác trực tiếp trên lịch từng phòng.</p>
          </div>
          <div className="calendar-nav">
            <button onClick={() => move(-1)} aria-label="Tháng trước">
              <HostIcon name="chevronLeft" size={16} />
            </button>
            <input
              type="month"
              value={`${y}-${String(m + 1).padStart(2, '0')}`}
              onChange={e => {
                const [a, b] = e.target.value.split('-');
                setAt(new Date(+a, +b - 1, 1));
              }}
            />
            <button onClick={() => move(1)} aria-label="Tháng sau">
              <HostIcon name="chevronRight" size={16} />
            </button>
            <button className="today" onClick={scrollToday}>Hôm nay</button>
          </div>
        </header>

        <div className="calendar-filters">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm mã đơn hoặc tên khách…" />
          <select value={home} onChange={e => setHome(e.target.value)}>
            <option value="">Tất cả homestay</option>
            {homestays.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select value={city} onChange={e => setCity(e.target.value)}>
            <option value="">Tất cả thành phố</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(labels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn-jump-today" onClick={scrollToday}>Đến hôm nay</button>
        </div>

        <div className="calendar-legend">
          {Object.entries({ ...labels, Blocked: 'Đã chặn' }).map(([k, v]) => (
            <span key={k} className={k.toLowerCase()}>{v}</span>
          ))}
        </div>

        <div className="calendar-scroll" ref={scroll}>
          <div className="calendar-grid host-calendar-days" style={{ '--days': days }}>
            <b>HOMESTAY / PHÒNG</b>
            {Array.from({ length: days }, (_, i) => {
              const d = new Date(y, m, i + 1);
              return (
                <span key={i} className={`${[0, 6].includes(d.getDay()) ? 'weekend ' : ''}${current && i + 1 === now.getDate() ? 'today' : ''}`}>
                  <small>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}</small>
                  {i + 1}
                </span>
              );
            })}
          </div>

          {rows.map(row => (
            <div className={`calendar-grid calendar-row ${row.kind}`} style={{ '--days': days }} key={row.key}>
              <b>
                {row.kind === 'home' ? (
                  <button onClick={() => toggle(row.h.id)}>
                    <HostIcon name={open.has(row.h.id) ? 'chevronDown' : 'chevronRight'} size={14} />
                    <span>{row.h.name}</span>
                    <small>{row.h.district}</small>
                  </button>
                ) : (
                  <>
                    <span>↳ {row.r.roomNumber}</span>
                    <small>{row.r.roomTypeName || row.r.status}</small>
                  </>
                )}
              </b>
              {Array.from({ length: days }, (_, i) => {
                const d = new Date(y, m, i + 1);
                return (
                  <i key={i} className={`${[0, 6].includes(d.getDay()) ? 'weekend ' : ''}${current && i + 1 === now.getDate() ? 'today' : ''}`}>
                    {row.kind === 'room' && row.r.basePrice ? <small>{Math.round(row.r.basePrice / 1000)}k</small> : null}
                  </i>
                );
              })}
              {events(row).map(x => {
                const s = Math.max(1, Math.floor((new Date(x.checkInDate) - new Date(y, m, 1)) / ms) + 1);
                const e = Math.min(days + 1, Math.ceil((new Date(x.checkOutDate) - new Date(y, m, 1)) / ms) + 1);
                return (
                  <button
                    key={x.id}
                    className={`calendar-event ${x.status.toLowerCase()}`}
                    style={{ gridColumn: `${s + 1}/${Math.max(s + 2, e + 1)}` }}
                    title={`${x.bookingCode} · ${x.customerName} · ${x.checkInDate} → ${x.checkOutDate}`}
                    onClick={() => setSelected(x)}
                  >
                    {e - s < 3 ? x.customerName : `${x.bookingCode} · ${x.customerName}`}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="calendar-scroll-tools">
          <span>Kéo ngang để xem toàn bộ ngày trong tháng</span>
          <button onClick={() => scroll.current?.scrollBy({ left: -400, behavior: 'smooth' })}>
            <HostIcon name="chevronLeft" size={14} /> Cuộn trái
          </button>
          <button onClick={() => scroll.current?.scrollBy({ left: 400, behavior: 'smooth' })}>
            Cuộn phải <HostIcon name="chevronRight" size={14} />
          </button>
        </div>
      </section>

      {selected && <BookingPopup item={selected} close={() => setSelected(null)} action={action} />}
    </div>
  );
}

function BookingPopup({ item, close, action }) {
  return (
    <div className="calendar-booking-modal" onMouseDown={e => e.target === e.currentTarget && close()}>
      <section role="dialog" aria-modal="true">
        <header>
          <div>
            <small>CHI TIẾT ĐẶT PHÒNG</small>
            <h2>{item.bookingCode}</h2>
          </div>
          <button onClick={close} aria-label="Đóng">
            <HostIcon name="close" size={18} />
          </button>
        </header>
        <div>
          <h3>{item.customerName}</h3>
          <p>{item.customerPhone || 'Chưa có SĐT'} · {item.customerEmail}</p>
          <dl>
            <dt>Homestay/phòng</dt>
            <dd>{item.homestayName} · {item.details?.map(x => x.roomNumber || x.roomTypeName).join(', ')}</dd>
            <dt>Thời gian</dt>
            <dd>{item.checkInDate} → {item.checkOutDate} · {item.nights} đêm</dd>
            <dt>Số khách</dt>
            <dd>{item.adultCount + item.childCount}</dd>
            <dt>Tổng tiền</dt>
            <dd><b>{money(item.totalAmount)}</b></dd>
            <dt>Trạng thái</dt>
            <dd>{labels[item.status] || item.status}</dd>
          </dl>
        </div>
        <footer>
          {item.status === 'PendingPayment' && <button onClick={() => action(item, 'paid')}>Xác nhận thanh toán</button>}
          {item.status === 'Confirmed' && <button onClick={() => action(item, 'CheckedIn')}>Check-in</button>}
          {item.status === 'CheckedIn' && <button onClick={() => action(item, 'Completed')}>Check-out</button>}
          <button className="secondary" onClick={close}>Đóng</button>
        </footer>
      </section>
    </div>
  );
}

export function FinanceReport({ bookings, homestays }) {
  const valid = bookings.filter(x => ['Confirmed', 'Completed'].includes(x.status));
  const total = valid.reduce((s, x) => s + Number(x.totalAmount || 0), 0);
  const byStay = homestays.map(h => ({
    name: h.name,
    value: valid.filter(x => x.homestayName === h.name).reduce((s, x) => s + Number(x.totalAmount || 0), 0)
  })).sort((a, b) => b.value - a.value);
  const max = Math.max(...byStay.map(x => x.value), 1);

  return (
    <div className="finance-page">
      <div className="host-stats">
        <Stat name="DOANH THU XÁC NHẬN" value={money(total)} icon="wallet" iconColor="#0b4ae6" />
        <Stat name="ĐƠN CÓ DOANH THU" value={valid.length} icon="bookings" iconColor="#0d8244" />
        <Stat name="GIÁ TRỊ TRUNG BÌNH" value={money(valid.length ? total / valid.length : 0)} icon="dollar" iconColor="#0b4ae6" />
        <Stat name="HOMESTAY HOẠT ĐỘNG" value={homestays.filter(x => x.status === 'Approved').length} icon="home" iconColor="#b25e00" />
      </div>

      <div className="finance-layout">
        <Panel title="Tổng hợp doanh thu theo Homestay">
          <div className="revenue-table">
            {byStay.map((x, i) => (
              <div key={x.name}>
                <span>#{i + 1}</span>
                <b>{x.name}</b>
                <i><em style={{ width: `${x.value / max * 100}%` }} /></i>
                <strong>{money(x.value)}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Cơ cấu trạng thái đơn">
          <div className="status-breakdown">
            {Object.keys(labels).map(s => (
              <div key={s}>
                <span className={`status status-${s.toLowerCase()}`}>{labels[s]}</span>
                <b>{bookings.filter(x => x.status === s).length}</b>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
