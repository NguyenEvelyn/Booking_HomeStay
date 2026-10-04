import React, { useEffect, useMemo, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import HomestayImageUpload from './HomestayImageUpload.jsx';
import PolicyEditor from './PolicyEditor.jsx';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';

const tabs = [
  ['general', 'Thông tin chung'],
  ['amenities', 'Tiện ích'],
  ['images', 'Hình ảnh'],
  ['room-types', 'Loại phòng'],
  ['policies', 'Chính sách']
];
const moneyValue = value => value === '' || value == null ? '' : new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
const money = value => `${moneyValue(value)} đ`;
const digits = value => String(value ?? '').replace(/\D/g, '');
const viDate = value => { const [y, m, d] = String(value).slice(0, 10).split('-'); return y && m && d ? `${d}/${m}/${y}` : value; };
const tabFromUrl = () => new URLSearchParams(window.location.search).get('tab') || 'general';

function SaveBar({ dirty, busy, onSave, onCancel }) {
  return <div className="property-save-bar"><span>{dirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu'}</span><div><button type="button" disabled={!dirty || busy} onClick={onCancel}>Hủy</button><button type="button" disabled={!dirty || busy} onClick={onSave}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></div>;
}

function LabeledInput({ label, ...props }) {
  return <label><span>{label}</span><input {...props} /></label>;
}

export default function HostPropertyDetail({ data, amenities, back, run }) {
  const [tab, setTab] = useState(tabFromUrl);
  const [pendingTab, setPendingTab] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const pop = () => setTab(tabFromUrl());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const navigate = next => {
    if (next === tab) return;
    if (dirty) { setPendingTab(next); return; }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.pushState({}, '', url);
    setTab(next);
  };
  const leave = () => { setDirty(false); const next = pendingTab; setPendingTab(''); const url = new URL(window.location.href); url.searchParams.set('tab', next); window.history.pushState({}, '', url); setTab(next); };

  return <div className="property-detail-page">
    <div className="property-sticky-head">
      <button className="back-link" onClick={back}><HostIcon name="arrowLeft" size={14} /> Danh sách Homestay</button>
      <div className="property-heading"><div><small>HỒ SƠ NIÊM YẾT</small><h2>#{data.id} · {data.name}</h2></div><span className={`status status-${data.status.toLowerCase()}`}>{data.status === 'Approved' ? 'Đã duyệt' : data.status}</span></div>
      <nav className="property-tabs" aria-label="Chi tiết Homestay">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => navigate(key)}>{label}</button>)}</nav>
    </div>
    {pendingTab && <div className="inline-leave-warning"><span>Bạn có thay đổi chưa lưu trong tab này.</span><button onClick={() => setPendingTab('')}>Ở lại</button><button onClick={leave}>Bỏ thay đổi và chuyển tab</button></div>}
    {tab === 'general' && <GeneralTab data={data} run={run} setPageDirty={setDirty} />}
    {tab === 'amenities' && <AmenitiesTab data={data} amenities={amenities} run={run} setPageDirty={setDirty} />}
    {tab === 'images' && <ImagesTab data={data} run={run} />}
    {tab === 'room-types' && <RoomTypesTab data={data} run={run} setPageDirty={setDirty} />}
    {tab === 'policies' && <PolicyEditor homestayId={data.id} />}
  </div>;
}

