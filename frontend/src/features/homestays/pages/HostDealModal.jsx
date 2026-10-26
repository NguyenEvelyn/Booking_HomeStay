import React, { useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { money } from './hostBookingUtils.js';
import { toast } from '../../../shared/feedback/feedback.js';
import './HostDealModal.css';

// Limits mirror DealRules on the server (which re-validates everything).
const MAX_DAYS_AHEAD = 3;
const MAX_NIGHTS = 3;
const MIN_PERCENT = 5;
const MAX_PERCENT = 70;
const PERCENT_PRESETS = [10, 20, 30, 40, 50];

const isoDate = (offset, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (iso, days) => isoDate(days, new Date(`${iso}T00:00:00`));
const nightsBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
const dayLabel = (iso) => new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(`${iso}T00:00:00`));
const timeOf = (value) => { const d = new Date(value); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const START_LABELS = ['Hôm nay', 'Ngày mai', 'Ngày kia', 'Sau 3 ngày'];

// Creates a last-minute deal. Used from the deals page (pick a room type) and right after a no-show
// (`suggestion` pre-fills the released room type and nights). Limits are enforced again by the server.
export default function HostDealModal({ roomTypes = [], suggestion = null, close, created }) {
  const today = isoDate(0);
  const [form, setForm] = useState(() => ({
    roomTypeId: suggestion?.roomTypeId ?? roomTypes[0]?.id ?? '',
    startDate: suggestion?.startDate ?? today,
    nights: suggestion ? Math.min(MAX_NIGHTS, Math.max(1, nightsBetween(suggestion.startDate, suggestion.endDate))) : 1,
    discountPercent: suggestion?.discountPercent ?? 30,
    roomsLimit: suggestion?.roomsLimit ?? 1,
    customEnd: Boolean(suggestion?.saleEndsAt),
    saleEndTime: suggestion?.saleEndsAt ? timeOf(suggestion.saleEndsAt) : '20:00',
    allowVoucher: false
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => { setError(''); setForm((current) => ({ ...current, [key]: value })); };

  const groups = useMemo(() => {
    const map = new Map();
    roomTypes.forEach((type) => { if (!map.has(type.homestayName)) map.set(type.homestayName, []); map.get(type.homestayName).push(type); });
    return [...map.entries()];
  }, [roomTypes]);
  const selected = roomTypes.find((type) => String(type.id) === String(form.roomTypeId));
  const maxRooms = Math.max(1, Math.min(20, selected?.roomCount || suggestion?.roomsLimit || 20));
  const endDate = addDays(form.startDate, form.nights);
  const percent = Number(form.discountPercent) || 0;
  const dealPrice = selected ? Math.round(selected.basePrice * (100 - percent) / 100) : null;
  const lateEvening = new Date().getHours() >= 22;
  const defaultEnd = form.startDate === today && lateEvening ? '23:59' : '22:00';
  const saleEndText = `${form.customEnd ? form.saleEndTime : defaultEnd} ${dayLabel(form.startDate)}`;

  const problem = () => {
    if (!form.roomTypeId) return 'Hãy chọn loại phòng.';
    if (percent < MIN_PERCENT || percent > MAX_PERCENT) return `Mức giảm phải từ ${MIN_PERCENT}% đến ${MAX_PERCENT}%.`;
    if (form.roomsLimit < 1 || form.roomsLimit > maxRooms) return `Số phòng bán deal từ 1 đến ${maxRooms}.`;
    if (form.customEnd) {
      if (!form.saleEndTime) return 'Hãy chọn giờ ngừng bán.';
      if (new Date(`${form.startDate}T${form.saleEndTime}:00`) <= new Date()) return 'Giờ ngừng bán phải ở tương lai.';
    }
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    const issue = problem();
    if (issue) { setError(issue); return; }
    setSaving(true);
    setError('');
    try {
      const result = await homestayApi.createDeal({
        roomTypeId: Number(form.roomTypeId), startDate: form.startDate, endDate,
        discountPercent: percent, roomsLimit: Number(form.roomsLimit),
        saleEndsAt: form.customEnd ? new Date(`${form.startDate}T${form.saleEndTime}:00`).toISOString() : null,
        allowVoucher: form.allowVoucher, sourceBookingId: suggestion?.sourceBookingId ?? null
      });
      created(result);
    } catch (err) {
      const message = err.message || 'Không tạo được deal.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="op-modal-container deal-modal" onSubmit={submit} noValidate>
        <header className="op-modal-header">
          <h3><HostIcon name="tag" size={18} /> {suggestion ? 'Bán lại phòng vừa trống' : 'Tạo deal phút chót'}</h3>
          <button type="button" className="booking-modal-close" onClick={close} aria-label="Đóng"><HostIcon name="close" size={18} /></button>
        </header>

        <div className="op-modal-body deal-modal-body">
          <ul className="deal-rules">
            <li><b>0–3 ngày tới</b>, tối đa 3 đêm</li>
            <li>Giảm <b>5–70%</b></li>
            <li>Khách đặt deal <b>không được hoàn tiền</b></li>
            <li>Không cộng dồn khuyến mãi tự động</li>
          </ul>

          <section className="deal-step">
            <h4><span>1</span> Phòng bán deal</h4>
            {suggestion
              ? <p className="deal-fixed">Phòng vừa được giải phóng từ đơn không đến.</p>
              : <select className="form-input" value={form.roomTypeId} onChange={(event) => change('roomTypeId', event.target.value)}>
                  {groups.map(([homestay, types]) => <optgroup key={homestay} label={homestay}>
                    {types.map((type) => <option key={type.id} value={type.id}>{type.name} · {money(type.basePrice)}/đêm{type.roomCount ? ` · ${type.roomCount} phòng` : ''}</option>)}
                  </optgroup>)}
                </select>}
          </section>

          <section className="deal-step">
            <h4><span>2</span> Đêm áp dụng</h4>
            {!suggestion && <div className="deal-chips" role="group" aria-label="Bắt đầu từ đêm">
              {START_LABELS.map((label, offset) => {
                const value = isoDate(offset);
                return <button type="button" key={value} className={form.startDate === value ? 'active' : ''} onClick={() => change('startDate', value)}>
                  <b>{label}</b><small>{dayLabel(value)}</small>
                </button>;
              }).slice(0, MAX_DAYS_AHEAD + 1)}
            </div>}
            <div className="deal-nights">
              <span>Số đêm</span>
              <div className="deal-segment" role="group" aria-label="Số đêm">
                {[1, 2, 3].map((n) => <button type="button" key={n} className={form.nights === n ? 'active' : ''} onClick={() => change('nights', n)}>{n} đêm</button>)}
              </div>
            </div>
            <p className="deal-hint">Nhận phòng <b>{dayLabel(form.startDate)}</b> → trả phòng <b>{dayLabel(endDate)}</b></p>
          </section>

          <section className="deal-step">
            <h4><span>3</span> Mức giảm & số phòng</h4>
            <div className="deal-chips compact" role="group" aria-label="Mức giảm nhanh">
              {PERCENT_PRESETS.map((value) => <button type="button" key={value} className={percent === value ? 'active' : ''} onClick={() => change('discountPercent', value)}>−{value}%</button>)}
            </div>
            <div className="deal-grid">
              <label>Mức giảm (%)
                <input className="form-input" type="number" min={MIN_PERCENT} max={MAX_PERCENT} value={form.discountPercent} onChange={(event) => change('discountPercent', event.target.value)} />
              </label>
              <label>Số phòng bán deal
                <div className="deal-stepper">
                  <button type="button" disabled={form.roomsLimit <= 1} onClick={() => change('roomsLimit', form.roomsLimit - 1)} aria-label="Giảm số phòng">−</button>
                  <output>{form.roomsLimit}</output>
                  <button type="button" disabled={form.roomsLimit >= maxRooms} onClick={() => change('roomsLimit', form.roomsLimit + 1)} aria-label="Tăng số phòng">+</button>
                </div>
              </label>
            </div>
            {selected && <div className="deal-price-preview">
              <s>{money(selected.basePrice)}</s>
              <strong>{money(dealPrice)}<small>/đêm</small></strong>
              <em>Khách tiết kiệm {money(selected.basePrice - dealPrice)}/đêm</em>
            </div>}
            {selected && <p className="deal-hint">Tính trên giá niêm yết; ngày cuối tuần/lễ có phụ thu thì giá deal cũng tăng theo.</p>}
          </section>

          <section className="deal-step">
            <h4><span>4</span> Ngừng bán</h4>
            <div className="deal-segment wide" role="group" aria-label="Thời điểm ngừng bán">
              <button type="button" className={!form.customEnd ? 'active' : ''} onClick={() => change('customEnd', false)}>Mặc định · {defaultEnd}</button>
              <button type="button" className={form.customEnd ? 'active' : ''} onClick={() => change('customEnd', true)}>Chọn giờ khác</button>
            </div>
            {form.customEnd && <label className="deal-time">Giờ ngừng bán (trong {dayLabel(form.startDate)})
              <input className="form-input" type="time" value={form.saleEndTime} onChange={(event) => change('saleEndTime', event.target.value)} />
            </label>}
            <label className="deal-toggle">
              <input type="checkbox" checked={form.allowVoucher} onChange={(event) => change('allowVoucher', event.target.checked)} />
              <span><b>Cho dùng thêm voucher</b><small>Khách được giảm tiếp bằng voucher trên giá deal</small></span>
            </label>
          </section>

          <div className="deal-summary" aria-live="polite">
            Bán <b>{form.roomsLimit} phòng {selected?.name || ''}</b> giảm <b>{percent}%</b>{dealPrice != null && <> (≈ {money(dealPrice)}/đêm)</>} cho <b>{form.nights} đêm</b> từ {dayLabel(form.startDate)}, ngừng bán lúc <b>{saleEndText}</b>. Deal hiện ngay trên trang chủ và trang homestay.
          </div>
          {error && <div className="timing-message-alert error deal-error" role="alert">{error}</div>}
        </div>

        <footer className="op-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={close}>{suggestion ? 'Để sau' : 'Hủy'}</button>
          <button className="btn-modal-submit" disabled={saving || !form.roomTypeId}>{saving ? 'Đang mở bán…' : 'Mở bán deal'}</button>
        </footer>
      </form>
    </div>
  );
}
