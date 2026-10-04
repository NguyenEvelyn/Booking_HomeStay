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
    childMaxAge: data.childMaxAge ?? 11
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
  }, [data.id, data.baseCapacity, data.maxCapacity, data.extraGuestAllowed, data.extraGuestFee, data.extraChildFee, data.childMaxAge]);
  useEffect(() => onDraftChange?.(form), [form]);

  const payload = { ...form, extraGuestFee: +form.extraGuestFee, extraChildFee: +form.extraChildFee, childMaxAge: +form.childMaxAge };
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
        <Stepper label="Khách tiêu chuẩn" description="Số khách đã bao gồm trong giá phòng." value={form.baseCapacity} onChange={setBaseCapacity} />
        <Stepper label="Khách tối đa" description={form.extraGuestAllowed ? 'Tổng số khách tối đa được phép lưu trú.' : 'Đang tắt khách thêm, tối đa bằng mức tiêu chuẩn.'} value={form.extraGuestAllowed ? form.maxCapacity : form.baseCapacity} min={form.baseCapacity} disabled={!form.extraGuestAllowed} onChange={value => { previousMax.current = value; setForm({ ...form, maxCapacity: value }); }} />
        <div className="capacity-stepper bed-summary"><span>Giường</span><b>{data.bedType || 'Chưa cập nhật'}</b><small>Loại giường đang lưu cho nhóm phòng.</small></div>
      </div>
      <button type="button" className="extra-guest-switch" role="switch" aria-checked={form.extraGuestAllowed} onClick={toggleExtraGuests}><i aria-hidden="true" /><span><b>Cho phép khách vượt mức tiêu chuẩn</b><small>Tắt thì phòng chỉ nhận đúng số khách tiêu chuẩn.</small></span></button>
      {form.extraGuestAllowed && <div className="extra-fee-grid">
        <label className="extra-fee-field"><span>Phụ phí người lớn / đêm</span><div><input aria-label="Phụ phí người lớn mỗi đêm" inputMode="numeric" value={money(form.extraGuestFee)} onChange={event => setForm({ ...form, extraGuestFee: digits(event.target.value) })} /><b>đ</b></div></label>
        <label className="extra-fee-field"><span>Phụ phí trẻ em / đêm</span><div><input aria-label="Phụ phí trẻ em mỗi đêm" inputMode="numeric" value={money(form.extraChildFee)} onChange={event => setForm({ ...form, extraChildFee: digits(event.target.value) })} /><b>đ</b></div></label>
        <Stepper label="Tuổi tối đa của trẻ em" description="Áp dụng mức phụ phí trẻ em." value={form.childMaxAge} min={0} max={17} onChange={value => setForm({ ...form, childMaxAge: value })} />
      </div>}
      {invalid && <p className="capacity-error">Khách tối đa không được thấp hơn khách tiêu chuẩn.</p>}
      <footer><button type="button" className="capacity-save" disabled={invalid || saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu sức chứa'}</button><button type="button" className="capacity-bulk" disabled={invalid || saving} onClick={applyAll}>Áp dụng cho tất cả loại phòng</button></footer>
    </section>
  );
}