function GeneralTab({ data, run, setPageDirty }) {
  const initial = () => ({ name: data.name, description: data.description, addressLine: data.addressLine, ward: data.ward || '', district: data.district, province: data.province, checkInTime: String(data.checkInTime).slice(0, 5), checkOutTime: String(data.checkOutTime).slice(0, 5) });
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial());
  useEffect(() => setPageDirty(dirty), [dirty]);
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => { setBusy(true); const result = await run(() => homestayApi.updateHomestay(data.id, form)); setBusy(false); if (result) { setPageDirty(false); toast.success('Đã lưu thông tin Homestay.'); } };
  return <section className="property-tab-card"><header><small>THÔNG TIN CHUNG</small><h3>Hồ sơ Homestay</h3><p>Các thông tin ít thay đổi và được hiển thị cho khách đặt phòng.</p></header><div className="property-tab-form"><LabeledInput label="Tên Homestay" required value={form.name} onChange={e => field('name', e.target.value)} /><LabeledInput label="Tỉnh/thành" required value={form.province} onChange={e => field('province', e.target.value)} /><label className="wide"><span>Mô tả</span><textarea rows="5" required value={form.description} onChange={e => field('description', e.target.value)} /></label><LabeledInput label="Địa chỉ" required value={form.addressLine} onChange={e => field('addressLine', e.target.value)} /><LabeledInput label="Phường/xã" value={form.ward} onChange={e => field('ward', e.target.value)} /><LabeledInput label="Quận/huyện" required value={form.district} onChange={e => field('district', e.target.value)} /><LabeledInput label="Giờ nhận phòng" type="time" required value={form.checkInTime} onChange={e => field('checkInTime', e.target.value)} /><LabeledInput label="Giờ trả phòng" type="time" required value={form.checkOutTime} onChange={e => field('checkOutTime', e.target.value)} /></div><SaveBar dirty={dirty} busy={busy} onSave={save} onCancel={() => setForm(initial())} /></section>;
}

function AmenitiesTab({ data, amenities, run, setPageDirty }) {
  const original = data.amenities.map(item => item.amenityId).sort();
  const [chosen, setChosen] = useState(original);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify([...chosen].sort()) !== JSON.stringify(original);
  useEffect(() => setPageDirty(dirty), [dirty]);
  const save = async () => { setBusy(true); const result = await run(() => homestayApi.saveAmenities(data.id, chosen)); setBusy(false); if (result) { setPageDirty(false); toast.success('Đã lưu tiện ích.'); } };
  return <section className="property-tab-card"><header><small>TIỆN ÍCH</small><h3>Tiện nghi tại Homestay</h3><p>Chọn các tiện ích khách có thể sử dụng trong thời gian lưu trú.</p></header><div className="amenity-tab-grid">{amenities.map(item => <label key={item.id}><input type="checkbox" checked={chosen.includes(item.id)} onChange={() => setChosen(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])} /><span>{item.name}</span><small>{item.category}</small></label>)}</div><SaveBar dirty={dirty} busy={busy} onSave={save} onCancel={() => setChosen(original)} /></section>;
}

function ImagesTab({ data, run }) {
  return <div className="property-images-tab"><section className="property-tab-card"><header><small>HÌNH ẢNH HIỆN CÓ</small><h3>Thư viện Homestay</h3></header><div className="property-image-gallery">{data.images.map(image => <figure key={image.id}><img src={image.url} alt={image.caption || 'Ảnh Homestay'} /><figcaption><span>{image.caption || 'Ảnh Homestay'}{image.isThumbnail && <b>Ảnh bìa</b>}</span><button onClick={async () => { const ok = await confirmDialog({ title: 'Xóa ảnh?', message: 'Ảnh sẽ bị xóa khỏi Homestay.', confirmText: 'Xóa ảnh', variant: 'danger' }); if (ok) await run(() => homestayApi.deleteImage(data.id, image.id)); }}>Xóa</button></figcaption></figure>)}</div></section><HomestayImageUpload homestayId={data.id} run={run} /></div>;
}

