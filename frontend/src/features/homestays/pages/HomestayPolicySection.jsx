import React from 'react';
import { cancellationHeadline, cancellationTimeline, describeCancellationTiers, describeDeposit, describeLateCheckout, describeNoShow, estimateRefund, vietnamToday } from './policyExplain.js';

const money = (value) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const formatDateVN = (value) => value ? value.split('-').reverse().join('/') : '';
const clock = (value) => String(value || '').slice(0, 5);

const icons = {
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  alert: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
};
const Icon = ({ name }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;

// Policy overview as a row of tiles; clicking a tile opens its full details below the row.
export default function HomestayPolicySection({ data, policy, priceQuote, arrival, hasValidStayDates, isDayUse, activeTile, onSelectTile, onOpenFullPolicy }) {
  const policyDoc = policy?.document || {};
  const houseRules = policyDoc.houseRules || {};
  const pets = policyDoc.pets || {};
  const dayUse = policyDoc.dayUse || {};
  const dealActive = Boolean(priceQuote?.deal);
  const effectiveTiers = dealActive ? [{ minimumDays: 0, maximumDays: null, refundPercent: 0 }] : policy?.cancellationTiers;
  const timeline = policy && hasValidStayDates ? cancellationTimeline(effectiveTiers, arrival, vietnamToday()) : [];
  const paidNow = priceQuote?.amountDueNow;
  const deposit = policy ? describeDeposit(policy, priceQuote, isDayUse) : null;
  const noShow = describeNoShow(policyDoc.noShow, data.checkInTime);
  const lateRows = describeLateCheckout(policy?.lateCheckoutTiers);
  const refundDays = policyDoc.payment;
  const checkIn = clock(data.checkInTime);
  const checkOut = clock(data.checkOutTime);
  const rangeLabel = (entry) => entry.from === entry.to ? formatDateVN(entry.from) : `${formatDateVN(entry.from)} – ${formatDateVN(entry.to)}`;

  const tiles = [
    { id: 'checkin', icon: 'clock', title: 'Nhận phòng', value: `Từ ${checkIn}`, hint: 'Giấy tờ, khai báo lưu trú' },
    { id: 'checkout', icon: 'logout', title: 'Trả phòng', value: `Trước ${checkOut}`, hint: lateRows.length ? 'Phụ phí trả trễ theo giờ' : 'Trả phòng đúng giờ' },
    { id: 'cancel', icon: 'file', title: 'Hủy phòng', value: cancellationHeadline(policy?.cancellationTiers), hint: 'Mức hoàn & tính thử theo ngày', tone: 'green' },
    { id: 'payment', icon: 'card', title: 'Thanh toán', value: deposit ? `Cọc từ ${deposit.percent}%` : 'Cọc hoặc trả đủ', hint: `Giữ phòng ${policy?.holdMinutes ?? 15} phút` },
    { id: 'noshow', icon: 'alert', title: 'Không đến nhận phòng', value: `Hạn ${noShow.deadline}`, hint: `Giữ lại ${noShow.penalty}` },
    { id: 'rules', icon: 'shield', title: 'Quy định chung', value: houseRules.smokingInRoomAllowed ? 'Hút thuốc theo khu vực' : 'Không hút thuốc', hint: pets.allowed ? 'Cho phép thú cưng' : 'Không mang thú cưng' },
    ...(dayUse.enabled ? [{ id: 'dayuse', icon: 'sun', title: 'Đặt trong ngày', value: `${clock(dayUse.from)} – ${clock(dayUse.to)}`, hint: `Từ ${dayUse.upToThreeHoursPercent}% giá/đêm`, tone: 'amber' }] : [])
  ];
  const active = tiles.find((tile) => tile.id === activeTile);

  const details = {
    checkin: <ul className="policy-detail-list">
      <li>Nhận phòng từ <b>{checkIn}</b> ngày nhận phòng.</li>
      <li>Mang CCCD/hộ chiếu; mọi khách, kể cả trẻ em, đều phải khai báo lưu trú.</li>
      <li>Đến muộn? Báo giờ đến dự kiến trong đơn (chậm nhất 06:00 sáng hôm sau) để được giữ phòng.</li>
    </ul>,
    checkout: <>
      <ul className="policy-detail-list">
        <li>Trả phòng trước <b>{checkOut}</b> để chủ nhà kịp dọn phòng cho khách sau.</li>
        {lateRows.length > 0 && <li>{policy.autoApproveLateCheckoutWithoutNextBooking ? 'Yêu cầu trả trễ được tự động duyệt nếu sau đó chưa có khách nhận phòng.' : 'Yêu cầu trả trễ cần chủ nhà duyệt.'}</li>}
      </ul>
      {lateRows.length > 0 && <ol className="policy-tier-list">
        {lateRows.map((row) => <li key={row.label} className="tone-partial"><span>{row.label} sau {checkOut}</span><strong>{row.fee.type === 'fixed' ? money(row.fee.value) : `${row.fee.value}% giá 1 đêm`}</strong></li>)}
      </ol>}
    </>,
    cancel: <div className="policy-detail-split">
      <div>
        <p className="policy-explain-lead">Số ngày tính bằng ngày nhận phòng trừ ngày bạn hủy (theo giờ Việt Nam).</p>
        <ol className="policy-tier-list" aria-label="Các mức hoàn tiền khi hủy phòng">
          {describeCancellationTiers(policy?.cancellationTiers).map((row) => <li key={row.label} className={`tone-${row.tone}`}><span>{row.label}</span><strong>{row.result}</strong></li>)}
        </ol>
        <ul className="policy-notes">
          <li>% hoàn tính trên <b>số tiền bạn đã thanh toán</b> (tiền cọc hoặc toàn bộ), không phải trên tổng giá phòng.</li>
          <li>Bạn tự hủy được đến hết ngày trước ngày nhận phòng; trong ngày nhận phòng vui lòng liên hệ chủ nhà.</li>
          <li>Giá deal phút chót <b>không hoàn tiền</b> khi hủy.</li>
          {refundDays && <li>Tiền hoàn về tài khoản thanh toán ban đầu trong {refundDays.refundProcessingMinimumBusinessDays}–{refundDays.refundProcessingMaximumBusinessDays} ngày làm việc.</li>}
        </ul>
      </div>
      <div className="policy-estimate-card">
        <h4>Tính thử theo ngày bạn chọn</h4>
        {timeline.length ? <>
          <p className="policy-explain-lead">
            Nhận phòng <b>{formatDateVN(arrival)}</b>
            {paidNow != null && <> · thanh toán khi đặt <b>{money(paidNow)}</b></>}
          </p>
          {dealActive && <p className="policy-estimate-alert">Bạn đang chọn giá deal phút chót: hủy vào bất kỳ ngày nào cũng không được hoàn tiền.</p>}
          <ol className="policy-timeline-list">
            {timeline.map((entry) => entry.checkInDay
              ? <li key="check-in" className="tone-none"><span>{formatDateVN(entry.from)} <em>ngày nhận phòng</em></span><strong>Không tự hủy được</strong></li>
              : <li key={entry.from} className={`tone-${entry.tone}`}>
                <span>{rangeLabel(entry)}{entry.isToday && <em>gồm hôm nay</em>}</span>
                <strong>
                  {entry.refundPercent >= 100 ? 'Hoàn 100%' : entry.refundPercent <= 0 ? 'Không hoàn tiền' : `Hoàn ${entry.refundPercent}%`}
                  {paidNow != null && entry.refundPercent > 0 && <> · ≈ {money(estimateRefund(paidNow, entry.refundPercent))}</>}
                </strong>
              </li>)}
          </ol>
          <small className="policy-estimate-note">Ước tính theo báo giá hiện tại; chính sách được lưu cùng đơn khi đặt.</small>
        </> : <p className="policy-estimate-empty">Chọn ngày nhận phòng ở khung đặt phòng để xem bạn được hủy miễn phí đến ngày nào.</p>}
      </div>
    </div>,
    payment: <ul className="policy-detail-list">
      <li>Sau khi bấm đặt, phòng được giữ <b>{policy?.holdMinutes ?? 15} phút</b> để bạn thanh toán. Quá thời gian này đơn tự hết hiệu lực, bạn có thể đặt lại.</li>
      {deposit && (deposit.fromQuote
        ? <li>Phòng bạn chọn cần đặt cọc <b>{deposit.percent}%</b> tổng tiền, hoặc bạn có thể thanh toán toàn bộ.</li>
        : <li>Đặt cọc từ <b>{deposit.percent}%</b> tổng tiền, hoặc thanh toán toàn bộ. Một số loại phòng, biệt thự nguyên căn hoặc dịp lễ có thể yêu cầu cọc cao hơn; con số chính xác hiện trong báo giá.</li>)}
      <li>Giá cuối cùng là giá trong báo giá khi bạn bấm đặt (đã gồm phụ thu cuối tuần/lễ, phụ thu thêm người và ưu đãi).</li>
    </ul>,
    noshow: <ul className="policy-detail-list">
      <li>Nếu đến <b>{noShow.deadline}</b> ngày nhận phòng (giờ nhận phòng + {noShow.graceHours} giờ) bạn chưa đến và chưa hủy, chủ nhà có thể giải phóng phòng.</li>
      <li>Đến muộn? Báo giờ đến dự kiến trong đơn (chậm nhất 06:00 sáng hôm sau) để được giữ phòng thêm.</li>
      <li>Khi bị tính là không đến: chủ nhà giữ lại {noShow.penalty}; phần đã trả còn lại được hoàn {noShow.remainingRefundPercent}%.</li>
      <li>Bạn có 48 giờ để khiếu nại nếu không đồng ý với quyết định của chủ nhà.</li>
    </ul>,
    rules: <ul className="policy-detail-list">
      <li>{houseRules.smokingInRoomAllowed ? 'Cho phép hút thuốc theo khu vực quy định.' : 'Không hút thuốc trong phòng.'}</li>
      <li>{pets.allowed ? `Cho phép tối đa ${pets.maximumPerRoom} thú cưng/phòng · ${money(pets.feePerNight)}/đêm.` : 'Không mang thú cưng.'}</li>
      <li>Giữ yên tĩnh từ {clock(houseRules.quietHoursFrom || '22:00')} đến {clock(houseRules.quietHoursTo || '07:00')}.</li>
      <li>{houseRules.partiesRequireApproval === false ? 'Không tổ chức tiệc, sự kiện.' : 'Tiệc, sự kiện cần chủ nhà duyệt trước.'}</li>
    </ul>,
    dayuse: <ul className="policy-detail-list">
      <li>Sử dụng phòng trong khung <b>{clock(dayUse.from)} – {clock(dayUse.to)}</b>, nhận và trả trong cùng một ngày.</li>
      <li>Tối đa 3 giờ: {dayUse.upToThreeHoursPercent}% giá phòng/đêm · tối đa 6 giờ: {dayUse.upToSixHoursPercent}% · trên 6 giờ: {dayUse.overSixHoursPercent}%.</li>
      <li>Đặt cọc {dayUse.depositPercent}%; hủy theo bảng hoàn tiền ở mục Hủy phòng, không tự hủy được trong ngày sử dụng.</li>
    </ul>
  };

  return (
    <section id="policy" className="detail-box policy-section">
      <header className="section-title">
        <small>THÔNG TIN CẦN BIẾT</small>
        <h2>Chính sách homestay</h2>
      </header>
      <div className="policy-tiles" role="tablist" aria-label="Các nhóm chính sách">
        {tiles.map((tile) => (
          <button key={tile.id} type="button" role="tab" id={`policy-tab-${tile.id}`} aria-selected={activeTile === tile.id} aria-controls="policy-detail-panel"
            className={`policy-tile ${tile.tone ? `tone-${tile.tone}` : ''} ${activeTile === tile.id ? 'active' : ''}`}
            onClick={() => onSelectTile(activeTile === tile.id ? null : tile.id)}>
            <i><Icon name={tile.icon} /></i>
            <span>
              <b>{tile.title}</b>
              <strong>{tile.value}</strong>
              <small>{tile.hint}</small>
            </span>
            <em aria-hidden="true">{activeTile === tile.id ? '−' : '+'}</em>
          </button>
        ))}
      </div>
      {active
        ? <div id="policy-detail-panel" role="tabpanel" aria-labelledby={`policy-tab-${active.id}`} className="policy-detail-panel">
          <header><h3>{active.title}</h3><button type="button" onClick={() => onSelectTile(null)} aria-label="Đóng chi tiết">×</button></header>
          {details[active.id]}
        </div>
        : <p className="policy-tiles-hint">Bấm vào từng mục để xem chi tiết.</p>}
      <div className="policy-footer">
        <small>Chính sách được lưu kèm đơn tại thời điểm đặt phòng; nếu homestay thay đổi chính sách sau đó, đơn của bạn không bị ảnh hưởng.</small>
        <button type="button" className="policy-full-btn" onClick={onOpenFullPolicy}>Xem toàn bộ chính sách →</button>
      </div>
    </section>
  );
}
