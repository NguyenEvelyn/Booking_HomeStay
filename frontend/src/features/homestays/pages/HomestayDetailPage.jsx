import React, { useEffect, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import { freshImageUrl } from '../../../shared/utils/freshImageUrl.js';
import { bookingApi } from '../../bookings/api/bookingApi.js';
import './CapacityBooking.css';
import './HomestayDetailReference.css';
import './HomestayDetailRedesign.css';
import pineHomestayImage from '../../../../assets/f6cd6879081dc8e8d4ff18669308ea86.jpg';
import azureHomestayImage from '../../../../assets/ecf184f6b6cd2b6e2aa898ff3195ab7e.jpg';
import sunsetHomestayImage from '../../../../assets/2fc6b619bb0af3dc94971c099d25bbae.jpg';
import deluxeRoomImage from '../../../../assets/be402600cc69b6c03f813e85453be7ff.jpg';
import familySuiteImage from '../../../../assets/9831323b9ec25a6c954800c1a66de2ff.jpg';
import gardenViewRoomImage from '../../../../assets/351637f1124ce334062731a57eec77ac.jpg';

const money = (value) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const amenityIcons = { Internet: '⌁', 'Giải trí': '≋', 'Dịch vụ': '🚘', Phòng: '❄', 'Tiện ích': '♨' };
const roomFallbacks = [
  deluxeRoomImage,
  familySuiteImage,
  gardenViewRoomImage
];
const eloraImages = Object.values(import.meta.glob('../../../../assets/EloraHomestay/*.jpg', {
  eager: true, query: '?url', import: 'default'
}));

const homestayCover = (name) => name.includes('Sunset') ? sunsetHomestayImage
  : name.includes('Azure') ? azureHomestayImage : pineHomestayImage;

function GuestCounter({value,min=1,max,onChange}){
  return <div className="booking-guest-stepper"><button type="button" disabled={value<=min} onClick={()=>onChange(Math.max(min,value-1))}>−</button><b>{value}</b><button type="button" disabled={value>=max} onClick={()=>onChange(Math.min(max,value+1))}>＋</button></div>;
}

export default function HomestayDetailPage({ id, refreshKey = 0, initialSearch, user, onHome, onBack, onBookings, onAccount, onDeveloping }) {
  const [data, setData] = useState(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [error, setError] = useState('');
  const [arrival, setArrival] = useState(initialSearch?.checkIn || '');
  const [departure, setDeparture] = useState(initialSearch?.checkOut || '');
  const [adultCount, setAdultCount] = useState(initialSearch?.guests || 2);
  const [childCount, setChildCount] = useState(0);
  const [roomQuantity, setRoomQuantity] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeRoomImage, setActiveRoomImage] = useState(0);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [reviews, setReviews] = useState({ average: 0, total: 0, distribution: [], items: [] });
  const [reviewForm, setReviewForm] = useState({ bookingId: '', rating: 5, comment: '' });
  const [reviewBookings, setReviewBookings] = useState([]);
  const [reviewMessage, setReviewMessage] = useState('');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewRatingFilter, setReviewRatingFilter] = useState(0);
  const [reviewAmenityFilter, setReviewAmenityFilter] = useState('');
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewReplyFilter, setReviewReplyFilter] = useState('all');
  const [reviewTimeFilter, setReviewTimeFilter] = useState('all');
  const [reviewSort, setReviewSort] = useState('newest');
  const [paymentExpiresAt, setPaymentExpiresAt] = useState(null);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(15 * 60);
  const [priceQuote, setPriceQuote] = useState(null);
  const nameParts = (user?.fullName || '').trim().split(/\s+/).filter(Boolean);
  const [guestInfo, setGuestInfo] = useState({
    firstName: nameParts.slice(0, -1).join(' '), lastName: nameParts.at(-1) || '',
    email: user?.email || '', country: 'Việt Nam', countryCode: '+84', phone: '', arrivalTime: ''
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    homestayApi.detail(id).then((result) => { setImageVersion(`${Date.now()}-${refreshKey}`); setData(result); }).catch((e) => setError(e.message));
  }, [id, refreshKey]);

  const loadReviews = () => homestayApi.reviews(id).then(setReviews).catch(() => {});
  useEffect(() => {
    loadReviews();
    if (['Customer', 'Host'].includes(user?.role)) bookingApi.mine().then((result) => setReviewBookings(result.items.filter((item) => item.homestayId === Number(id) && item.canReview))).catch(() => {});
  }, [id, user?.role]);

  const submitReview = async (event) => {
    event.preventDefault(); setReviewMessage('');
    try {
      const result = await homestayApi.createReview({ ...reviewForm, bookingId: Number(reviewForm.bookingId), rating: Number(reviewForm.rating) });
      setReviewMessage(result.message); setReviewForm({ bookingId: '', rating: 5, comment: '' });
      setReviewBookings((items) => items.filter((item) => item.id !== Number(reviewForm.bookingId))); loadReviews();
    } catch (reviewError) { setReviewMessage(reviewError.message); }
  };

  useEffect(() => {
    if (!showPaymentPage || !paymentExpiresAt) return undefined;
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((paymentExpiresAt - Date.now()) / 1000));
      setPaymentSecondsLeft(seconds);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [showPaymentPage, paymentExpiresAt]);

  useEffect(() => {
    if (!showAllReviews) return undefined;
    const close = (event) => { if (event.key === 'Escape') setShowAllReviews(false); };
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', close); };
  }, [showAllReviews]);

  if (error) return <main className="detail-state"><p>{error}</p><button onClick={onBack}>Quay lại danh sách</button></main>;
  if (!data) return <main className="detail-state"><div className="detail-loader" />Đang tải chi tiết homestay...</main>;

  const address = [data.addressLine, data.ward, data.district, data.province].filter(Boolean).join(', ');
  const amenities = data.amenities.length ? data.amenities.slice(0, 5) : [
    { id: 1, name: 'WiFi miễn phí', category: 'Internet' }, { id: 2, name: 'Bể bơi ngoài trời', category: 'Giải trí' },
    { id: 3, name: 'Nhà hàng', category: 'Tiện ích' }, { id: 4, name: 'Spa & thư giãn', category: 'Dịch vụ' },
    { id: 5, name: 'Đưa đón sân bay', category: 'Dịch vụ' }
  ];
  const reviewAmenityOptions = ['WiFi', 'Ban công', 'Điều hòa', 'Nhà bếp', 'Sân vườn', 'Chỗ đỗ xe', 'Vật nuôi', 'Thành phố'];
  const normalizedSearch = reviewSearch.trim().toLocaleLowerCase('vi');
  const filteredReviews = reviews.items.filter((review) => {
    const content = `${review.comment || ''} ${review.hostReply || ''}`.toLocaleLowerCase('vi');
    const created = new Date(review.createdAt);
    const now = new Date();
    const withinTime = reviewTimeFilter === 'all' || (reviewTimeFilter === 'year' && created >= new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())) || (reviewTimeFilter === 'month' && created >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()));
    return (!reviewRatingFilter || review.rating === reviewRatingFilter)
      && (!reviewAmenityFilter || content.includes(reviewAmenityFilter.toLocaleLowerCase('vi')))
      && (reviewReplyFilter === 'all' || (reviewReplyFilter === 'replied' && review.hostReply) || (reviewReplyFilter === 'not-replied' && !review.hostReply))
      && withinTime
      && (!normalizedSearch || content.includes(normalizedSearch) || review.customerName.toLocaleLowerCase('vi').includes(normalizedSearch));
  }).sort((a, b) => reviewSort === 'highest' ? b.rating - a.rating : reviewSort === 'lowest' ? a.rating - b.rating : reviewSort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt));
  const reviewsPerPage = 4;
  const reviewPageCount = Math.max(1, Math.ceil(filteredReviews.length / reviewsPerPage));
  const visibleReviews = filteredReviews.slice((Math.min(reviewPage, reviewPageCount) - 1) * reviewsPerPage, Math.min(reviewPage, reviewPageCount) * reviewsPerPage);
  const changeReviewFilters = (change) => { change(); setReviewPage(1); };
  const checkRooms = () => document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const openRoomDetail = async (room) => {
    const availableQuantity = Math.max(1, Math.min(roomQuantity, room.availableRoomCount || 1));
    setSelectedRoom(room); setShowPaymentPage(false); setActiveRoomImage(0); setRoomQuantity(availableQuantity);
    const roomLimit=(room.extraGuestAllowed?room.maxCapacity:room.baseCapacity)||room.maxAdults+room.maxChildren;
    setAdultCount((value) => Math.max(1, Math.min(value, roomLimit * availableQuantity)));
    setChildCount(0);
    window.setTimeout(() => document.getElementById('room-detail-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try { const detail = await homestayApi.roomTypeDetail(room.id); setSelectedRoom((current) => current?.id === room.id ? { ...current, ...detail } : current); } catch { /* giữ dữ liệu danh sách nếu tải gallery thất bại */ }
  };
  const closeRoomDetail = () => { setSelectedRoom(null); setShowPaymentPage(false); window.setTimeout(() => document.querySelector('.rooms-section')?.scrollIntoView({ behavior: 'smooth' }), 0); };
  const bookingNights = arrival && departure ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000)) : 0;
  const bookingGuestMax = selectedRoom ? ((selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity) || selectedRoom.maxAdults + selectedRoom.maxChildren) * roomQuantity : 1;
  const includedAdultCount = selectedRoom ? (selectedRoom.baseCapacity||Math.min(2,selectedRoom.maxAdults)) * roomQuantity : 0;
  const extraAdultCount = Math.max(0, adultCount + childCount - includedAdultCount);
  const roomPriceTotal = selectedRoom ? selectedRoom.basePrice * bookingNights * roomQuantity : 0;
  const extraAdultTotal = extraAdultCount * (selectedRoom?.extraGuestFee||0) * bookingNights;
  const childFeeTotal = 0;
  const extraFeeTotal = extraAdultTotal + childFeeTotal;
  const bookingGrandTotal = roomPriceTotal + extraFeeTotal;
  const quotedRoomTotal = priceQuote?.roomTotal ?? roomPriceTotal;
  const quotedExtraAdultTotal = priceQuote?.extraGuestFee ?? extraAdultTotal;
  const quotedGrandTotal = priceQuote?.total ?? bookingGrandTotal;
  const selectedRoomImages = selectedRoom?.rooms?.flatMap((room) => room.images.map((image) => ({ ...image, caption: image.caption || `Phòng ${room.roomNumber}` })))?.length
    ? selectedRoom.rooms.flatMap((room) => room.images.map((image) => ({ ...image, caption: image.caption || `Phòng ${room.roomNumber}` })))
    : selectedRoom?.images?.length ? selectedRoom.images : eloraImages.map((url, index) => ({ id: `fallback-${index}`, url, caption: selectedRoom?.name || 'Ảnh phòng' }));
  const openPaymentPage = async () => {
    if (!user) { setBookingError('Vui lòng đăng nhập tài khoản khách hàng trước khi đặt phòng.'); return; }
    if (!arrival || !departure) { setBookingError('Vui lòng chọn ngày nhận và trả phòng.'); return; }
    if (bookingNights < 1) { setBookingError('Ngày trả phòng phải sau ngày nhận phòng.'); return; }
    setBookingBusy(true); setBookingError('');
    try {
      const quote = await bookingApi.quote({ roomTypeId: selectedRoom.id, checkInDate: arrival, checkOutDate: departure, adultCount, childCount, quantity: roomQuantity, customerNote: null });
      setPriceQuote(quote); setPaymentExpiresAt(Date.now() + 15 * 60 * 1000); setPaymentSecondsLeft(15 * 60); setShowPaymentPage(true); window.scrollTo(0, 0);
    } catch (quoteError) { setBookingError(quoteError.message); }
    finally { setBookingBusy(false); }
  };
  const updateGuestInfo = (field) => (event) => {
    setGuestInfo((current) => ({ ...current, [field]: event.target.value }));
    setBookingError('');
  };
  const payWithVnPay = async () => {
    if (!user) { setBookingError('Vui lòng đăng nhập tài khoản khách hàng trước khi đặt phòng.'); return; }
    if (!arrival || !departure) { setBookingError('Vui lòng chọn ngày nhận và trả phòng.'); return; }
    if (paymentSecondsLeft <= 0) { setBookingError('Thời gian giữ giá đã hết. Vui lòng quay lại kiểm tra phòng và giá.'); return; }
    if (!guestInfo.firstName.trim() || !guestInfo.lastName.trim() || !guestInfo.email.trim() || !guestInfo.country) {
      setBookingError('Vui lòng điền đầy đủ thông tin bắt buộc của khách chính.');
      document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(guestInfo.email.trim())) {
      setBookingError('Email của khách chính không hợp lệ.');
      document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const guestCount = adultCount + childCount;
    setBookingBusy(true); setBookingError('');
    try {
      const contactNote = [`Khách chính: ${guestInfo.firstName.trim()} ${guestInfo.lastName.trim()}`, `Email: ${guestInfo.email.trim()}`, guestInfo.phone.trim() ? `Điện thoại: ${guestInfo.countryCode} ${guestInfo.phone.trim()}` : '', `Quốc gia cư trú: ${guestInfo.country}`, guestInfo.arrivalTime ? `Giờ nhận phòng dự kiến: ${guestInfo.arrivalTime}` : 'Giờ nhận phòng dự kiến: Chưa biết'].filter(Boolean).join('\n');
      const result = await bookingApi.createVnPayPayment({ roomTypeId: selectedRoom.id, checkInDate: arrival, checkOutDate: departure, adultCount, childCount, quantity: roomQuantity, customerNote: contactNote });
      window.location.assign(result.paymentUrl);
    } catch (error) { setBookingError(error.message); setBookingBusy(false); }
  };

  if (selectedRoom && showPaymentPage) {
    const roomIndex = Math.max(0, data.roomTypes.findIndex((room) => room.id === selectedRoom.id));
    const guestCount = adultCount + childCount;
    const countdown = `${String(Math.floor(paymentSecondsLeft / 60)).padStart(2, '0')}:${String(paymentSecondsLeft % 60).padStart(2, '0')}`;
    const formatDate = (value) => new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
    return <main className="payment-page">
      <CustomerNav active="homestays" user={user} onHome={onHome} onHomestays={onBack} onBookings={onBookings} onAccount={onAccount} />
      <div className={`payment-countdown ${paymentSecondsLeft <= 60 ? 'urgent' : ''}`} role="timer" aria-live="polite"><span>{paymentSecondsLeft > 0 ? 'Chúng tôi đang giữ giá cho quý khách...' : 'Thời gian giữ giá đã hết'}</span><i>◷</i><strong>{countdown}</strong></div>
      <nav className="room-breadcrumb" aria-label="Đường dẫn trang"><button onClick={onHome}>Trang chủ</button><span>›</span><button onClick={onBack}>Homestay</button><span>›</span><button onClick={() => setShowPaymentPage(false)}>{selectedRoom.name}</button><span>›</span><strong>Thanh toán</strong></nav>
      <section className="payment-shell">
        <button className="room-back-button" onClick={() => { setShowPaymentPage(false); window.scrollTo(0, 0); }}>← Quay lại thông tin phòng</button>
        <header><small>XÁC NHẬN ĐẶT PHÒNG</small><h1>Thanh toán đơn đặt phòng</h1><p>Kiểm tra thông tin trước khi chuyển sang cổng thanh toán VNPay.</p></header>
        <div className="payment-layout">
          <div className="payment-main">
            <section className="payment-card payment-stay-card"><img src={roomFallbacks[roomIndex % roomFallbacks.length]} alt={selectedRoom.name} /><div><small>{data.name}</small><h2>{selectedRoom.name}</h2><p>♙ {guestCount} khách &nbsp; · &nbsp; ▰ {selectedRoom.bedType} &nbsp; · &nbsp; △ {selectedRoom.roomSize || '—'} m²</p></div></section>
            <section className="payment-card"><h2>Thông tin lưu trú</h2><div className="payment-dates"><div><small>NHẬN PHÒNG</small><strong>{formatDate(arrival)}</strong><span>Từ {data.checkInTime.slice(0, 5)}</span></div><b>{bookingNights} đêm →</b><div><small>TRẢ PHÒNG</small><strong>{formatDate(departure)}</strong><span>Trước {data.checkOutTime.slice(0, 5)}</span></div></div></section>
            <section className="payment-card payment-guest-card">
              <h2>Ai là khách chính?</h2><p className="payment-required">* Mục bắt buộc</p>
              <div className="payment-form-grid">
                <label><span>Tên *</span><input maxLength={50} autoComplete="given-name" value={guestInfo.firstName} onChange={updateGuestInfo('firstName')} placeholder="Tên" /></label>
                <label><span>Họ *</span><input maxLength={50} autoComplete="family-name" value={guestInfo.lastName} onChange={updateGuestInfo('lastName')} placeholder="Họ (vd: Nguyễn)" /></label>
                <label><span>Email *</span><input type="email" maxLength={120} autoComplete="email" value={guestInfo.email} onChange={updateGuestInfo('email')} placeholder="Email ID" /></label>
                <label><span>Quốc gia cư trú *</span><select value={guestInfo.country} onChange={updateGuestInfo('country')}><option>Việt Nam</option><option>Hoa Kỳ</option><option>Hàn Quốc</option><option>Nhật Bản</option><option>Khác</option></select></label>
              </div>
              <span className="payment-phone-title">Số điện thoại di động</span>
              <div className="payment-phone-row"><label><span>Mã quốc gia/vùng</span><select value={guestInfo.countryCode} onChange={updateGuestInfo('countryCode')}><option>+84</option><option>+1</option><option>+81</option><option>+82</option></select></label><label><span>Số điện thoại</span><input type="tel" maxLength={20} autoComplete="tel" value={guestInfo.phone} onChange={updateGuestInfo('phone')} placeholder="Số điện thoại di động" /></label></div>
              <p className="payment-form-help">Vui lòng đảm bảo thông tin liên hệ của quý khách là chính xác. Chúng tôi sẽ sử dụng thông tin này để gửi xác nhận và thông báo về đặt phòng.</p>
            </section>
            <section className="payment-card payment-extra-card"><h2>Thông tin lưu trú bổ sung</h2><p>Vui lòng cung cấp thông tin sau để chỗ nghỉ chuẩn bị đón tiếp bạn tốt hơn.</p><label><span>Bạn dự kiến đến nhận phòng lúc nào?</span><select value={guestInfo.arrivalTime} onChange={updateGuestInfo('arrivalTime')}><option value="">Tôi chưa biết</option><option>12:00 - 14:00</option><option>14:00 - 16:00</option><option>16:00 - 18:00</option><option>18:00 - 20:00</option><option>Sau 20:00</option></select><small>Chủ homestay sẽ được báo trước giờ đến dự kiến.</small></label></section>
            <section className="payment-card"><h2>Phương thức thanh toán</h2><label className="payment-method"><input type="radio" checked readOnly /><span className="vnpay-mark">VN<span>PAY</span></span><div><strong>Thanh toán qua VNPay</strong><small>Quét mã QR bằng ứng dụng ngân hàng hoặc ví VNPay</small></div><i>✓</i></label><p className="payment-note">Bạn sẽ được chuyển đến trang VNPay an toàn để quét mã và hoàn tất thanh toán.</p></section>
          </div>
          <aside className="payment-summary"><h2>Chi tiết thanh toán</h2><div><span>{roomQuantity} phòng × {bookingNights} đêm</span><strong>{money(quotedRoomTotal)}</strong></div>{extraAdultCount > 0 && <div><span>Phụ thu {extraAdultCount} khách thêm</span><strong>{money(quotedExtraAdultTotal)}</strong></div>}<div><span>Phí dịch vụ</span><strong>0đ</strong></div><hr /><div className="payment-grand-total"><span>Tổng thanh toán</span><strong>{money(quotedGrandTotal)}</strong></div>{bookingError && <div className="booking-error">{bookingError}</div>}<button disabled={bookingBusy || paymentSecondsLeft <= 0} onClick={payWithVnPay}>{bookingBusy ? 'Đang kết nối VNPay...' : paymentSecondsLeft <= 0 ? 'Thời gian giữ giá đã hết' : 'Tiếp tục đến VNPay →'}</button><small>🔒 Giao dịch được bảo mật bởi VNPay</small></aside>
        </div>
      </section>
    </main>;
  }

  return <main className="stay-detail-page reference-detail-page">
    <CustomerNav active="homestays" user={user} onHome={onHome} onHomestays={onBack} onBookings={onBookings} onAccount={onAccount} />
    <section className="stay-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(4,19,45,.48),rgba(4,19,45,.03)), url('${freshImageUrl(data.thumbnailUrl || data.images?.find((image) => image.isThumbnail)?.url || data.images?.[0]?.url, imageVersion) || homestayCover(data.name)}')` }}>
      <div className="stay-hero-copy"><p>HOMESTAY CAO CẤP</p><h1>{data.name}</h1><div><b>★ <span>{reviews.total ? Number(reviews.average).toFixed(1) : 'Mới'}</span></b><span>({reviews.total} đánh giá)</span><i /><span>●</span><span>{address}</span></div></div>
      <button className="photo-button" onClick={() => onDeveloping('Thư viện ảnh')}>▣ &nbsp; Xem thêm ảnh</button>
    </section>
    <section className="detail-search" aria-label="Kiểm tra phòng trống">
      <label><span>▣</span><div><small>Ngày nhận</small><input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" value={arrival} onChange={(e) => setArrival(e.target.value)} /></div></label>
      <label><span>▣</span><div><small>Ngày trả</small><input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" value={departure} min={arrival} onChange={(e) => setDeparture(e.target.value)} /></div></label>
      <label><span>♙</span><div><small>Khách và phòng</small><b>{adultCount} người lớn · {childCount} trẻ em · {roomQuantity} phòng</b></div></label>
      <button onClick={checkRooms}>Kiểm tra phòng <span>→</span></button>
    </section>
    <div className="detail-content">
      <section id="overview" className="detail-intro redesigned-intro"><div><small>KHÁM PHÁ KHÔNG GIAN</small><h2>Giới thiệu homestay</h2><p>{data.description}</p></div><aside><article><b>{data.roomTypes.length}</b><span>Loại phòng</span></article><article><b>{data.roomTypes.reduce((sum, room) => sum + room.availableRoomCount, 0)}</b><span>Phòng còn trống</span></article><article><b>{reviews.total ? Number(reviews.average).toFixed(1) : '—'}</b><span>Điểm đánh giá</span></article></aside></section>
      <section id="amenities" className="detail-box featured-amenities"><header className="section-title"><small>TRẢI NGHIỆM TIỆN NGHI</small><h2>Tiện ích nổi bật</h2><p>Mọi tiện nghi cần thiết cho một kỳ nghỉ thoải mái và trọn vẹn.</p></header><div>{amenities.map((item) => <article key={item.id}><i>{amenityIcons[item.category] || '✦'}</i><span>{item.name}<small>{item.category}</small></span></article>)}</div></section>
      <section id="rooms" className="rooms-section"><div className="rooms-heading"><div><small>LỰA CHỌN LƯU TRÚ</small><h2>Chọn căn phòng dành cho bạn</h2></div><p>Giá minh bạch · Xem chi tiết ngay trên trang</p></div><div className="detail-room-list">{data.roomTypes.map((room, index) => <article className={`detail-room-card ${selectedRoom?.id === room.id ? 'selected' : ''}`} key={room.id}>
        <img src={freshImageUrl(room.thumbnailUrl, imageVersion) || roomFallbacks[index % roomFallbacks.length]} alt={room.name} />
        <div className="room-card-shade" />
        <div className="room-card-top"><span>♙ Tối đa {room.maxAdults} người lớn · {room.maxChildren} trẻ em</span><span>{room.availableRoomCount > 0 ? `${room.availableRoomCount} phòng trống` : 'Đã hết phòng'}</span></div>
        <div className="room-copy"><h3>{room.name}</h3><div className="room-facts"><span>▰ {room.bedType}</span><span>△ {room.roomSize || '—'} m²</span></div><p>{room.description}</p></div>
        <div className="room-actions"><strong>{money(room.basePrice)} <small>/ đêm</small></strong><button className="room-book-pill" disabled={room.availableRoomCount === 0} onClick={() => openRoomDetail(room)}>{room.availableRoomCount > 0 ? 'Đặt phòng →' : 'Hết phòng'}</button></div>
      </article>)}</div></section>
      {selectedRoom && <section id="room-detail-inline" className="inline-room-detail">
        <header><div><small>CHI TIẾT PHÒNG TẠI {data.name.toUpperCase()}</small><h2>{selectedRoom.name}</h2></div><button type="button" onClick={closeRoomDetail}>Thu gọn ×</button></header>
        <div className="room-page-gallery"><img className="room-page-main-image" src={freshImageUrl(selectedRoomImages[Math.min(activeRoomImage,selectedRoomImages.length-1)]?.url, imageVersion)} alt={selectedRoomImages[Math.min(activeRoomImage,selectedRoomImages.length-1)]?.caption || selectedRoom.name} /><div className="room-page-thumbs">{selectedRoomImages.map((image, index) => <button className={index === activeRoomImage ? 'active' : ''} key={`${image.id}-${image.url}`} onClick={() => setActiveRoomImage(index)}><img src={freshImageUrl(image.url, imageVersion)} alt={image.caption || `Xem ảnh ${index + 1}`} /></button>)}</div></div>
        <div className="room-page-layout">
          <article className="room-page-info"><div className="room-page-facts"><span>♙ {selectedRoom.maxCapacity || selectedRoom.maxAdults + selectedRoom.maxChildren} khách</span><span>▰ {selectedRoom.bedType}</span><span>△ {selectedRoom.roomSize || '—'} m²</span></div><p>{selectedRoom.description} Không gian được thiết kế ấm cúng, nhiều ánh sáng tự nhiên và đầy đủ tiện nghi cho một kỳ nghỉ thoải mái.</p><hr /><h2>Tiện nghi trong phòng</h2><ul className="room-page-amenities"><li>WiFi tốc độ cao miễn phí</li><li>Máy điều hòa</li><li>Phòng tắm riêng &amp; nước nóng</li><li>TV màn hình phẳng</li><li>Ấm đun nước và minibar</li><li>{selectedRoom.name.toLowerCase().includes('ban công') ? 'Ban công riêng, nhìn ra thành phố' : 'Dọn phòng hằng ngày'}</li></ul><hr /><h2>Chính sách phòng</h2><div className="room-page-policy"><p><b>Nhận phòng</b><span>Từ {data.checkInTime.slice(0, 5)}</span></p><p><b>Trả phòng</b><span>Trước {data.checkOutTime.slice(0, 5)}</span></p><p><b>Hủy phòng</b><span>Miễn phí trước 7 ngày; trong 7 ngày phí 50%</span></p></div></article>
          <aside className="room-page-booking">
            <small>GIÁ PHÒNG</small><div><strong>{money(selectedRoom.basePrice)}</strong><span>/ phòng / đêm</span></div><p>✓ {selectedRoom.availableRoomCount} phòng đang còn trống</p>
            <label>Ngày nhận<input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" min={new Date().toISOString().slice(0,10)} value={arrival} onChange={e=>{setArrival(e.target.value);setBookingError('')}}/></label>
            <label>Ngày trả<input type="date" lang="vi-VN" placeholder="dd/mm/yyyy" min={arrival||new Date().toISOString().slice(0,10)} value={departure} onChange={e=>{setDeparture(e.target.value);setBookingError('')}}/></label>
            <div className="guest-booking-control"><span>Người lớn</span><GuestCounter value={adultCount} min={1} max={Math.max(1,bookingGuestMax-childCount)} onChange={value=>{setAdultCount(value);setBookingError('')}}/></div>
            <div className="guest-booking-control"><span>Trẻ em</span><GuestCounter value={childCount} min={0} max={Math.max(0,bookingGuestMax-adultCount)} onChange={value=>{setChildCount(value);setBookingError('')}}/></div>
            <small className="capacity-note">Tối đa {bookingGuestMax} khách · {selectedRoom.extraGuestAllowed&&selectedRoom.maxCapacity>selectedRoom.baseCapacity?`+${money(selectedRoom.extraGuestFee)}/khách từ khách thứ ${selectedRoom.baseCapacity+1}`:`Giá gồm tối đa ${selectedRoom.baseCapacity||bookingGuestMax} khách/phòng`}</small>
            <label>Số phòng<select value={roomQuantity} onChange={e=>{const quantity=Number(e.target.value);const limit=((selectedRoom.extraGuestAllowed?selectedRoom.maxCapacity:selectedRoom.baseCapacity)||selectedRoom.maxAdults+selectedRoom.maxChildren)*quantity;setRoomQuantity(quantity);setAdultCount(value=>Math.min(value,limit));setChildCount(0);setBookingError('')}}>{Array.from({length:Math.min(selectedRoom.availableRoomCount,10)},(_,i)=>i+1).map(value=><option key={value}>{value}</option>)}</select></label>
            {bookingNights>0&&<div className="booking-price-breakdown"><div><span>Tiền phòng</span><strong>{money(roomPriceTotal)}</strong></div>{extraAdultCount>0&&<div><span>Thêm {extraAdultCount} khách</span><strong>+ {money(extraAdultTotal)}</strong></div>}<div className="booking-total"><span>Tổng cộng</span><strong>{money(bookingGrandTotal)}</strong></div></div>}
            {bookingError&&<div className="booking-error">{bookingError}</div>}<button disabled={selectedRoom.availableRoomCount===0} onClick={openPaymentPage}>{selectedRoom.availableRoomCount>0?'Đến trang thanh toán →':'Phòng đã hết'}</button><em>Chưa phát sinh giao dịch ở bước này</em>
          </aside>
        </div>
      </section>}
      <section id="policy" className="detail-box policy-section"><header className="section-title"><small>THÔNG TIN CẦN BIẾT</small><h2>Chính sách homestay</h2></header><div className="policy-grid">
        <article><i>◷</i><div><b>Nhận phòng</b><strong>Từ {data.checkInTime.slice(0, 5)}</strong><small>Vui lòng xuất trình giấy tờ tùy thân</small></div></article>
        <article><i>◷</i><div><b>Trả phòng</b><strong>Trước {data.checkOutTime.slice(0, 5)}</strong><small>Hỗ trợ trả phòng linh hoạt (khi có thể)</small></div></article>
          <article><i>▤</i><div><b>Hủy phòng</b><strong>Miễn phí hủy trước ít nhất 7 ngày</strong><small>Hủy trong vòng 7 ngày trước nhận phòng: phí 50% số tiền đã thanh toán.</small></div></article>
        <article><i>♢</i><div><b>Quy định chung</b><ul><li>Không hút thuốc trong phòng</li><li>Không mang thú cưng</li><li>Giữ yên tĩnh sau 22:00</li></ul></div></article>
      </div></section>
      <section id="location" className="detail-box location-section"><div><small>KHÁM PHÁ KHU VỰC</small><h2>Vị trí thuận tiện</h2><strong>● &nbsp; {address}</strong><p>Nằm ngay trung tâm {data.ward || data.district}, dễ dàng di chuyển đến bãi biển, chợ đêm và các điểm tham quan nổi tiếng.</p><a href={`https://www.google.com/maps/search/?api=1&query=${data.latitude || ''},${data.longitude || ''}`} target="_blank" rel="noreferrer">Mở Google Maps &nbsp; →</a></div><div className="map-visual"><span className="map-water">Bãi biển</span><div className="map-road" /><b>●<small>{data.name}</small></b><em>{data.ward || data.district}</em></div></section>
      <section id="reviews" className="detail-box review-section"><header className="section-title review-title"><div><small>CẢM NHẬN TỪ KHÁCH</small><h2>Đánh giá thực tế</h2></div>{reviews.total > 0 && <button onClick={() => setShowAllReviews(true)}>Xem tất cả {reviews.total} đánh giá →</button>}</header><div className="review-layout"><div className="rating-total"><strong>{reviews.total ? Number(reviews.average).toFixed(1) : '—'} <small>/ 5</small></strong><span>{'★'.repeat(Math.round(reviews.average || 0))}{'☆'.repeat(5 - Math.round(reviews.average || 0))}</span><small>{reviews.total} đánh giá</small></div><div className="rating-bars">{[5,4,3,2,1].map((star) => { const count = reviews.distribution.find((x) => x.rating === star)?.count || 0; const value = reviews.total ? Math.round(count * 100 / reviews.total) : 0; return <div key={star}><span>{star} sao</span><i><b style={{ width: `${value}%` }} /></i><small>{value}%</small></div>; })}</div><div className="review-list">{reviews.items.length ? reviews.items.slice(0, 1).map((review) => <blockquote key={review.id}><p>{review.comment || 'Khách hàng không để lại nội dung.'}</p><footer><span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span><div><strong>{review.customerName}</strong><small>{new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</small></div><em>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</em></footer>{review.hostReply && <div className="host-review-reply"><b>Phản hồi từ chủ homestay</b><p>{review.hostReply}</p></div>}</blockquote>) : <p className="empty-reviews">Homestay chưa có đánh giá.</p>}</div></div>{['Customer', 'Host'].includes(user?.role) && reviewBookings.length > 0 && <form className="review-form" onSubmit={submitReview}><h3>Chia sẻ trải nghiệm của bạn</h3><select required value={reviewForm.bookingId} onChange={(e) => setReviewForm({ ...reviewForm, bookingId: e.target.value })}><option value="">Chọn đơn đã hoàn thành</option>{reviewBookings.map((booking) => <option value={booking.id} key={booking.id}>{booking.bookingCode} · trả phòng {booking.checkOutDate}</option>)}</select><select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>{[5,4,3,2,1].map((rating) => <option value={rating} key={rating}>{rating} sao</option>)}</select><textarea maxLength="1000" rows="4" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Điều gì khiến kỳ nghỉ của bạn đáng nhớ?" /><button type="submit">Gửi đánh giá</button>{reviewMessage && <p>{reviewMessage}</p>}</form>}</section>
    </div>
    {showAllReviews && <div className="reviews-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAllReviews(false); }}>
      <section className="reviews-modal" role="dialog" aria-modal="true" aria-label="Tất cả đánh giá">
        <button className="reviews-modal-close" onClick={() => setShowAllReviews(false)} aria-label="Đóng">×</button>
        <aside className="reviews-modal-summary"><div className="reviews-modal-heading"><small>ĐÁNH GIÁ CỦA KHÁCH VỀ</small><h2>{data.name}</h2></div><div className="reviews-score"><strong>{reviews.total ? Number(reviews.average).toFixed(1) : '—'}</strong><span>/ 5</span><em>{'★'.repeat(Math.round(reviews.average || 0))}{'☆'.repeat(5 - Math.round(reviews.average || 0))}</em><p>{reviews.total} đánh giá đã xác thực</p></div><div className="reviews-modal-bars">{[5,4,3,2,1].map((star) => { const count = reviews.distribution.find((x) => x.rating === star)?.count || 0; const value = reviews.total ? Math.round(count * 100 / reviews.total) : 0; return <button key={star} className={reviewRatingFilter === star ? 'active' : ''} onClick={() => changeReviewFilters(() => setReviewRatingFilter(reviewRatingFilter === star ? 0 : star))}><span>{star} sao</span><i><b style={{ width: `${value}%` }} /></i><small>{count}</small></button>; })}</div><div className="reviews-amenity-overview">{amenities.slice(0, 6).map((item) => <button key={item.id} className={reviewAmenityFilter === item.name ? 'active' : ''} onClick={() => changeReviewFilters(() => setReviewAmenityFilter(reviewAmenityFilter === item.name ? '' : item.name))}><span>{item.name}</span><b>{reviewAmenityFilter === item.name ? '✓' : 'Có sẵn'}</b></button>)}</div></aside>
        <div className="reviews-modal-main"><section className="reviews-filter-section"><h3>Bộ lọc</h3><div className="reviews-filters"><label><span>Phản hồi</span><select value={reviewReplyFilter} onChange={(e) => changeReviewFilters(() => setReviewReplyFilter(e.target.value))}><option value="all">Tất cả ({reviews.total})</option><option value="replied">Có phản hồi chủ nhà</option><option value="not-replied">Chưa có phản hồi</option></select></label><label><span>Điểm đánh giá</span><select value={reviewRatingFilter} onChange={(e) => changeReviewFilters(() => setReviewRatingFilter(Number(e.target.value)))}><option value="0">Tất cả mức sao</option>{[5,4,3,2,1].map((star) => <option value={star} key={star}>{star} sao</option>)}</select></label><label><span>Tiện ích được nhắc</span><select value={reviewAmenityFilter} onChange={(e) => changeReviewFilters(() => setReviewAmenityFilter(e.target.value))}><option value="">Tất cả tiện ích</option>{reviewAmenityOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Thời gian</span><select value={reviewTimeFilter} onChange={(e) => changeReviewFilters(() => setReviewTimeFilter(e.target.value))}><option value="all">Tất cả thời gian</option><option value="year">Trong 1 năm</option><option value="month">Trong 1 tháng</option></select></label></div><div className="reviews-search"><input value={reviewSearch} onChange={(e) => changeReviewFilters(() => setReviewSearch(e.target.value))} placeholder="Tìm theo tên khách hoặc nội dung đánh giá" /><button>Tìm</button></div></section><header><div><h2>Đánh giá của khách ({filteredReviews.length})</h2></div><label>Sắp xếp theo:<select value={reviewSort} onChange={(e) => { setReviewSort(e.target.value); setReviewPage(1); }}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="highest">Điểm cao nhất</option><option value="lowest">Điểm thấp nhất</option></select></label></header><div className="reviews-modal-list">{visibleReviews.map((review) => <article key={review.id}><header><span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span><div><strong>{review.customerName}</strong><small>Ngày đánh giá: {new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</small></div><em>{review.rating},0</em></header><p>{review.comment || 'Khách hàng không để lại nội dung.'}</p>{review.hostReply && <div className="host-review-reply"><b>Phản hồi từ chủ homestay</b><p>{review.hostReply}</p></div>}</article>)}{visibleReviews.length === 0 && <div className="reviews-empty"><b>Không tìm thấy đánh giá</b><span>Hãy thử thay đổi bộ lọc.</span></div>}</div><footer className="reviews-pagination"><button disabled={reviewPage <= 1} onClick={() => setReviewPage((page) => page - 1)}>← Trước</button><span>Trang {Math.min(reviewPage, reviewPageCount)} / {reviewPageCount}</span><button disabled={reviewPage >= reviewPageCount} onClick={() => setReviewPage((page) => page + 1)}>Sau →</button></footer></div>
      </section>
    </div>}
    <section className="review-highlights"><header><div><small>CẢM NHẬN TỪ KHÁCH</small><h2>Đọc xem khách yêu thích điều gì nhất</h2></div>{reviews.total > 0 && <button onClick={() => setShowAllReviews(true)}>Đọc tất cả {reviews.total} đánh giá</button>}</header><div className="review-highlights-shell"><button className="review-arrow previous" aria-label="Đánh giá trước" onClick={() => document.querySelector('.review-highlights-track')?.scrollBy({ left: -390, behavior: 'smooth' })}>‹</button><div className="review-highlights-track">{reviews.items.length ? reviews.items.slice(0, 6).map((review) => <article key={review.id}><header><span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-1).join('').toUpperCase()}</span><div><strong>{review.customerName}</strong><small>🇻🇳 Việt Nam</small></div><em>{review.rating},0</em></header><p>“{review.comment || 'Khách hàng hài lòng với kỳ nghỉ tại homestay.'}”</p>{review.hostReply && <small className="review-replied">✓ Chủ homestay đã phản hồi</small>}<button onClick={() => setShowAllReviews(true)}>Tìm hiểu thêm</button></article>) : <p className="empty-reviews">Homestay chưa có đánh giá.</p>}</div><button className="review-arrow next" aria-label="Đánh giá tiếp theo" onClick={() => document.querySelector('.review-highlights-track')?.scrollBy({ left: 390, behavior: 'smooth' })}>›</button></div></section>
    <section className="detail-closing"><span>✦</span><p>Du khách tìm kiếm những trải nghiệm <em>độc bản</em> và<br/><em>giàu cảm hứng</em> sẽ tìm thấy sự tinh tế tại</p><h2>{data.name}</h2><small>TRỌN VẸN · TIN CẬY · TẬN TÂM</small></section>
    <footer className="detail-footer"><div><a className="detail-footer-logo" href="#top" onClick={(event)=>{event.preventDefault();onHome()}}>tripio</a><p>Nơi mỗi chuyến đi trở thành một trải nghiệm đáng nhớ. Tận hưởng kỳ nghỉ riêng tư, tiện nghi và đầy cảm hứng.</p></div><div><b>TRẢI NGHIỆM</b><button onClick={onBack}>Khám phá Homestay</button><button onClick={()=>document.getElementById('rooms')?.scrollIntoView({behavior:'smooth'})}>Chọn phòng</button></div><div><b>THÔNG TIN</b><button onClick={()=>document.getElementById('policy')?.scrollIntoView({behavior:'smooth'})}>Chính sách</button><button onClick={()=>document.getElementById('reviews')?.scrollIntoView({behavior:'smooth'})}>Đánh giá</button></div><div><b>LIÊN HỆ</b><p>{address}</p><p>tripio@gmail.com</p></div></footer>
  </main>;
}