function RoomTypesTab({ data, run, setPageDirty }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  return <div className="room-types-workspace"><section className="property-tab-card"><header className="room-types-list-head"><div><small>LOẠI PHÒNG</small><h3>Cấu hình giá và phòng</h3><p>Mỗi loại phòng có sức chứa và giá riêng.</p></div><button onClick={() => setCreating(true)}><HostIcon name="plus" size={14} /> Thêm loại phòng</button></header><div className="room-type-table-wrap"><table className="room-type-table"><thead><tr><th>Tên loại</th><th>Giá thường / đêm</th><th>Sức chứa</th><th>Giường</th><th>Số phòng</th><th /></tr></thead><tbody>{data.roomTypes.map(type => <tr key={type.id}><td><b>{type.name}</b><small>{type.description}</small></td><td>{money(type.basePrice)}</td><td>{type.baseCapacity || 2} / {type.maxCapacity || type.maxAdults + type.maxChildren}</td><td>{type.bedType}</td><td>{type.rooms.length}</td><td><button onClick={() => setEditing(type)}>Sửa</button></td></tr>)}</tbody></table><div className="room-type-mobile-list">{data.roomTypes.map(type => <article key={type.id}><div><b>{type.name}</b><small>{type.description}</small></div><dl><dt>Giá</dt><dd>{money(type.basePrice)}</dd><dt>Sức chứa</dt><dd>{type.baseCapacity || 2} / {type.maxCapacity || type.maxAdults + type.maxChildren}</dd><dt>Giường</dt><dd>{type.bedType}</dd><dt>Số phòng</dt><dd>{type.rooms.length}</dd></dl><button onClick={() => setEditing(type)}>Sửa loại phòng</button></article>)}</div></div></section><SeasonalMatrix homestayId={data.id} roomTypes={data.roomTypes} run={run} />{(editing || creating) && <RoomTypeDrawer homestayId={data.id} data={editing} run={run} close={() => { setEditing(null); setCreating(false); setPageDirty(false); }} setPageDirty={setPageDirty} />}</div>;
}

function Counter({ label, value, min = 1, disabled, onChange, text }) {
  return <div className={`drawer-counter ${disabled ? 'disabled' : ''}`}><span>{label}</span><div><button type="button" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>−</button><b>{value}</b><button type="button" disabled={disabled} onClick={() => onChange(value + 1)}>+</button></div>{text && <small>{text}</small>}</div>;
}

