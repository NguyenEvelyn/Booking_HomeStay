import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL, getAccessToken } from '../../../shared/api/apiClient.js';
import { homestayApi } from '../api/homestayApi.js';
import { toast } from '../../../shared/feedback/feedback.js';
import HostIcon from './HostIcon.jsx';
import { calculateTaxSimulation, readTaxSimulation } from '../../../shared/utils/taxSimulation.js';

const money = value => `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))} đ`;
const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(Number(value) || 0);
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const viDate = value => value ? String(value).slice(0, 10).split('-').reverse().join('/') : '—';
const addDays = (date, amount) => { const next = new Date(date); next.setDate(next.getDate() + amount); return next; };

function rangeFor(preset) {
  const today = new Date();
  if (preset === 'today') return [today, today];
  if (preset === '7d') return [addDays(today, -6), today];
  if (preset === '30d') return [addDays(today, -29), today];
  if (preset === 'quarter') return [new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), today];
  if (preset === 'year') return [new Date(today.getFullYear(), 0, 1), today];
  return [new Date(today.getFullYear(), today.getMonth(), 1), today];
}

const presets = [['today', 'Hôm nay'], ['7d', '7 ngày'], ['30d', '30 ngày'], ['month', 'Tháng này'], ['quarter', 'Quý này'], ['year', 'Năm nay'], ['custom', 'Tùy chọn']];
const statusLabels = { Confirmed: 'Đã xác nhận', CheckedIn: 'Đang lưu trú', CheckedOut: 'Đã trả phòng', Completed: 'Hoàn thành', PendingPayment: 'Chờ thanh toán', CancellationRequested: 'Chờ duyệt hủy', Cancelled: 'Đã hủy', Expired: 'Hết hạn', PaymentFailed: 'Thanh toán lỗi' };
const statusColors = { Confirmed: '#2563eb', CheckedIn: '#0f766e', Completed: '#16a34a', PendingPayment: '#f59e0b', CancellationRequested: '#ea580c', Cancelled: '#dc2626', Expired: '#64748b', PaymentFailed: '#be123c' };

function Change({ data, inverse = false }) {
  if (!data) return null;
  if (data.isNew) return <span className="revenue-change new">Mới so với kỳ trước</span>;
  const change = Number(data.change || 0); const good = inverse ? change <= 0 : change >= 0;
  return <span className={`revenue-change ${good ? 'up' : 'down'}`}>{change >= 0 ? '▲' : '▼'} {number(Math.abs(change))}% so với kỳ trước</span>;
}

function Kpi({ label, data, icon, moneyValue = true, hint, inverse }) {
  return <article className="revenue-kpi">
    <div className="revenue-kpi-head"><span>{label}{hint && <button className="metric-help" title={hint} aria-label={`Giải thích ${label}`}>?</button>}</span><i><HostIcon name={icon} size={18}/></i></div>
    <strong>{moneyValue ? money(data?.value) : number(data?.value)}</strong>
    <Change data={data} inverse={inverse}/>
  </article>;
}

function Card({ eyebrow, title, action, children, className = '' }) {
  return <section className={`revenue-card ${className}`}><header><div><small>{eyebrow || 'PHÂN TÍCH VẬN HÀNH'}</small><h2>{title}</h2></div>{action}</header>{children}</section>;
}

function Skeleton() { return <div className="revenue-skeleton" aria-label="Đang tải dữ liệu"><i/><i/><i/><i/></div>; }
function Empty({ text = 'Chưa có dữ liệu trong khoảng thời gian này' }) { return <div className="revenue-empty"><HostIcon name="finance" size={28}/><strong>{text}</strong><span>Hãy chọn khoảng thời gian khác để xem báo cáo.</span></div>; }

