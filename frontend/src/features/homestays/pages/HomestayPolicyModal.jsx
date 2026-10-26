import React, { useRef, useState } from 'react';
import './HomestayPolicyModal.css';
import { describeCancellationTiers, describeLateCheckout } from './policyExplain.js';

const formatMoney = (val) => {
  if (val == null || isNaN(val)) return '0 đ';
  return `${new Intl.NumberFormat('vi-VN').format(val)} đ`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
};

export default function HomestayPolicyModal({ isOpen, onClose, homestayName, policies, defaultCheckIn, defaultCheckOut }) {
  const [activeTab, setActiveTab] = useState('all');
  const navRef = useRef(null);

  if (!isOpen) return null;

  const doc = policies?.document || {};
  const checkInOut = doc.checkInOut || {};
  const houseRules = doc.houseRules || {};
  const payment = doc.payment || {};
  const guests = doc.guests || {};
  const dateChange = doc.dateChange || {};
  const roomChange = doc.roomChange || {};
  const pets = doc.pets || {};
  const breakfast = doc.breakfast || {};
  const vehicle = doc.vehicle || {};
  const assets = doc.assets || {};
  // Only what the effective-policies API returns: no invented fallback tiers.
  const cancellationRows = describeCancellationTiers(policies?.cancellationTiers);
  const lateCheckoutRows = describeLateCheckout(policies?.lateCheckoutTiers);

  // The homestay's own check-in/out times are the ones bookings and no-show deadlines use.
  const checkInTime = formatTime(defaultCheckIn) || formatTime(checkInOut.checkInTime) || '14:00';
  const checkOutTime = formatTime(defaultCheckOut) || formatTime(checkInOut.checkOutTime) || '12:00';
  // The stored early check-in tiers assume the default 14:00; hide them when they do not fit this homestay.
  const earlyCheckInTiers = (checkInOut.earlyCheckInTiers || []).filter((tier) => formatTime(tier.to) <= checkInTime);

  const tabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'checkin', label: 'Nhận & Trả phòng' },
    { id: 'cancellation', label: 'Hủy & Đổi ngày' },
    { id: 'payment', label: 'Thanh toán & Cọc' },
    { id: 'guests', label: 'Trẻ em & Giường' },
    { id: 'rules', label: 'Nội quy & Thú cưng' },
    { id: 'services', label: 'Dịch vụ thêm' },
  ];

  const showSection = (tabId) => activeTab === 'all' || activeTab === tabId;

  return (
    <div
      className="policy-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Chính sách homestay chi tiết"
    >
      <div className="policy-modal-container">
        {/* Header */}
        <header className="policy-modal-header">
          <div className="policy-modal-header-content">
            <span className="policy-modal-badge">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              QUY ĐỊNH LƯU TRÚ CHÍNH THỨC
            </span>
            <h2 className="policy-modal-title">Chính sách & Quy định homestay</h2>
            <p className="policy-modal-subtitle">
              Áp dụng cho khách lưu trú tại <strong>{homestayName || 'Homestay'}</strong> · Được bảo hộ bởi chính sách Tripio
            </p>
          </div>
          <button
            type="button"
            className="policy-modal-close"
            onClick={onClose}
            aria-label="Đóng bảng chính sách"
          >
            ×
          </button>
        </header>

        {/* Tab Filter Navigation */}
        <nav
          ref={navRef}
          className="policy-modal-nav"
          onWheel={(e) => {
            if (navRef.current && navRef.current.scrollWidth > navRef.current.clientWidth) {
              if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
                navRef.current.scrollLeft += e.deltaY;
              }
            }
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`policy-nav-pill ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Modal Scrollable Body */}
        <div className="policy-modal-body">
          {/* SECTION 1: NHẬN & TRẢ PHÒNG */}
          {showSection('checkin') && (
            <div className="policy-card-block">
              <div className="policy-card-header">
                <div className="policy-card-icon blue">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <h3 className="policy-card-title">1. Thời gian Nhận phòng & Trả phòng</h3>
                  <p className="policy-card-desc">Khung giờ quy chuẩn để phục vụ công tác dọn dẹp vệ sinh phòng tốt nhất</p>
                </div>
              </div>

              <div className="policy-highlight-pair">
                <div className="highlight-pill checkin">
                  <span className="pill-tag">GIỜ NHẬN PHÒNG</span>
                  <strong>Từ {checkInTime}</strong>
                  <small>Vui lòng xuất trình CCCD/Hộ chiếu khi check-in</small>
                </div>
                <div className="highlight-pill checkout">
                  <span className="pill-tag">GIỜ TRẢ PHÒNG</span>
                  <strong>Trước {checkOutTime}</strong>
                  <small>Sau giờ này sẽ tính phí trả phòng trễ</small>
                </div>
              </div>

              {/* Early checkin table */}
              {earlyCheckInTiers.length > 0 && (
                <div className="policy-sub-section">
                  <h4 className="sub-title">Biểu phí nhận phòng sớm (Early Check-in)</h4>
                  <div className="policy-table-wrapper">
                    <table className="policy-table">
                      <thead>
                        <tr>
                          <th>Khung giờ nhận phòng</th>
                          <th>Phụ thu (% giá phòng)</th>
                          <th>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earlyCheckInTiers.map((tier, idx) => (
                          <tr key={idx}>
                            <td><strong>{formatTime(tier.from)} — {formatTime(tier.to)}</strong></td>
                            <td>
                              <span className={`policy-fee-tag ${tier.percent === 0 ? 'free' : 'fee'}`}>
                                {tier.percent === 0 ? 'Miễn phí' : `+${tier.percent}%`}
                              </span>
                            </td>
                            <td>
                              {tier.percent === 0
                                ? 'Hỗ trợ miễn phí tùy thuộc vào tình trạng phòng trống'
                                : 'Cần liên hệ host xác nhận phòng trống trước'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Late checkout table */}
              {lateCheckoutRows.length > 0 && (
                <div className="policy-sub-section">
                  <h4 className="sub-title">Biểu phí trả phòng trễ (Late Check-out)</h4>
                  <div className="policy-table-wrapper">
                    <table className="policy-table">
                      <thead>
                        <tr>
                          <th>Thời gian trễ</th>
                          <th>Mức phụ phí</th>
                          <th>Hình thức</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lateCheckoutRows.map((row) => (
                          <tr key={row.label}>
                            <td><strong>{row.label} sau {checkOutTime}</strong></td>
                            <td><span className="policy-fee-tag fee">{row.fee.type === 'fixed' ? formatMoney(row.fee.value) : `${row.fee.value}% giá phòng/đêm`}</span></td>
                            <td>{row.fee.type === 'fixed' ? 'Số tiền cố định' : 'Tính theo % giá phòng'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {policies?.autoApproveLateCheckoutWithoutNextBooking && (
                    <div className="policy-info-alert">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                      <span>Hệ thống tự động duyệt yêu cầu trả phòng trễ nếu sau khung giờ đó chưa có lượt khách mới đặt phòng.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: HỦY PHÒNG & ĐỔI NGÀY */}
          {showSection('cancellation') && (
            <div className="policy-card-block">
              <div className="policy-card-header">
                <div className="policy-card-icon green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div>
                  <h3 className="policy-card-title">2. Chính sách Hủy phòng & Đổi ngày ở</h3>
                  <p className="policy-card-desc">Minh bạch các mốc hoàn tiền và quy định thay đổi lịch trình</p>
                </div>
              </div>

              {/* Cancellation tiers */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Chính sách hoàn tiền khi hủy phòng</h4>
                <div className="policy-timeline">
                  {cancellationRows.map((row) => (
                    <div key={row.label} className="timeline-node">
                      <div className={`timeline-marker ${row.tone}`}>
                        {row.refundPercent}%
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-top">
                          <strong>Hoàn lại {row.refundPercent}% số tiền đã thanh toán</strong>
                          <span className={`refund-badge badge-${row.tone}`}>
                            {row.tone === 'full' ? 'Miễn phí hủy' : row.tone === 'none' ? 'Không hoàn tiền' : `Hoàn ${row.refundPercent}%`}
                          </span>
                        </div>
                        <p>{row.label} trước ngày nhận phòng</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="policy-card-desc">Không tự hủy được trong ngày nhận phòng. Giá deal phút chót không hoàn tiền.</p>

                <div className="policy-info-alert success">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    Thời gian xử lý tiền hoàn: Từ <strong>{payment.refundProcessingMinimumBusinessDays ?? 3} đến {payment.refundProcessingMaximumBusinessDays ?? 15} ngày làm việc</strong> qua tài khoản ngân hàng ban đầu.
                  </span>
                </div>
              </div>

              {/* Date Change policy */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Quy định đổi ngày lưu trú</h4>
                <div className="policy-features-grid">
                  <div className="feature-item">
                    <div className="feature-icon">🔄</div>
                    <div>
                      <b>Số lần đổi ngày:</b>
                      <span>Tối đa {dateChange.maximumChanges ?? 1} lần cho mỗi mã đơn đặt phòng.</span>
                    </div>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">✨</div>
                    <div>
                      <b>Miễn phí đổi ngày:</b>
                      <span>Trước ít nhất {dateChange.freeBeforeDays ?? 7} ngày so với ngày nhận phòng.</span>
                    </div>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">🏷️</div>
                    <div>
                      <b>Phí đổi ngày gấp:</b>
                      <span>
                        Từ 3–6 ngày: +{dateChange.feeFromThreeToSixDaysPercent ?? 10}% · Dưới 3 ngày: +{dateChange.feeUnderThreeDaysPercent ?? 20}%
                      </span>
                    </div>
                  </div>
                  <div className="feature-item">
                    <div className="feature-icon">🎫</div>
                    <div>
                      <b>Chênh lệch giá phòng:</b>
                      <span>
                        Nếu đổi sang ngày có giá thấp hơn, phần chênh lệch được hoàn lại bằng{' '}
                        <strong>{dateChange.lowerPriceDifferenceMode === 'Voucher' ? `Voucher lưu trú (Hạn ${dateChange.voucherValidityMonths ?? 6} tháng)` : 'Tiền mặt/chuyển khoản'}</strong>.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Change policy */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Quy định đổi loại phòng</h4>
                <ul className="policy-bullets">
                  <li>
                    <strong>Miễn phí đổi phòng:</strong> Được hỗ trợ miễn phí nếu thông báo trước ít nhất <strong>{roomChange.freeBeforeHours ?? 24} giờ</strong> (tùy thuộc vào tình trạng phòng trống).
                  </li>
                  <li>
                    <strong>Đổi phòng gấp hoặc trong thời gian lưu trú:</strong> Phụ phí xử lý {formatMoney(roomChange.lateOrDuringStayFee ?? 100000)}/lần đổi.
                  </li>
                  {roomChange.freeUpgradeForHomestayFault && (
                    <li>
                      <strong>Cam kết nâng hạng phòng miễn phí:</strong> Trường hợp phòng ban đầu gặp sự cố kỹ thuật hoặc lỗi phát sinh từ homestay, bạn sẽ được nâng cấp lên phòng hạng cao hơn hoàn toàn miễn phí.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* SECTION 3: ĐẶT CỌC & THANH TOÁN */}
          {showSection('payment') && (
            <div className="policy-card-block">
              <div className="policy-card-header">
                <div className="policy-card-icon amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="22" height="16" x="1" y="4" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div>
                  <h3 className="policy-card-title">3. Chính sách Đặt cọc & Thanh toán</h3>
                  <p className="policy-card-desc">Bảo đảm quyền lợi đặt giữ phòng và bảo quản tài sản</p>
                </div>
              </div>

              <div className="policy-deposit-cards">
                <div className="deposit-card">
                  <span className="deposit-type">ĐẶT PHÒNG TIÊU CHUẨN</span>
                  <div className="deposit-val">{payment.standardDepositPercent ?? 30}%</div>
                  <p>Tỷ lệ đặt cọc khi đặt phòng ngày thường để giữ phòng thành công trên hệ thống</p>
                </div>
                <div className="deposit-card highlight">
                  <span className="deposit-type">DỊP LỄ TẾT / VILLA NGUYÊN CĂN</span>
                  <div className="deposit-val">{Math.max(payment.holidayDepositPercent ?? 0, payment.villaDepositPercent ?? 0)}%</div>
                  <p>Áp dụng vào các dịp cao điểm, cuối tuần hoặc biệt thự nguyên căn</p>
                </div>
              </div>

              {/* Asset deposit */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Tiền cọc đảm bảo tài sản (Security Deposit)</h4>
                <div className="policy-info-box">
                  <p>
                    Khi nhận phòng, khách lưu trú có thể được yêu cầu đặt cọc đảm bảo tài sản từ{' '}
                    <strong>{formatMoney(assets.minimumDeposit ?? 500000)}</strong> đến{' '}
                    <strong>{formatMoney(assets.maximumDeposit ?? 2000000)}</strong> (tiền mặt hoặc chuyển khoản). Khoản tiền này sẽ được <strong>hoàn trả 100%</strong> ngay khi trả phòng sau khi kiểm tra phòng không có mất mát hay hư hại.
                  </p>
                </div>

                <h5 className="sub-sub-title">Biểu phí bồi hoàn nếu xảy ra mất mát, hư hại tài sản:</h5>
                <div className="asset-fee-grid">
                  <div className="asset-fee-card">
                    <span>Khăn tắm / Khăn trải</span>
                    <strong>{formatMoney(assets.towelReplacement ?? 150000)}</strong>
                  </div>
                  <div className="asset-fee-card">
                    <span>Remote TV / Điều hòa</span>
                    <strong>{formatMoney(assets.tvRemoteReplacement ?? 300000)}</strong>
                  </div>
                  <div className="asset-fee-card">
                    <span>Mất chìa khóa / Thẻ từ</span>
                    <strong>{formatMoney(assets.keyReplacement ?? 200000)}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: TRẺ EM & GIƯỜNG PHỤ */}
          {showSection('guests') && (
            <div className="policy-card-block">
              <div className="policy-card-header">
                <div className="policy-card-icon purple">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="policy-card-title">4. Chính sách Trẻ em & Giường phụ</h3>
                  <p className="policy-card-desc">Tiêu chuẩn độ tuổi và phụ phí lưu trú thêm người</p>
                </div>
              </div>

              <div className="policy-child-tiers">
                <div className="age-rule-badge">
                  <span>Tiêu chuẩn người lớn:</span>
                  <strong>Từ {guests.adultAge ?? 12} tuổi trở lên</strong> (hoặc cao trên {guests.heightFallbackMeters ?? 1.2}m)
                </div>

                {/* Occupancy rules (backend OccupancyRules): height decides whether a child takes a capacity slot. */}
                <div className="policy-table-wrapper">
                  <table className="policy-table">
                    <thead>
                      <tr>
                        <th>Khách</th>
                        <th>Tính vào sức chứa</th>
                        <th>Phụ phí khi vượt sức chứa</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Người lớn (từ {guests.adultAge ?? 12} tuổi)</strong></td>
                        <td>Có</td>
                        <td>Không ở thêm được — đổi sang phòng lớn hơn hoặc đặt thêm phòng</td>
                      </tr>
                      <tr>
                        <td><strong>Trẻ em cao từ {guests.heightFallbackMeters ?? 1.2}m</strong></td>
                        <td>Có</td>
                        <td><span className="policy-fee-tag fee">Phụ thu cố định mỗi đêm (theo loại phòng)</span></td>
                      </tr>
                      <tr>
                        <td><strong>Trẻ em dưới {guests.heightFallbackMeters ?? 1.2}m</strong></td>
                        <td>Không</td>
                        <td><span className="policy-fee-tag free">Miễn phí</span></td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="policy-card-desc">Mỗi loại phòng nhận thêm tối đa một số trẻ em ngoài sức chứa (gồm cả trẻ dưới 1m2). Chủ nhà đối chiếu chiều cao khi nhận phòng; nếu khác khai báo sẽ điều chỉnh phụ thu. Mọi khách, kể cả trẻ em, đều phải khai báo lưu trú.</p>
                </div>
              </div>

              {/* Extra bed fees */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Phụ thu giường phụ & chăn gối bổ sung</h4>
                <div className="extra-bed-grid">
                  <div className="bed-item">
                    <span>Nôi / Cũi em bé:</span>
                    <strong>{guests.babyCotFee > 0 ? formatMoney(guests.babyCotFee) : 'Miễn phí (cần báo trước)'}</strong>
                  </div>
                  <div className="bed-item">
                    <span>Bộ chăn gối nệm phụ:</span>
                    <strong>{formatMoney(guests.extraBeddingFee ?? 50000)} / đêm</strong>
                  </div>
                  <div className="bed-item">
                    <span>Giường phụ trẻ em:</span>
                    <strong>{formatMoney(guests.childExtraBedFee ?? 100000)} / đêm</strong>
                  </div>
                  <div className="bed-item">
                    <span>Giường phụ người lớn:</span>
                    <strong>{formatMoney(guests.adultExtraBedFee ?? 200000)} / đêm</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: NỘI QUY & THÚ CƯNG */}
          {showSection('rules') && (
            <div className="policy-card-block">
              <div className="policy-card-header">
                <div className="policy-card-icon red">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                </div>
                <div>
                  <h3 className="policy-card-title">5. Nội quy lưu trú & Thú cưng</h3>
                  <p className="policy-card-desc">Đảm bảo không gian an toàn, lịch sự và tôn trọng không gian chung</p>
                </div>
              </div>

              <div className="rules-cards-grid">
                <div className="rule-card">
                  <div className="rule-icon">🤫</div>
                  <div className="rule-text">
                    <b>Giờ giữ yên tĩnh</b>
                    <span>
                      Từ <strong>{formatTime(houseRules.quietHoursFrom) || '22:00'}</strong> đến{' '}
                      <strong>{formatTime(houseRules.quietHoursTo) || '07:00'}</strong> sáng hôm sau. Tránh bật nhạc lớn hoặc tụ tập ồn ào.
                    </span>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-icon">🚭</div>
                  <div className="rule-text">
                    <b>Quy định hút thuốc</b>
                    <span>
                      {houseRules.smokingInRoomAllowed
                        ? 'Cho phép hút thuốc tại khu vực được chỉ định.'
                        : 'Nghiêm cấm hút thuốc lá và thuốc lá điện tử trong toàn bộ khuôn viên phòng ngủ. Vui lòng hút thuốc ở ban công hoặc sân vườn ngoài trời.'}
                    </span>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-icon">🐾</div>
                  <div className="rule-text">
                    <b>Chính sách thú cưng</b>
                    <span>
                      {pets.allowed ? (
                        <>
                          <strong>Được phép mang theo thú cưng</strong> (Tối đa {pets.maximumPerRoom ?? 1} bé/phòng). Phụ phí vệ sinh{' '}
                          <strong>{formatMoney(pets.feePerNight ?? 150000)}/đêm</strong>.
                        </>
                      ) : (
                        'Không cho phép mang theo thú cưng vào homestay để tránh dị ứng cho khách lưu trú tiếp theo.'
                      )}
                    </span>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-icon">🎉</div>
                  <div className="rule-text">
                    <b>Tổ chức tiệc & Sự kiện</b>
                    <span>
                      {houseRules.partiesRequireApproval
                        ? `Cần xin phép và được host duyệt trước. Phí dọn dẹp vệ sinh sự kiện từ ${formatMoney(houseRules.minimumPartyFee ?? 300000)} đến ${formatMoney(houseRules.maximumPartyFee ?? 1000000)}.`
                        : 'Không được phép tổ chức tiệc hoặc sự kiện ồn ào.'}
                    </span>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-icon">🧳</div>
                  <div className="rule-text">
                    <b>Gửi hành lý</b>
                    <span>
                      Miễn phí gửi hành lý tối đa <strong>{houseRules.freeLuggageStorageHoursAfterCheckout ?? 6} tiếng</strong> sau khi trả phòng. Sau thời gian này phụ phí {formatMoney(houseRules.luggageFeePerItemPerDay ?? 50000)}/kiện/ngày.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 6: DỊCH VỤ TIỆN ÍCH */}
          {showSection('services') && (
            <div className="policy-card-block">
              <div className="policy-card-header">
                <div className="policy-card-icon teal">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" />
                    <line x1="10" y1="1" x2="10" y2="4" />
                    <line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                </div>
                <div>
                  <h3 className="policy-card-title">6. Dịch vụ Ăn sáng & Di chuyển</h3>
                  <p className="policy-card-desc">Bảng giá các dịch vụ hỗ trợ thêm trong kỳ nghỉ của bạn</p>
                </div>
              </div>

              {/* Breakfast */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Bữa sáng tại homestay</h4>
                <div className="service-details-row">
                  <div className="service-col">
                    <span className="service-meta-label">Giờ phục vụ:</span>
                    <strong>{formatTime(breakfast.from) || '06:30'} — {formatTime(breakfast.to) || '09:30'}</strong>
                  </div>
                  <div className="service-col">
                    <span className="service-meta-label">Người lớn:</span>
                    <strong>{formatMoney(breakfast.adultPrice ?? 100000)} / suất</strong>
                  </div>
                  <div className="service-col">
                    <span className="service-meta-label">Trẻ em:</span>
                    <strong>{formatMoney(breakfast.childPrice ?? 60000)} / suất</strong>
                  </div>
                </div>
                <p className="service-incentive">
                  🎁 Miễn phí ăn sáng cho trẻ em dưới {breakfast.childFreeUnderAge ?? 6} tuổi hoặc khách lưu trú từ {breakfast.freeFromNights ?? 3} đêm trở lên (hoặc villa nguyên căn).
                </p>
              </div>

              {/* Vehicle & Airport Transfer */}
              <div className="policy-sub-section">
                <h4 className="sub-title">Dịch vụ cho thuê xe & Đưa đón</h4>
                <div className="vehicle-pricing-grid">
                  <div className="vehicle-card">
                    <span>🏍️ Xe máy số</span>
                    <strong>{formatMoney(vehicle.manualMotorbikeDailyPrice ?? 120000)} / ngày</strong>
                  </div>
                  <div className="vehicle-card">
                    <span>🛵 Xe tay ga</span>
                    <strong>{formatMoney(vehicle.scooterDailyPrice ?? 160000)} / ngày</strong>
                  </div>
                  <div className="vehicle-card">
                    <span>⚡ Xe điện</span>
                    <strong>{formatMoney(vehicle.electricBikeDailyPrice ?? 180000)} / ngày</strong>
                  </div>
                  <div className="vehicle-card">
                    <span>✈️ Đón / Tiễn sân bay</span>
                    <strong>{formatMoney(vehicle.airportPickupPrice ?? 300000)} / lượt</strong>
                  </div>
                </div>
                <small className="vehicle-deposit-note">
                  * Tiền đặt cọc xe khi thuê: {formatMoney(vehicle.vehicleDeposit ?? 500000)}/xe (kèm giấy phép lái xe).
                </small>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="policy-modal-footer">
          <div className="footer-notice">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#0b4ae6" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Chính sách được cập nhật và đồng bộ tự động từ dữ liệu quản lý homestay</span>
          </div>
          <button type="button" className="policy-confirm-btn" onClick={onClose}>
            Đã hiểu & Đóng
          </button>
        </footer>
      </div>
    </div>
  );
}
