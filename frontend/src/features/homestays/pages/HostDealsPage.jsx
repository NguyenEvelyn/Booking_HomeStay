import React, { useEffect, useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import HostDealModal from './HostDealModal.jsx';
import { money, date, dateTime } from './hostBookingUtils.js';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';

// Host list of last-minute deals with sales figures; rooms come from the room management data.
export default function HostDealsPage({ rooms = [] }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const roomTypes = useMemo(() => {
    const map = new Map();
    rooms.forEach(r => { if (!map.has(r.roomTypeId)) map.set(r.roomTypeId, { id: r.roomTypeId, name: r.roomTypeName, homestayName: r.homestayName, basePrice: r.basePrice }); });
    return [...map.values()];
  }, [rooms]);
  const load = async () => {
    setLoading(true);
    try { setItems((await homestayApi.hostDeals()).items || []); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const promote = async x => {
    if (!(await confirmDialog({ title: 'Đề xuất deal lên banner trang chủ?', message: 'Banner dùng ảnh bìa homestay và chạy đến khi deal ngừng bán. Quản trị viên sẽ duyệt trước khi hiển thị.' }))) return;
    try { toast.success((await homestayApi.promoteDeal(x.id)).message); } catch (e) { toast.error(e.message); }
  };
  const end = async x => {
    if (!(await confirmDialog({ title: 'Kết thúc deal?', message: `Ngừng bán deal ${x.roomTypeName}. Đơn đã đặt vẫn giữ giá deal.` }))) return;
    try { toast.success((await homestayApi.endDeal(x.id)).message); load(); } catch (e) { toast.error(e.message); }
  };
  return (
    <section className="host-card">
      <header className="host-section-head">
        <div><small>SĂN PHÒNG GIÁ RẺ</small><h2>Deal phút chót</h2><p>Bán nhanh phòng còn trống trong 0–3 ngày tới. Deal đang chạy được hiển thị cho khách ở trang chủ và trang homestay.</p></div>
        <button type="button" className="btn-primary-action" disabled={!roomTypes.length} onClick={() => setCreating(true)}><HostIcon name="plus" size={16} /> Tạo deal</button>
      </header>
      {loading ? <p>Đang tải…</p> : items.length === 0 ? <p>Chưa có deal nào. Khi khách không đến, bạn có thể tạo deal ngay từ đơn đặt phòng.</p> : (
        <div className="host-table-scroll"><table><thead><tr><th>Phòng</th><th>Đêm</th><th>Giá deal</th><th>Đã bán</th><th>Doanh thu</th><th>Ngừng bán</th><th>Trạng thái</th><th></th></tr></thead><tbody>
          {items.map(x => <tr key={x.id}>
            <td><b>{x.roomTypeName}</b><small>{x.homestayName}{x.source === 'NoShow' ? ' · từ đơn không đến' : ''}</small></td>
            <td>{date(x.startDate)} → {date(x.endDate)}</td>
            <td>-{x.discountPercent}%<small>≈ {money(x.estimatedPrice)}/đêm</small>{x.allowVoucher && <small>Cho dùng voucher</small>}</td>
            <td>{x.sold}/{x.roomsLimit}</td>
            <td>{money(x.revenue)}</td>
            <td>{dateTime(x.saleEndsAt)}</td>
            <td>{x.status === 'Active' ? 'Đang bán' : 'Đã kết thúc'}</td>
            <td>{x.status === 'Active' && <>
              <button type="button" className="admin-link" onClick={() => promote(x)}>Đề xuất lên banner</button>{' '}
              <button type="button" className="admin-link" onClick={() => end(x)}>Kết thúc</button>
            </>}</td>
          </tr>)}
        </tbody></table></div>
      )}
      {creating && <HostDealModal roomTypes={roomTypes} close={() => setCreating(false)} created={res => { toast.success(res.message); setCreating(false); load(); }} />}
    </section>
  );
}
