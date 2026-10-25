import React, { useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { NumberStepper } from './HostBookingControls.jsx';
import { money } from './hostBookingUtils.js';

// Guests joining an ongoing stay. Same occupancy rules as booking: children from 1.2 m beyond capacity pay for the
// remaining nights, children under 1.2 m are free, extra adults need a room change (the server returns suggestions).
export default function HostAddGuestsModal({ item, close, done, changeRoom }) {
  const [form, setForm] = useState({ adults: 0, tallChildren: 0, smallChildren: 0, note: '' });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const total = form.adults + form.tallChildren + form.smallChildren;

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      done(await homestayApi.addGuests(item.id, { ...form, note: form.note.trim() || null }));
    } catch (err) {
      setProblem({ message: err.message, suggestions: err.data?.suggestions || [] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <form className="op-modal-container" style={{ maxWidth: '560px' }} onSubmit={submit}>
        <header className="op-modal-header">
          <h3><HostIcon name="plus" size={18} /> Thêm khách giữa kỳ</h3>
          <button type="button" className="booking-modal-close" onClick={close}><HostIcon name="close" size={18} /></button>
        </header>
        <div className="op-modal-body">
          <p>Đang ở: {item.adultCount} người lớn, {item.tallChildCount ?? item.childCount ?? 0} trẻ từ 1m2, {item.smallChildCount ?? 0} trẻ dưới 1m2. Phụ thu tính cho các đêm còn lại.</p>
          <div className="guest-tier-grid">
            <div className="guest-tier-card"><header><strong>Người lớn thêm</strong><small>Vượt sức chứa phải đổi phòng</small></header>
              <NumberStepper value={form.adults} min={0} onChange={v => setForm(f => ({ ...f, adults: v }))} ariaLabel="Người lớn thêm" /></div>
            <div className="guest-tier-card"><header><strong>Trẻ từ 1m2 thêm</strong><small>Vượt sức chứa +{money(item.details?.[0]?.capacity?.extraChildFee || 0)}/đêm</small></header>
              <NumberStepper value={form.tallChildren} min={0} onChange={v => setForm(f => ({ ...f, tallChildren: v }))} ariaLabel="Trẻ từ 1m2 thêm" /></div>
            <div className="guest-tier-card"><header><strong>Trẻ dưới 1m2 thêm</strong><small>Miễn phí</small></header>
              <NumberStepper value={form.smallChildren} min={0} onChange={v => setForm(f => ({ ...f, smallChildren: v }))} ariaLabel="Trẻ dưới 1m2 thêm" /></div>
          </div>
          <div className="field-group" style={{ marginTop: '12px' }}>
            <label>Ghi chú (tên khách, giấy tờ đã kiểm tra…)</label>
            <input className="form-input" maxLength={500} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
          {problem && (
            <div className="timing-message-alert error" style={{ marginTop: '12px' }}>
              <b>{problem.message}</b>
              {problem.suggestions.length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
                {problem.suggestions.map(x => <li key={`${x.kind}-${x.roomTypeId}-${x.quantity}`}>
                  {x.kind === 'ChangeRoom' ? 'Đổi sang' : x.kind === 'AddRoom' ? `Thêm phòng (${x.quantity} phòng)` : 'Homestay khác:'} {x.kind === 'OtherHomestay' ? `${x.homestayName} · ` : ''}{x.roomTypeName} — còn {x.availableRooms} phòng, {money(x.basePrice)}/đêm
                </li>)}
              </ul>}
              <button type="button" className="btn-modal-cancel" style={{ marginTop: '8px' }} onClick={changeRoom}>Mở Đổi phòng</button>
            </div>
          )}
        </div>
        <footer className="op-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={close}>Đóng</button>
          <button className="btn-modal-submit" disabled={saving || total < 1}>{saving ? 'Đang xử lý…' : 'Thêm khách'}</button>
        </footer>
      </form>
    </div>
  );
}