function RoomTypeDrawer({ homestayId, data, run, close, setPageDirty }) {
  const initial = () => data ? { name: data.name, description: data.description, basePrice: String(data.basePrice), baseCapacity: data.baseCapacity || 2, maxCapacity: data.maxCapacity || data.baseCapacity || 2, extraGuestAllowed: Boolean(data.extraGuestAllowed), bedType: data.bedType, maxAdults: data.maxAdults, maxChildren: data.maxChildren, roomSize: data.roomSize || '' } : { name: '', description: '', basePrice: '', baseCapacity: 2, maxCapacity: 2, extraGuestAllowed: false, bedType: 'Giường đôi', maxAdults: 2, maxChildren: 0, roomSize: '' };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState({ roomNumber: '', floorNumber: '', status: 'Available', note: '' });
  const panel = useRef(null);
  const previousMax = useRef(form.maxCapacity);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial());
  useEffect(() => setPageDirty(dirty), [dirty]);
  useEffect(() => {
    const keydown = event => {
      if (event.key === 'Escape') { if (dirty) toast.warning('Hãy lưu hoặc hủy thay đổi trước khi đóng.'); else close(); }
      if (event.key === 'Tab') { const focusable = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')]; if (!focusable.length) return; const first = focusable[0], last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', keydown);
    panel.current?.querySelector('input')?.focus();
    return () => document.removeEventListener('keydown', keydown);
  }, [dirty]);
  const field = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const toggleExtra = () => setForm(current => { if (current.extraGuestAllowed) { previousMax.current = current.maxCapacity; return { ...current, extraGuestAllowed: false, maxCapacity: current.baseCapacity }; } return { ...current, extraGuestAllowed: true, maxCapacity: Math.max(current.baseCapacity, previousMax.current) }; });
  const save = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.bedType.trim() || Number(form.basePrice) <= 0) {
      toast.error('Vui lòng nhập đầy đủ tên, mô tả, loại giường và giá phòng.');
      return;
    }
    setBusy(true);
    const normalizedMaxAdults = Math.max(Number(form.maxAdults) || 1, form.maxCapacity - (Number(form.maxChildren) || 0));
    const payload = { ...data, ...form, basePrice: +form.basePrice, maxAdults: normalizedMaxAdults, maxChildren: Number(form.maxChildren) || 0, roomSize: form.roomSize ? +form.roomSize : null };
    let result;
    if (data) {
      result = await run(() => homestayApi.updateRoomType(homestayId, data.id, payload), false);
      if (result) result = await run(() => homestayApi.updateRoomCapacity(homestayId, data.id, { baseCapacity: form.baseCapacity, maxCapacity: form.maxCapacity, extraGuestAllowed: form.extraGuestAllowed, extraGuestFee: data.extraGuestFee || 0, extraChildFee: data.extraChildFee || 0, childMaxAge: data.childMaxAge ?? 11 }));
    } else result = await run(() => homestayApi.addRoomType(homestayId, payload));
    setBusy(false);
    if (result) { setPageDirty(false); toast.success(data ? 'Đã lưu loại phòng.' : 'Đã thêm loại phòng.'); close(); }
  };
  const addRoom = async event => { event.preventDefault(); const result = await run(() => homestayApi.addRoom(homestayId, data.id, { ...room, floorNumber: room.floorNumber ? +room.floorNumber : null })); if (result) { setRoom({ roomNumber: '', floorNumber: '', status: 'Available', note: '' }); toast.success('Đã đăng phòng mới.'); } };
  const rooms = data?.rooms || [];
  return <div className="room-drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && (dirty ? toast.warning('Hãy lưu hoặc hủy thay đổi trước khi đóng.') : close())}><aside className="room-type-drawer" ref={panel} role="dialog" aria-modal="true" aria-label={data ? `Sửa ${data.name}` : 'Thêm loại phòng'}><header><div><small>{data ? 'CHỈNH SỬA LOẠI PHÒNG' : 'LOẠI PHÒNG MỚI'}</small><h3>{data ? data.name : 'Thêm loại phòng'}</h3></div><button aria-label="Đóng" onClick={() => dirty ? toast.warning('Hãy lưu hoặc hủy thay đổi trước khi đóng.') : close()}><HostIcon name="close" size={18} /></button></header><div className="drawer-body"><section><h4>Thông tin & giá thường</h4><div className="drawer-form"><LabeledInput label="Tên loại phòng" required value={form.name} onChange={e => field('name', e.target.value)} /><LabeledInput label="Loại giường" required value={form.bedType} onChange={e => field('bedType', e.target.value)} /><label className="wide"><span>Mô tả</span><textarea rows="3" required value={form.description} onChange={e => field('description', e.target.value)} /></label><label className="wide"><span>Giá thường / đêm</span><div className="money-field"><input aria-label="Giá thường mỗi đêm" inputMode="numeric" required value={moneyValue(form.basePrice)} onChange={e => field('basePrice', digits(e.target.value))} /><b>đ</b></div></label></div></section><section><h4>Sức chứa</h4><div className="drawer-capacity"><Counter label="Khách tiêu chuẩn" value={form.baseCapacity} onChange={value => setForm(current => ({ ...current, baseCapacity: value, maxCapacity: current.extraGuestAllowed ? Math.max(value, current.maxCapacity) : value }))} /><Counter label="Khách tối đa" value={form.extraGuestAllowed ? form.maxCapacity : form.baseCapacity} min={form.baseCapacity} disabled={!form.extraGuestAllowed} onChange={value => field('maxCapacity', value)} /><div className="drawer-counter"><span>Giường</span><b className="bed-value">{form.bedType}</b><small>Chỉnh loại giường ở phía trên.</small></div></div><button type="button" className="extra-guest-switch" role="switch" aria-checked={form.extraGuestAllowed} onClick={toggleExtra}><i /><span><b>Cho phép khách vượt mức tiêu chuẩn</b><small>Khi tắt, tối đa bằng mức tiêu chuẩn.</small></span></button></section>{data && <section><div className="drawer-section-head"><div><h4>Danh sách phòng</h4><p>{rooms.length} phòng · trạng thái vận hành chỉ đọc tại đây.</p></div><button onClick={() => { close(); }}>Quản lý trong lịch</button></div><div className="drawer-room-list">{rooms.map(item => <div key={item.id}><span><b>Phòng {item.roomNumber}</b><small>{item.floorNumber ? `Tầng ${item.floorNumber}` : 'Chưa có tầng'}</small></span><em className={`readonly-status status-${item.status.toLowerCase()}`}>{item.status === 'Available' ? 'Còn trống' : item.status === 'Occupied' ? 'Đang có khách' : 'Tạm ngưng'}</em><p>{item.note || 'Chưa có ghi chú'}</p><button onClick={async () => { const ok = await confirmDialog({ title: `Xóa phòng ${item.roomNumber}?`, message: 'Phòng sẽ bị xóa khỏi danh sách.', confirmText: 'Xóa phòng', variant: 'danger' }); if (ok) await run(() => homestayApi.deleteRoom(homestayId, item.id)); }}>Xóa</button></div>)}</div><form className="drawer-add-room" onSubmit={addRoom}><LabeledInput label="Số/tên phòng" required value={room.roomNumber} onChange={e => setRoom({ ...room, roomNumber: e.target.value })} /><LabeledInput label="Tầng" type="number" value={room.floorNumber} onChange={e => setRoom({ ...room, floorNumber: e.target.value })} /><LabeledInput label="Ghi chú" value={room.note} onChange={e => setRoom({ ...room, note: e.target.value })} /><button><HostIcon name="plus" size={14} /> Đăng phòng</button></form></section>}</div><SaveBar dirty={dirty} busy={busy} onSave={save} onCancel={() => { setForm(initial()); setPageDirty(false); }} /></aside></div>;
}