function TrendChart({ items }) {
  if (!items?.length || !items.some(x => Number(x.revenue) > 0)) return <Empty text="Chưa có doanh thu trong khoảng thời gian này"/>;
  const width = 900, height = 250, pad = 38;
  const maxRevenue = Math.max(1, ...items.map(x => Number(x.revenue)));
  const maxBookings = Math.max(1, ...items.map(x => Number(x.bookings)));
  const step = (width - pad * 2) / Math.max(1, items.length);
  const points = items.map((x, index) => `${pad + step * index + step / 2},${height - pad - Number(x.bookings) / maxBookings * (height - pad * 2)}`).join(' ');
  return <div className="trend-chart-wrap">
    <div className="chart-legend"><span><i className="revenue-dot"/>Doanh thu</span><span><i className="booking-line"/>Số đơn</span></div>
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ doanh thu và số đơn theo thời gian" preserveAspectRatio="none">
      {[0, .25, .5, .75, 1].map(x => <line key={x} x1={pad} x2={width - pad} y1={pad + x * (height - pad * 2)} y2={pad + x * (height - pad * 2)} className="chart-gridline"/>)}
      {items.map((item, index) => { const barHeight = Number(item.revenue) / maxRevenue * (height - pad * 2); return <g key={`revenue-${item.label}-${index}`} className="chart-point"><title>{item.label}: {money(item.revenue)} · {item.bookings} đơn</title><rect x={pad + step * index + step * .18} y={height - pad - barHeight} width={Math.max(4, step * .64)} height={barHeight} rx="4"/><text x={pad + step * index + step / 2} y={height - 13} textAnchor="middle">{items.length > 16 && index % Math.ceil(items.length / 10) ? '' : item.label.slice(5)}</text></g>; })}
      <polyline points={points} className="booking-polyline"/>
      {items.map((item, index) => <circle key={`booking-${item.label}-${index}`} cx={pad + step * index + step / 2} cy={height - pad - Number(item.bookings) / maxBookings * (height - pad * 2)} r="4" className="booking-point"><title>{item.label}: {item.bookings} đơn</title></circle>)}
    </svg>
  </div>;
}

function Donut({ items }) {
  const total = items.reduce((sum, x) => sum + x.count, 0); let offset = 0;
  if (!total) return <Empty text="Chưa có đơn trong khoảng thời gian này"/>;
  return <div className="donut-wrap"><svg viewBox="0 0 42 42" role="img" aria-label={`Cơ cấu ${total} đơn`}><circle className="donut-base" cx="21" cy="21" r="15.915"/>{items.map(x => { const dash = x.count / total * 100; const el = <circle key={x.status} cx="21" cy="21" r="15.915" stroke={statusColors[x.status] || '#64748b'} strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-offset}/>; offset += dash; return el; })}<text x="21" y="20" textAnchor="middle">{total}</text><text x="21" y="25" textAnchor="middle" className="donut-sub">đơn</text></svg></div>;
}

