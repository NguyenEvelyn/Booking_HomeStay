import React, { useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { money } from './hostBookingUtils.js';

const isoDate = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const localInput = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

// Creates a last-minute deal. Used from the deals page (pick a room type) and right after a no-show
// (`suggestion` pre-fills the released room type and nights). Limits are enforced again by the server.
export default function HostDealModal({ roomTypes = [], suggestion = null, close, created }) {
  const [form, setForm] = useState(() => ({
    roomTypeId: suggestion?.roomTypeId ?? roomTypes[0]?.id ?? '',
    startDate: suggestion?.startDate ?? isoDate(0),
    endDate: suggestion?.endDate ?? isoDate(1),
    discountPercent: suggestion?.discountPercent ?? 30,
    roomsLimit: suggestion?.roomsLimit ?? 1,
    saleEndsAt: suggestion?.saleEndsAt ? localInput(suggestion.saleEndsAt) : '',
    allowVoucher: false
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const selected = roomTypes.find(x => String(x.id) === String(form.roomTypeId));

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await homestayApi.createDeal({
        roomTypeId: Number(form.roomTypeId), startDate: form.startDate, endDate: form.endDate,
        discountPercent: Number(form.discountPercent), roomsLimit: Number(form.roomsLimit),
        saleEndsAt: form.saleEndsAt ? new Date(form.saleEndsAt).toISOString() : null,
        allowVoucher: form.allowVoucher, sourceBookingId: suggestion?.sourceBookingId ?? null
      });
      created(res);
    } catch (err) {
      setError(err.message || 'Không tạo được deal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <form className="op-modal-container" style={{ maxWidth: '600px' }} onSubmit={submit}>
        <header className="op-modal-header">
          <h3><HostIcon name="tag" size={18} /> {suggestion ? 'Bán phòng vừa trống — deal phút chót' : 'Tạo deal phút chót'}</h3>
          <button type="button" className="booking-modal-close" onClick={close}><HostIcon name="close" size={18} /></button>
        </header>
        <div className="op-modal-body">
          <div className="timing-message-alert info" style={{ marginBottom: '14px' }}>
            Deal áp dụng cho đêm từ hôm nay đến 3 ngày tới (tối đa 3 đêm), giảm 5–70%. Khách đặt bằng deal <b>không được hoàn tiền khi hủy</b>; deal không cộng dồn với khuyến mãi tự động.
          </div>
          {suggestion
            ? <p>Phòng từ đơn không đến · {form.startDate} → {form.endDate}</p>
            : <div className="field-group"><label>Loại phòng</label>
                <select className="form-input" required value={form.roomTypeId} onChange={e => change('roomTypeId', e.target.value)}>
                  {roomTypes.map(x => <option key={x.id} value={x.id}>{x.homestayName} · {x.name}</option>)}
                </select></div>}
          {!suggestion && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field-group"><label>Từ đêm</label><input className="form-input" type="date" required min={isoDate(0)} max={isoDate(3)} value={form.startDate} onChange={e => change('startDate', e.target.value)} /></div>
            <div className="field-group"><label>Đến ngày (trả phòng)</label><input className="form-input" type="date" required value={form.endDate} onChange={e => change('endDate', e.target.value)} /></div>
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="field-group"><label>Giảm (%)</label><input className="form-input" type="number" min="5" max="70" required value={form.discountPercent} onChange={e => change('discountPercent', e.target.value)} />
              {selected && <small>Giá cơ bản {money(selected.basePrice)} → khoảng {money(Math.round(selected.basePrice * (100 - Number(form.discountPercent || 0)) / 100))}/đêm</small>}</div>
            <div className="field-group"><label>Số phòng bán deal</label><input className="form-input" type="number" min="1" max="20" required value={form.roomsLimit} onChange={e => change('roomsLimit', e.target.value)} /></div>
          </div>
          <div className="field-group"><label>Ngừng bán lúc (để trống = 22:00 đêm đầu)</label><input className="form-input" type="datetime-local" value={form.saleEndsAt} onChange={e => change('saleEndsAt', e.target.value)} /></div>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><input type="checkbox" checked={form.allowVoucher} onChange={e => change('allowVoucher', e.target.checked)} /> Cho phép khách dùng thêm voucher trên giá deal</label>
          {error && <div className="timing-message-alert error" style={{ marginTop: '12px' }}>{error}</div>}
        </div>
        <footer className="op-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={close}>{suggestion ? 'Để sau' : 'Hủy'}</button>
          <button className="btn-modal-submit" disabled={saving || !form.roomTypeId}>{saving ? 'Đang mở bán…' : 'Mở bán deal'}</button>
        </footer>
      </form>
    </div>
  );
}