function InlineOccasionPrice({ entry, period, roomType, homestayId, run }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry ? String(entry.pricePerNight) : '');

  useEffect(() => setValue(entry ? String(entry.pricePerNight) : ''), [entry]);

  const cancel = () => {
    setValue(entry ? String(entry.pricePerNight) : '');
    setEditing(false);
  };

  const save = async () => {
    const nextPrice = Number(value);
    if (value && (!Number.isFinite(nextPrice) || nextPrice <= 0)) {
      toast.error('Giá dịp phải lớn hơn 0.');
      return;
    }
    await run(async () => {
      if (entry) await homestayApi.deletePricePeriod(homestayId, roomType.id, entry.id);
      if (value) {
        await homestayApi.addPricePeriod(homestayId, roomType.id, {
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          pricePerNight: nextPrice
        });
      }
      return { message: 'Đã cập nhật giá dịp.' };
    });
    setEditing(false);
    toast.success('Đã cập nhật giá dịp.');
  };

  if (!editing) {
    return <button type="button" className="inline-price-button" onClick={() => setEditing(true)}>{entry ? money(entry.pricePerNight) : '—'}</button>;
  }

  return <input className="inline-price-input" autoFocus inputMode="numeric" aria-label={`Giá dịp cho ${roomType.name}`} value={moneyValue(value)} onChange={event => setValue(digits(event.target.value))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save(); } if (event.key === 'Escape') { event.preventDefault(); cancel(); } }} onBlur={cancel} />;
}

