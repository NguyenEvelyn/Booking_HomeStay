import React, { useEffect, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import { money, dateTime } from './hostBookingUtils.js';

// Releases a confirmed booking whose guest never arrived. The server only allows it after the grace period
// (or the guest's announced arrival) and requires a note proving the host tried to reach the guest.
export default function HostNoShowModal({ item, close, done }) {
  const [quote, setQuote] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    homestayApi.noShowQuote(item.id).then(setQuote).catch(e => setError(e.message || 'Không tải được thông tin no-show.'));
  }, [item.id]);

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      done(await homestayApi.markNoShow(item.id, { contactNote: note.trim() }));
    } catch (err) {
      setError(err.message || 'Không thể xác nhận khách không đến.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="op-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <form className="op-modal-container" style={{ maxWidth: '620px' }} onSubmit={submit}>
        <header className="op-modal-header">
          <h3><HostIcon name="clock" size={18} /> Khách không đến (No-show)</h3>
          <button type="button" className="booking-modal-close" onClick={close}><HostIcon name="close" size={18} /></button>
        </header>
        <div className="op-modal-body">
          {!quote && !error && <p>Đang tải…</p>}
          {quote && (
            <>
              <div className={`timing-message-alert ${quote.canMark ? 'error' : 'info'}`} style={{ marginBottom: '14px' }}>
                {quote.canMark
                  ? <>Đã hết thời gian chờ ({quote.graceHours} giờ sau giờ nhận phòng{quote.expectedArrivalAt ? ', hoặc giờ khách đã báo' : ''}). Xác nhận sẽ <b>trả phòng để bán lại</b> và áp dụng chính sách no-show.</>
                  : <>{quote.reason}</>}
              </div>
              {quote.expectedArrivalAt && (
                <p>Khách đã báo đến lúc <b>{dateTime(quote.expectedArrivalAt)}</b>{quote.lateArrivalNote ? ` — “${quote.lateArrivalNote}”` : ''}.</p>
              )}
              <div className="preview-change-summary" style={{ marginBottom: '14px' }}>
                <div className="preview-change-row"><span>Khách đã thanh toán</span><b>{money(quote.paidAmount)}</b></div>
                <div className="preview-change-row"><span>Bạn giữ lại</span><b className="text-preview-red">{money(quote.retainedAmount)}</b></div>
                <div className="preview-change-row"><span>Hoàn cho khách (chờ bạn chuyển)</span><b className="text-preview-green">{money(quote.refundAmount)}</b></div>
                <div className="preview-change-row"><span>Chính sách</span><span>{quote.penaltyLabel}</span></div>
              </div>
              <div className="field-group">
                <label>Bạn đã liên hệ khách thế nào? <span className="req">*</span></label>
                <textarea className="form-input" rows={3} minLength={10} maxLength={1000} required value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Ví dụ: gọi 2 lần lúc 20:00 và 20:30 không bắt máy, đã nhắn Zalo lúc 20:35" disabled={!quote.canMark} />
                <small>Khách có 48 giờ để khiếu nại; ghi chú này được dùng khi quản trị viên xem xét.</small>
              </div>
            </>
          )}
          {error && <div className="timing-message-alert error">{error}</div>}
        </div>
        <footer className="op-modal-footer">
          <button type="button" className="btn-modal-cancel" onClick={close}>Đóng</button>
          <button className="btn-modal-submit danger" disabled={!quote?.canMark || saving || note.trim().length < 10}>
            {saving ? 'Đang xử lý…' : 'Xác nhận không đến & trả phòng'}
          </button>
        </footer>
      </form>
    </div>
  );
}