export default function RevenueReport({ homestays = [], onOpenBookings }) {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const defaultRange = rangeFor('month');
  const [preset, setPreset] = useState(query.has('from') ? 'custom' : 'month');
  const [filters, setFilters] = useState({ from: query.get('from') || iso(defaultRange[0]), to: query.get('to') || iso(defaultRange[1]), homestay_id: query.get('homestay') || '', payment_method: query.get('payment_method') || '' });
  const [summary, setSummary] = useState(null); const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [updated, setUpdated] = useState('');
  const [grain, setGrain] = useState('day'); const [expanded, setExpanded] = useState(null); const [exporting, setExporting] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [taxRule, setTaxRule] = useState(readTaxSimulation);
  const [table, setTable] = useState({ page: 1, page_size: 10, q: '', sort: 'date_desc' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextSummary, nextTransactions] = await Promise.all([homestayApi.revenueSummary({ ...filters, grain }), homestayApi.revenueTransactions({ ...filters, ...table })]);
      setSummary(nextSummary); setTransactions(nextTransactions); setUpdated(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [filters, grain, table]);
  useEffect(() => { const timer = setTimeout(load, table.q ? 300 : 0); return () => clearTimeout(timer); }, [load, table.q]);
  useEffect(() => { const refreshTaxRule = () => setTaxRule(readTaxSimulation()); window.addEventListener('storage', refreshTaxRule); window.addEventListener('tripio:tax-simulation-changed', refreshTaxRule); return () => { window.removeEventListener('storage', refreshTaxRule); window.removeEventListener('tripio:tax-simulation-changed', refreshTaxRule); }; }, []);
  useEffect(() => { const url = new URL(window.location.href); url.searchParams.set('from', filters.from); url.searchParams.set('to', filters.to); filters.homestay_id ? url.searchParams.set('homestay', filters.homestay_id) : url.searchParams.delete('homestay'); filters.payment_method ? url.searchParams.set('payment_method', filters.payment_method) : url.searchParams.delete('payment_method'); window.history.replaceState({}, '', url); }, [filters]);

  const choosePreset = key => { setPreset(key); if (key !== 'custom') { const [from, to] = rangeFor(key); setFilters(old => ({ ...old, from: iso(from), to: iso(to) })); setTable(old => ({ ...old, page: 1 })); } };
  const reset = () => { const [from, to] = rangeFor('month'); setPreset('month'); setFilters({ from: iso(from), to: iso(to), homestay_id: '', payment_method: '' }); setTable({ page: 1, page_size: 10, q: '', sort: 'date_desc' }); };
  const exportReport = async format => {
    setExporting(format);
    try { const params = new URLSearchParams({ ...filters, format }); const token = getAccessToken(); const response = await fetch(`${API_URL}/partner/revenue/export?${params}`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} }); if (!response.ok) throw new Error('Không thể xuất báo cáo.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bao-cao-doanh-thu_${filters.from}_${filters.to}.${format}`; a.click(); URL.revokeObjectURL(url); toast.success(`Đã xuất báo cáo ${format.toUpperCase()}.`); } catch (e) { toast.error(e.message); } finally { setExporting(''); }
  };
  const openStatus = status => { const url = new URL(window.location.href); url.searchParams.set('booking_status', status); url.searchParams.set('booking_from', filters.from); url.searchParams.set('booking_to', filters.to); window.history.replaceState({}, '', url); onOpenBookings?.(); };
  const k = summary?.kpis || {};
  const taxPreview = calculateTaxSimulation(k.confirmedRevenue?.value, taxRule);

  return <div className="finance-page revenue-dashboard">
    <div className="revenue-toolbar"><div><small>PHÂN TÍCH VẬN HÀNH</small><h2>Tổng quan tài chính</h2><p>Theo dõi doanh thu, hiệu suất lưu trú và đối soát giao dịch trong một báo cáo.</p></div><div className="revenue-toolbar-actions"><span className="updated-at">Cập nhật lúc {updated || '—'}</span><button className="refresh-button" onClick={load} disabled={loading}><HostIcon name="clock" size={16}/> Làm mới</button><details className="export-menu"><summary><HostIcon name="download" size={16}/>{exporting ? 'Đang xuất…' : 'Xuất báo cáo'}</summary><div>{['csv', 'xlsx', 'pdf'].map(x => <button key={x} disabled={!!exporting} onClick={() => exportReport(x)}>{x === 'csv' ? 'CSV' : x === 'xlsx' ? 'Excel (.xlsx)' : 'PDF'}</button>)}</div></details></div></div>
    <button hidden type="button" className="mobile-filter-trigger" onClick={() => setFilterOpen(true)} aria-expanded={filterOpen} aria-controls="revenue-mobile-filters"><HostIcon name="filter" size={17}/><span>Bộ lọc</span></button>
    {filterOpen && <button hidden type="button" className="mobile-filter-scrim" aria-label="Đóng bộ lọc" onClick={() => setFilterOpen(false)}/>}
    <section id="revenue-mobile-filters" className={`revenue-filter-card mobile-filter-sheet ${filterOpen ? 'mobile-open' : ''}`}>
      <div hidden className="mobile-filter-heading"><div><small>BỘ LỌC</small><b>Khoảng thời gian và phạm vi</b></div><button type="button" onClick={() => setFilterOpen(false)} aria-label="Đóng bộ lọc"><HostIcon name="close" size={18}/></button></div>
      <div className="preset-control" role="group" aria-label="Khoảng thời gian">{presets.map(([key, label]) => <button key={key} className={preset === key ? 'active' : ''} aria-pressed={preset === key} onClick={() => choosePreset(key)}>{label}</button>)}</div>
      <div className="revenue-filter-fields">{preset === 'custom' && <><label><span>Từ ngày</span><input type="date" value={filters.from} max={filters.to} onChange={e => setFilters(old => ({ ...old, from: e.target.value }))}/></label><label><span>Đến ngày</span><input type="date" value={filters.to} min={filters.from} onChange={e => setFilters(old => ({ ...old, to: e.target.value }))}/></label></>}<label><span>Homestay</span><select value={filters.homestay_id} onChange={e => setFilters(old => ({ ...old, homestay_id: e.target.value }))}><option value="">Tất cả homestay</option>{homestays.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label><span>Phương thức</span><select value={filters.payment_method} onChange={e => setFilters(old => ({ ...old, payment_method: e.target.value }))}><option value="">Tất cả</option><option value="Deposit">Cọc</option><option value="FullPayment">Thanh toán đủ</option></select></label><button className="reset-filter" onClick={reset}>Đặt lại</button></div>
      <p>Dữ liệu từ <b>{viDate(filters.from)}</b> đến <b>{viDate(filters.to)}</b></p>
    </section>
    {error && <div className="revenue-error" role="alert"><span>{error}</span><button onClick={load}>Thử lại</button></div>}
    {loading && !summary ? <Skeleton/> : <>
      <section hidden className="mobile-finance-picture" aria-labelledby="mobile-finance-title">
        <header className="mobile-finance-picture-head"><div><small>TỔNG QUAN TÀI CHÍNH</small><h2 id="mobile-finance-title">Bức tranh doanh thu</h2></div><button type="button" onClick={() => setFilterOpen(true)}><HostIcon name="calendar" size={17}/><span>{viDate(filters.from)} – {viDate(filters.to)}</span></button></header>
        <div className="mobile-finance-primary"><article><span><HostIcon name="wallet" size={17}/>Đã xác nhận</span><strong>{money(k.confirmedRevenue?.value)}</strong><Change data={k.confirmedRevenue}/></article><article><span><HostIcon name="trendingUp" size={17}/>Dự kiến</span><strong>{money(k.expectedRevenue?.value)}</strong><Change data={k.expectedRevenue}/></article></div>
        <div className="mobile-finance-insight"><i><HostIcon name="finance" size={19}/></i><span><b>Doanh thu ròng {money(k.netRevenue?.value)}</b><small>Sau hoàn tiền và phí nền tảng</small></span></div>
        <div className="mobile-finance-mini-grid"><article><i className="is-blue"><HostIcon name="bookings" size={18}/></i><span><small>Đơn có doanh thu</small><strong>{number(k.revenueBookings?.value)}</strong></span></article><article><i className="is-violet"><HostIcon name="dollar" size={18}/></i><span><small>Giá trị trung bình</small><strong>{money(k.averageValue?.value)}</strong></span></article><article><i className="is-green"><HostIcon name="checkCircle" size={18}/></i><span><small>Cọc đã thu</small><strong>{money(k.depositCollected?.value)}</strong></span></article><article><i className="is-amber"><HostIcon name="home" size={18}/></i><span><small>Homestay hoạt động</small><strong>{number(k.activeHomestays?.value)}</strong></span></article></div>
        <footer><span>Cập nhật lúc {updated || '—'}</span><button type="button" onClick={load} disabled={loading}><HostIcon name="clock" size={16}/>Làm mới</button><details className="mobile-finance-export"><summary><HostIcon name="download" size={16}/>Xuất</summary><div>{['csv', 'xlsx', 'pdf'].map(x => <button key={x} disabled={!!exporting} onClick={() => exportReport(x)}>{x === 'csv' ? 'CSV' : x === 'xlsx' ? 'Excel' : 'PDF'}</button>)}</div></details></footer>
      </section>
      <div className="revenue-kpi-grid"><Kpi label="DOANH THU XÁC NHẬN" data={k.confirmedRevenue} icon="wallet"/><Kpi label="ĐƠN CÓ DOANH THU" data={k.revenueBookings} icon="bookings" moneyValue={false}/><Kpi label="GIÁ TRỊ TRUNG BÌNH" data={k.averageValue} icon="dollar"/><Kpi label="HOMESTAY HOẠT ĐỘNG" data={k.activeHomestays} icon="home" moneyValue={false}/><Kpi label="DOANH THU DỰ KIẾN" data={k.expectedRevenue} icon="trendingUp"/><Kpi label="CỌC ĐÃ THU / CÒN THU" data={{ ...k.depositCollected, value: k.depositCollected?.value }} icon="checkCircle" hint={`Còn phải thu: ${money(k.depositOutstanding?.value)}`}/><Kpi label="TIỀN HOÀN DO HỦY" data={k.refunds} icon="trendingDown" inverse/><Kpi label="DOANH THU RÒNG" data={k.netRevenue} icon="finance" hint="Doanh thu ròng = tiền thực thu − tiền hoàn − phí nền tảng."/>{Number(k.platformVoucherSubsidy?.value)>0&&<Kpi label="TRIPIO BÙ VOUCHER" data={k.platformVoucherSubsidy} icon="wallet" hint="Khoản giảm giá từ voucher do Tripio chịu; Tripio thanh toán lại cho bạn khi đối soát."/>}</div>
      <Card eyebrow="ĐỐI SOÁT THUẾ MÔ PHỎNG" title="Ước tính khấu trừ cho Host cá nhân" className="revenue-wide tax-host-summary" action={<span className="tax-host-version">{taxRule.version}</span>}>
        <div className="tax-host-note" role="note"><HostIcon name="checkCircle" size={17}/><span>Số liệu minh họa theo cấu hình Admin, không phải chứng từ kê khai thuế thực tế.</span></div>
        <div className="tax-host-grid">
          <article><small>DOANH THU GỘP</small><strong>{money(taxPreview.grossRevenue)}</strong><span>Trước phí và khấu trừ</span></article>
          <article><small>PHÍ TRIPIO + VAT</small><strong>− {money(taxPreview.platformFeeGross)}</strong><span>{taxRule.platformFeeRate}% phí + VAT phí</span></article>
          <article><small>VAT HOST</small><strong>− {money(taxPreview.hostVatWithheld)}</strong><span>Mô phỏng {taxRule.residentIndividualVatRate}%</span></article>
          <article><small>TNCN HOST</small><strong>− {money(taxPreview.hostPitWithheld)}</strong><span>Mô phỏng {taxRule.residentIndividualPitRate}%</span></article>
          <article className="tax-host-net"><small>THỰC NHẬN ƯỚC TÍNH</small><strong>{money(taxPreview.hostNetPayout)}</strong><span>Sau phí và thuế mô phỏng</span></article>
        </div>
      </Card>
      <Card title="Xu hướng doanh thu" className="revenue-wide" action={<div className="grain-toggle">{[['day','Ngày'],['week','Tuần'],['month','Tháng']].map(([x,l]) => <button key={x} className={grain === x ? 'active' : ''} onClick={() => setGrain(x)}>{l}</button>)}</div>}><TrendChart items={summary?.timeseries || []}/></Card>
      <Card title="Chỉ số vận hành lưu trú" className="revenue-wide"><div className="operation-metrics">{[['Tỷ lệ lấp đầy', `${number(summary?.occupancyMetrics?.occupancyRate)}%`, 'Số đêm đã bán chia cho tổng số đêm phòng khả dụng.'], ['ADR', money(summary?.occupancyMetrics?.adr), 'Doanh thu phòng trung bình trên mỗi đêm đã bán.'], ['RevPAR', money(summary?.occupancyMetrics?.revpar), 'Doanh thu phòng trung bình trên mỗi đêm phòng khả dụng.'], ['LOS trung bình', `${number(summary?.occupancyMetrics?.averageLos)} đêm`, 'Số đêm lưu trú trung bình của mỗi đơn.'], ['Lead time', `${number(summary?.occupancyMetrics?.averageLeadTime)} ngày`, 'Số ngày trung bình từ lúc đặt đến ngày nhận phòng.']].map(([label,value,hint]) => <article key={label}><span>{label}<button className="metric-help" title={hint} aria-label={`Giải thích ${label}`}>?</button></span><strong>{value}</strong></article>)}</div></Card>
      <div className="revenue-two-column"><Card title="Xếp hạng doanh thu theo Homestay"><div className="ranking-table"><div className="ranking-head"><span>Homestay</span><span>Số đơn</span><span>Lấp đầy</span><span>ADR</span><span>Doanh thu</span></div>{summary?.homestayRanking?.map((x, i) => <React.Fragment key={x.id}><button className={`ranking-row ${!x.revenue ? 'zero' : ''}`} onClick={() => setExpanded(expanded === x.id ? null : x.id)} aria-expanded={expanded === x.id}><span><b>#{i + 1} {x.name}</b><i><em style={{ width: `${x.relative}%` }}/></i><small>{x.revenue ? `${number(x.contribution)}% đóng góp · Bấm để xem từng phòng` : 'Chưa có đơn · Bấm để xem từng phòng'}</small></span><span>{x.bookings}</span><span>{number(x.occupancyRate)}%</span><span>{money(x.adr)}</span><strong>{x.revenue ? money(x.revenue) : 'Chưa có đơn'}</strong></button>{expanded === x.id && <div className="room-drilldown"><div className="room-drilldown-head"><span>Phòng / loại phòng</span><small>Đêm bán</small><small>Lấp đầy</small><small>ADR</small><b>Doanh thu</b></div>{x.rooms?.length ? x.rooms.map(room => <div key={room.roomId}><span><b>Phòng {room.room}</b><small>{room.roomType}</small></span><small>{room.soldNights}/{room.capacityNights}</small><small>{number(room.occupancyRate)}%</small><small>{money(room.adr)}</small><b>{money(room.revenue)}</b></div>) : <span>Homestay chưa khai báo phòng.</span>}</div>}</React.Fragment>)}{!summary?.homestayRanking?.length && <Empty/>}</div></Card>
      <Card title="Cơ cấu trạng thái đơn"><Donut items={summary?.statusBreakdown || []}/><div className="status-highlight"><article><span>Tỷ lệ hủy</span><strong>{number(summary?.cancellationRate)}%</strong></article><article><span>Tỷ lệ hoàn thành</span><strong>{number(summary?.completionRate)}%</strong></article></div><div className="status-breakdown improved">{summary?.statusBreakdown?.map(x => <button key={x.status} onClick={() => openStatus(x.status)}><span><i style={{ background: statusColors[x.status] || '#64748b' }}/>{statusLabels[x.status] || x.status}</span><b>{x.count} · {number(x.percentage)}%</b></button>)}</div></Card></div>
      <Card eyebrow="CHI TIẾT THEO TÀI SẢN" title="Doanh thu và hiệu suất từng phòng" className="revenue-wide" action={<span className="room-report-period">{viDate(filters.from)} – {viDate(filters.to)}</span>}>
        <div className="revenue-alert-strip"><article><span>Phòng chưa có doanh thu</span><strong>{number(summary?.revenueAlerts?.roomsWithoutRevenue)}</strong></article><article><span>Phòng lấp đầy dưới 30%</span><strong>{number(summary?.revenueAlerts?.lowOccupancyRooms)}</strong></article><article><span>Cọc còn phải thu</span><strong>{money(summary?.revenueAlerts?.depositOutstanding)}</strong></article><article><span>Tiền đã hoàn</span><strong>{money(summary?.revenueAlerts?.refunds)}</strong></article></div>
        <div className="room-performance-wrap"><table className="room-performance-table"><thead><tr><th>Homestay</th><th>Phòng</th><th>Loại phòng</th><th>Đơn</th><th>Đêm bán / khả dụng</th><th>Lấp đầy</th><th>ADR</th><th>RevPAR</th><th>Hoàn tiền</th><th>Doanh thu</th></tr></thead><tbody>{summary?.roomPerformance?.map(room => <tr key={room.roomId} className={!room.revenue ? 'zero-revenue' : ''}><td><b>{room.homestay}</b></td><td><strong>Phòng {room.room}</strong><small>{room.status === 'Maintenance' ? 'Đang bảo trì' : room.status === 'Inactive' ? 'Ngừng hoạt động' : 'Đang kinh doanh'}</small></td><td>{room.roomType}</td><td>{room.bookings}</td><td>{room.soldNights} / {room.capacityNights}</td><td><span className={`occupancy-pill ${room.occupancyRate < 30 ? 'low' : room.occupancyRate >= 70 ? 'high' : ''}`}>{number(room.occupancyRate)}%</span></td><td>{money(room.adr)}</td><td>{money(room.revpar)}</td><td>{money(room.refunds)}</td><td><b>{money(room.revenue)}</b></td></tr>)}</tbody></table>{!summary?.roomPerformance?.length && <Empty text="Chưa có phòng để lập báo cáo"/>}</div>
        <p className="room-report-note">Doanh thu và hoàn tiền của đơn có nhiều phòng được phân bổ theo tỷ trọng giá trị từng phòng. Phòng bảo trì hoặc ngừng hoạt động không tính vào đêm khả dụng.</p>
      </Card>
      <Card title="Đối soát giao dịch" className="revenue-wide" action={<div className="transaction-actions"><label><HostIcon name="search" size={15}/><input value={table.q} onChange={e => setTable(old => ({ ...old, q: e.target.value, page: 1 }))} placeholder="Mã đơn hoặc tên khách" aria-label="Tìm giao dịch"/></label><select value={table.page_size} onChange={e => setTable(old => ({ ...old, page_size: +e.target.value, page: 1 }))} aria-label="Số dòng mỗi trang"><option value="10">10 dòng</option><option value="20">20 dòng</option><option value="50">50 dòng</option></select></div>}><div className="transaction-table-wrap"><table className="transaction-table"><thead><tr><th>Mã đơn</th><th>Khách</th><th>Homestay / Phòng</th><th><button onClick={() => setTable(old => ({ ...old, sort: old.sort === 'date_desc' ? 'date_asc' : 'date_desc' }))}>Ngày thanh toán ↕</button></th><th>Phương thức</th><th><button onClick={() => setTable(old => ({ ...old, sort: old.sort === 'amount_desc' ? 'amount_asc' : 'amount_desc' }))}>Số tiền ↕</button></th><th>Phí nền tảng</th><th>Thực nhận</th><th>Trạng thái</th></tr></thead><tbody>{transactions?.items?.map(x => <tr key={x.id}><td><b>{x.bookingCode}</b></td><td>{x.customer}</td><td>{x.homestay}<small>{x.room}</small></td><td>{new Date(x.paidAt).toLocaleString('vi-VN')}</td><td>{x.method}</td><td>{money(x.amount)}</td><td>{money(x.platformFee)}</td><td><strong>{money(x.netAmount)}</strong></td><td><span className={`transaction-status ${String(x.status).toLowerCase()}`}>{x.status === 'Refunded' ? 'Đã hoàn' : x.status === 'Deposited' ? 'Đã cọc' : x.status === 'Paid' ? 'Đã thanh toán' : 'Còn nợ'}</span></td></tr>)}</tbody><tfoot><tr><td colSpan="5">Tổng cộng ({transactions?.total || 0} giao dịch)</td><td>{money(transactions?.totals?.amount)}</td><td>{money(transactions?.totals?.fees)}</td><td>{money(transactions?.totals?.netAmount)}</td><td/></tr></tfoot></table>{!transactions?.items?.length && <Empty text="Chưa có giao dịch phù hợp"/>}</div><div className="table-pagination"><span>Trang {transactions?.page || 1}/{transactions?.totalPages || 1}</span><button disabled={(transactions?.page || 1) <= 1} onClick={() => setTable(old => ({ ...old, page: old.page - 1 }))}>Trước</button><button disabled={(transactions?.page || 1) >= (transactions?.totalPages || 1)} onClick={() => setTable(old => ({ ...old, page: old.page + 1 }))}>Sau</button></div></Card>
    </>}
  </div>;
}