function SeasonalMatrix({ homestayId, roomTypes, run }) {
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', prices: {} });
  const [error, setError] = useState('');
  const periods = useMemo(() => {
    const map = new Map();
    roomTypes.forEach(type => (type.pricePeriods || []).forEach(period => { const key = `${period.name}|${period.startDate}|${period.endDate}`; if (!map.has(key)) map.set(key, { name: period.name, startDate: period.startDate, endDate: period.endDate, entries: {} }); map.get(key).entries[type.id] = { ...period, roomTypeId: type.id }; }));
    return [...map.values()].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  }, [roomTypes]);
  const priced = Object.values(form.prices).some(value => Number(value) > 0);
  const create = async event => { event.preventDefault(); setError(''); if (form.endDate < form.startDate) { setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'); return; } const selected = roomTypes.filter(type => Number(form.prices[type.id]) > 0); const overlaps = selected.some(type => (type.pricePeriods || []).some(period => form.startDate <= period.endDate && form.endDate >= period.startDate)); if (overlaps) { setError('Khoảng ngày bị trùng với dịp đã có của ít nhất một loại phòng.'); return; } for (const type of selected) await homestayApi.addPricePeriod(homestayId, type.id, { name: form.name, startDate: form.startDate, endDate: form.endDate, pricePerNight: +form.prices[type.id] }); await run(async () => ({ message: 'Đã tạo giá theo dịp.' })); setForm({ name: '', startDate: '', endDate: '', prices: {} }); toast.success('Đã tạo dịp cho các loại phòng đã chọn.'); };
  const remove = async period => { const ok = await confirmDialog({ title: `Xóa dịp ${period.name}?`, message: 'Giá dịp của tất cả loại phòng trong dòng này sẽ bị xóa.', confirmText: 'Xóa dịp', variant: 'danger' }); if (!ok) return; for (const entry of Object.values(period.entries)) await homestayApi.deletePricePeriod(homestayId, entry.roomTypeId, entry.id); await run(async () => ({ message: 'Đã xóa dịp.' })); toast.success('Đã xóa giá theo dịp.'); };
  return <section className="property-tab-card seasonal-matrix"><header><small>GIÁ THEO DỊP</small><h3>Tạo một dịp, nhập giá riêng từng loại phòng</h3><p>Ô giá để trống sẽ không áp dụng dịp cho loại phòng đó.</p></header><form className="occasion-form" onSubmit={create}>{error && <p className="occasion-error">{error}</p>}<div className="occasion-fields"><LabeledInput label="Tên dịp" required placeholder="Ví dụ: Lễ 30/4" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><LabeledInput label="Từ ngày" required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /><LabeledInput label="Đến ngày" required type="date" min={form.startDate || undefined} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div><div className="occasion-room-prices">{roomTypes.map(type => <label key={type.id}><span><b>{type.name}</b><small>Giá thường {money(type.basePrice)}</small></span><div className="money-field"><input aria-label={`Giá dịp cho ${type.name}`} inputMode="numeric" placeholder="Giá dịp / đêm" value={moneyValue(form.prices[type.id] || '') || ''} onChange={e => setForm({ ...form, prices: { ...form.prices, [type.id]: digits(e.target.value) } })} /><b>đ</b></div></label>)}</div><button disabled={!priced}>Tạo dịp</button></form><div className="occasion-table-wrap"><table><thead><tr><th>Dịp</th><th>Khoảng ngày</th>{roomTypes.map(type => <th key={type.id}>{type.name}</th>)}<th /></tr></thead><tbody>{periods.map(period => <tr key={`${period.name}-${period.startDate}`}><td><b>{period.name}</b></td><td>{viDate(period.startDate)} → {viDate(period.endDate)}</td>{roomTypes.map(type => <td key={type.id}><InlineOccasionPrice entry={period.entries[type.id]} period={period} roomType={type} homestayId={homestayId} run={run} /></td>)}<td><button onClick={() => remove(period)}>Xóa dịp</button></td></tr>)}</tbody></table>{!periods.length && <p>Chưa có giá theo dịp. Tạo dịp đầu tiên ở biểu mẫu phía trên.</p>}</div></section>;
}
