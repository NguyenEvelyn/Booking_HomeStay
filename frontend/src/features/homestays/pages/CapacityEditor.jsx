import React, { useEffect, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';

const money = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
const digits = value => String(value).replace(/\D/g, '');
const initial = data => {
  const baseCapacity = data.baseCapacity || 2;
  const extraGuestAllowed = Boolean(data.extraGuestAllowed);
  return {
    baseCapacity,
    maxCapacity: extraGuestAllowed ? (data.maxCapacity || baseCapacity) : baseCapacity,
    extraGuestAllowed,
    extraGuestFee: String(data.extraGuestFee || 0),
    extraChildFee: String(data.extraChildFee || 0),
    childMaxAge: data.childMaxAge ?? 11,
    maxExtraChildren: data.maxExtraChildren ?? 2
  };
};

function Stepper({ label, description, value, min = 1, max = 30, disabled = false, onChange }) {
  return (
    <div className={`capacity-stepper ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Giảm ${label}`} disabled={disabled || value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
        <b>{value}</b>
        <button type="button" aria-label={`Tăng ${label}`} disabled={disabled || value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
      <small>{description}</small>
    </div>
  );
}

export default function CapacityEditor({ homestayId, data, run, onDraftChange }) {
  const [form, setForm] = useState(initial(data));
  const [saving, setSaving] = useState(false);
  const previousMax = useRef(data.maxCapacity || data.baseCapacity || 2);
  const invalid = form.maxCapacity < form.baseCapacity;

  useEffect(() => {
    const next = initial(data);
    setForm(next);
    previousMax.current = data.maxCapacity || next.baseCapacity;
  }, [data.id, data.baseCapacity, data.maxCapacity, data.extraGuestAllowed, data.extraGuestFee, data.extraChildFee, data.childMaxAge, data.maxExtraChildren]);
  useEffect(() => onDraftChange?.(form), [form]);

  const payload = { ...form, extraGuestFee: +form.extraGuestFee, extraChildFee: +form.extraChildFee, childMaxAge: +form.childMaxAge, maxExtraChildren: +form.maxExtraChildren };
  const setBaseCapacity = value => setForm(current => ({ ...current, baseCapacity: value, maxCapacity: current.extraGuestAllowed ? Math.max(value, current.maxCapacity) : value }));
  const toggleExtraGuests = () => setForm(current => {
    if (current.extraGuestAllowed) {
      previousMax.current = current.maxCapacity;
      return { ...current, extraGuestAllowed: false, maxCapacity: current.baseCapacity };
    }
    return { ...current, extraGuestAllowed: true, maxCapacity: Math.max(current.baseCapacity, previousMax.current) };
  });
  const save = async () => {
    if (invalid || saving) return;
    setSaving(true);
    const result = await run(() => homestayApi.updateRoomCapacity(homestayId, data.id, payload));
    setSaving(false);
    if (result) toast.success('Đã lưu sức chứa.');
  };
  const applyAll = async () => {
    if (invalid || saving) return;
    const ok = await confirmDialog({ title: 'Áp dụng cho tất cả loại phòng?', message: 'Áp dụng chính sách khách thêm, phụ phí và độ tuổi trẻ em cho tất cả loại phòng?', confirmText: 'Áp dụng', variant: 'warning' });
    if (!ok) return;
    setSaving(true);
    const result = await run(() => homestayApi.bulkExtraGuestPolicy(homestayId, payload));
    setSaving(false);
    if (result) toast.success('Đã áp dụng cho tất cả loại phòng.');
  };

  return (
    <section className="capacity-editor room-type-section">
      <div className="room-section-heading"><h5>Sức chứa &amp; khách thêm</h5><p>Thiết lập số khách phù hợp và chính sách nhận thêm khách cho loại phòng này.</p></div>
      <div className="capacity-controls">
        <Stepper label="Sức chứa tiêu chuẩn" description="Người lớn + trẻ cao từ 1m2 đã gồm trong giá phòng." value={form.baseCapacity} onChange={setBaseCapacity} />
        <Stepper label="Người lớn tối đa" description={form.extraGuestAllowed ? 'Số người lớn tối đa khi có phụ thu người lớn.' : 'Đang tắt phụ thu người lớn: tối đa bằng sức chứa tiêu chuẩn.'} value={form.extraGuestAllowed ? form.maxCapacity : form.baseCapacity} min={form.baseCapacity} disabled={!form.extraGuestAllowed} onChange={value => { previousMax.current = value; setForm({ ...form, maxCapacity: value }); }} />
        <div className="capacity-stepper bed-summary"><span>Giường</span><b>{data.bedType || 'Chưa cập nhật'}</b><small>Loại giường đang lưu cho nhóm phòng.</small></div>
      </div>
      <div className="room-section-heading"><h6>Trẻ em ở thêm</h6><p>Người lớn và trẻ em cao từ 1m2 tính vào sức chứa tiêu chuẩn. Ngoài sức chứa, phòng nhận thêm trẻ em: trẻ cao từ 1m2 tính phụ thu mỗi đêm, trẻ dưới 1m2 miễn phí. Người lớn vượt sức chứa phải đổi phòng hoặc đặt thêm phòng.</p></div>
      <div className="extra-fee-grid">
        <Stepper label="Số trẻ em ở thêm tối đa" description="Tính cả trẻ dưới 1m2. 0 = không nhận ở thêm." value={form.maxExtraChildren} min={0} max={10} onChange={value => setForm({ ...form, maxExtraChildren: value })} />
        <label className="extra-fee-field"><span>Phụ thu trẻ từ 1m2 / đêm</span><div><input aria-label="Phụ thu trẻ em cao từ 1m2 mỗi đêm" inputMode="numeric" value={money(form.extraChildFee)} onChange={event => setForm({ ...form, extraChildFee: digits(event.target.value) })} /><small>đ</small></div></label>
      </div>
      <button type="button" className="extra-guest-switch" role="switch" aria-checked={form.extraGuestAllowed} onClick={toggleExtraGuests}><i aria-hidden="true" /><span><b>Cho phép thêm người lớn có phụ thu</b><small>Mặc định tắt: người lớn vượt sức chứa được gợi ý đổi phòng hoặc đặt thêm phòng. Chỉ bật nếu phòng có nệm phụ an toàn.</small></span></button>
      {form.extraGuestAllowed && <div className="extra-fee-grid">
        <label className="extra-fee-field"><span>Phụ phí người lớn / đêm</span><div><input aria-label="Phụ phí người lớn mỗi đêm" inputMode="numeric" value={money(form.extraGuestFee)} onChange={event => setForm({ ...form, extraGuestFee: digits(event.target.value) })} /><small>đ</small></div></label>
      </div>}
      {invalid && <p className="capacity-error">Người lớn tối đa không được thấp hơn sức chứa tiêu chuẩn.</p>}
      <footer><button type="button" className="capacity-save" disabled={invalid || saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu sức chứa'}</button><button type="button" className="capacity-bulk" disabled={invalid || saving} onClick={applyAll}>Áp dụng cho tất cả loại phòng</button></footer>
    </section>
  );
}
