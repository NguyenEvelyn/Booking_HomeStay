import React, { useEffect, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { recommendationSessionId, recordRecommendationEvent } from '../api/recommendationEvents.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import GuestPickerDropdown from '../../../shared/components/GuestPickerDropdown.jsx';
import { freshImageUrl } from '../../../shared/utils/freshImageUrl.js';
import { bookingApi } from '../../bookings/api/bookingApi.js';
import pineHomestayImage from '../../../../assets/f6cd6879081dc8e8d4ff18669308ea86.jpg';
import azureHomestayImage from '../../../../assets/ecf184f6b6cd2b6e2aa898ff3195ab7e.jpg';
import sunsetHomestayImage from '../../../../assets/2fc6b619bb0af3dc94971c099d25bbae.jpg';
import deluxeRoomImage from '../../../../assets/be402600cc69b6c03f813e85453be7ff.jpg';
import familySuiteImage from '../../../../assets/9831323b9ec25a6c954800c1a66de2ff.jpg';
import gardenViewRoomImage from '../../../../assets/351637f1124ce334062731a57eec77ac.jpg';

const money = (value) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
function QuantityStepper({ label, value, min, max, onChange }) {
  return <div className="booking-quantity">
    <span>{label}</span>
    <div role="group" aria-label={label}>
      <button type="button" aria-label={`Giảm ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`Tăng ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  </div>;
}
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

function Icon({ name, size = 16, className = '', color = 'currentColor', fill = 'none' }) {
  const icons = {
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    heart: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    ),
    calendar: (
      <>
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    star: (
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill="#FFB700"
        stroke="#FFB700"
      />
    ),
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    fileText: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>
    ),
    shield: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
    bed: (
      <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
    ),
    maximize: (
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    ),
    wifi: (
      <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
    ),
    car: (
      <>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </>
    ),
    snowflake: (
      <>
        <line x1="12" y1="2" x2="12" y2="22" />
        <line x1="17" y1="5" x2="7" y2="19" />
        <line x1="7" y1="5" x2="17" y2="19" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </>
    ),
    balcony: (
      <path d="M4 10h16v11H4zM4 14h16M8 10v11M12 10v11M16 10v11M2 10h20" />
    ),
    paw: (
      <>
        <circle cx="11" cy="4" r="2" />
        <circle cx="18" cy="8" r="2" />
        <circle cx="20" cy="16" r="2" />
        <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.8 1.2L6 16a4 4 0 0 1 3-6z" />
      </>
    ),
    pool: (
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    ),
    kitchen: (
      <path d="M18 2v20M6 2v20M2 6h8M2 10h8M14 6h8M14 10h8" />
    ),
    sparkles: (
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" />
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      {icons[name] || null}
    </svg>
  );
}

function getAmenitySvg(name = '', category = '') {
  const lower = (name + ' ' + category).toLowerCase();
  if (lower.includes('wifi') || lower.includes('mạng') || lower.includes('internet')) return <Icon name="wifi" size={24} />;
  if (lower.includes('xe') || lower.includes('đỗ') || lower.includes('parking')) return <Icon name="car" size={24} />;
  if (lower.includes('điều hòa') || lower.includes('lạnh') || lower.includes('ac')) return <Icon name="snowflake" size={24} />;
  if (lower.includes('ban công') || lower.includes('view') || lower.includes('sân')) return <Icon name="balcony" size={24} />;
  if (lower.includes('vật nuôi') || lower.includes('pet') || lower.includes('chó') || lower.includes('mèo')) return <Icon name="paw" size={24} />;
  if (lower.includes('bơi') || lower.includes('hồ')) return <Icon name="pool" size={24} />;
  if (lower.includes('bếp') || lower.includes('ăn')) return <Icon name="kitchen" size={24} />;
  return <Icon name="sparkles" size={24} />;
}

export default function HomestayDetailPage({ id, refreshKey = 0, initialSearch, user, onHome, onBack, onBookings, onAccount, onDeveloping }) {
  const [data, setData] = useState(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [error, setError] = useState('');
  const [arrival, setArrival] = useState(initialSearch?.checkIn || '');
  const [departure, setDeparture] = useState(initialSearch?.checkOut || '');
  const [adultCount, setAdultCount] = useState(initialSearch?.adults || initialSearch?.guests || 2);
  const [childCount, setChildCount] = useState(initialSearch?.children || 0);
  const [roomQuantity, setRoomQuantity] = useState(initialSearch?.rooms || 1);
  const [availableRoomTypes, setAvailableRoomTypes] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
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
  const [isSaved, setIsSaved] = useState(() => {
    try {
      return localStorage.getItem(`saved_homestay_${id}`) === 'true';
    } catch {
      return false;
    }
  });
  const toggleSave = () => {
    setIsSaved((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`saved_homestay_${id}`, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const viewedId = useRef(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    homestayApi.detail(id).then((result) => {
      setImageVersion(`${Date.now()}-${refreshKey}`); setData(result);
      if (viewedId.current !== id) {
        viewedId.current = id;
        recordRecommendationEvent({ eventType: 'view', homestayId: Number(id) });
      }
    }).catch((e) => setError(e.message));
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
  const coverUrl = (data.images && data.images.length > 0)
    ? freshImageUrl(data.thumbnailUrl || data.images.find((img) => img.isThumbnail)?.url || data.images[0]?.url, imageVersion)
    : homestayCover(data.name);
  const lowestPrice = (data.roomTypes && data.roomTypes.length > 0)
    ? Math.min(...data.roomTypes.map((room) => room.basePrice))
    : 0;
  const formattedLowestPrice = lowestPrice > 0
    ? `${new Intl.NumberFormat('vi-VN').format(lowestPrice)} VND`
    : 'Đang cập nhật';
  const ratingNumber = reviews.total
    ? Number(reviews.average).toFixed(1).replace('.', ',')
    : (data.averageRating ? Number(data.averageRating).toFixed(1).replace('.', ',') : '4,8');
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
  const checkRooms = async () => {
    if (!arrival || !departure) {
      setAvailabilityError('Chọn ngày nhận và trả phòng để kiểm tra phòng trống.');
      document.querySelector('.detail-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (departure <= arrival) {
      setAvailabilityError('Ngày trả phòng phải sau ngày nhận phòng.');
      return;
    }
    setCheckingAvailability(true);
    setAvailabilityError('');
    try {
      const response = await homestayApi.availability(id, { checkIn: arrival, checkOut: departure,
        guests: adultCount + childCount, rooms: roomQuantity });
      setAvailableRoomTypes(new Map(response.items.map((item) => [item.roomTypeId, item.availableRooms])));
      document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { setAvailableRoomTypes(null); setAvailabilityError(e.message); }
    finally { setCheckingAvailability(false); }
  };
  const openRoomDetail = async (room) => {
    const availableCount = availableRoomTypes?.get(room.id) ?? room.availableRoomCount;
    const availableQuantity = Math.max(1, Math.min(roomQuantity, availableCount || 1));
    setSelectedRoom({ ...room, availableRoomCount: availableCount }); setShowPaymentPage(false); setActiveRoomImage(0); setRoomQuantity(availableQuantity);
    const limit = ((room.extraGuestAllowed ? room.maxCapacity : room.baseCapacity) || room.maxAdults + room.maxChildren) * availableQuantity;
    const nextAdults = Math.max(1, Math.min(adultCount, limit));
    setAdultCount(nextAdults);
    setChildCount(Math.max(0, Math.min(childCount, limit - nextAdults)));
    window.setTimeout(() => document.getElementById('room-detail-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try { const detail = await homestayApi.roomTypeDetail(room.id); setSelectedRoom((current) => current?.id === room.id ? { ...current, ...detail, availableRoomCount: availableCount } : current); } catch { /* giữ dữ liệu danh sách nếu tải gallery thất bại */ }
  };
  const closeRoomDetail = () => { setSelectedRoom(null); setShowPaymentPage(false); window.setTimeout(() => document.querySelector('.rooms-section')?.scrollIntoView({ behavior: 'smooth' }), 0); };
  const bookingNights = arrival && departure ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000)) : 0;
  const bookingGuestMax = selectedRoom ? ((selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity) || selectedRoom.maxAdults + selectedRoom.maxChildren) * roomQuantity : 1;
  const includedGuestCount = selectedRoom ? (selectedRoom.baseCapacity || Math.min(2, selectedRoom.maxAdults)) * roomQuantity : 0;
  const extraGuestCount = Math.max(0, adultCount + childCount - includedGuestCount);
  const roomPriceTotal = selectedRoom ? selectedRoom.basePrice * bookingNights * roomQuantity : 0;
  const extraGuestTotal = extraGuestCount * (selectedRoom?.extraGuestFee || 0) * bookingNights;
  const extraFeeTotal = extraGuestTotal;
  const bookingGrandTotal = roomPriceTotal + extraFeeTotal;
  const quotedRoomTotal = priceQuote?.roomTotal ?? roomPriceTotal;
  const quotedExtraGuestTotal = priceQuote?.extraGuestFee ?? extraGuestTotal;
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
      const result = await bookingApi.createVnPayPayment({ roomTypeId: selectedRoom.id, checkInDate: arrival, checkOutDate: departure, adultCount, childCount, quantity: roomQuantity, customerNote: contactNote, recommendationSessionId: recommendationSessionId() });
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
          <aside className="payment-summary"><h2>Chi tiết thanh toán</h2><div><span>{roomQuantity} phòng × {bookingNights} đêm</span><strong>{money(quotedRoomTotal)}</strong></div>{extraGuestCount > 0 && <div><span>Phụ thu {extraGuestCount} khách</span><strong>{money(quotedExtraGuestTotal)}</strong></div>}<div><span>Phí dịch vụ</span><strong>0 đ</strong></div><hr /><div className="payment-grand-total"><span>Tổng thanh toán</span><strong>{money(quotedGrandTotal)}</strong></div>{bookingError && <div className="booking-error">{bookingError}</div>}<button disabled={bookingBusy || paymentSecondsLeft <= 0} onClick={payWithVnPay}>{bookingBusy ? 'Đang kết nối VNPay...' : paymentSecondsLeft <= 0 ? 'Thời gian giữ giá đã hết' : 'Tiếp tục đến VNPay →'}</button><small>🔒 Giao dịch được bảo mật bởi VNPay</small></aside>
        </div>
      </section>
    </main>;
  }

  return (
    <main className="stay-detail-page">
      <CustomerNav
        active="homestays"
        user={user}
        onHome={onHome}
        onHomestays={onBack}
        onBookings={onBookings}
        onAccount={onAccount}
        transparentAtTop={true}
      />

      <section
        className="stay-hero"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(2, 16, 40, 0.45) 0%, rgba(2, 16, 40, 0.05) 35%, rgba(2, 12, 34, 0.88) 100%), url('${coverUrl}')`,
        }}
      >
        <div className="stay-hero-content">
          <div className="stay-hero-left">
            <div className="stay-hero-title-row">
              <h1>{data.name}</h1>
              <span className="stay-hero-rating-badge">
                {ratingNumber} <span className="stay-hero-star">★</span>
              </span>
            </div>
            <div className="stay-hero-meta-row">
              <span className="stay-hero-address">
                <Icon name="location" size={16} color="#fff" />
                {address}
              </span>
              <button
                type="button"
                className={`stay-hero-save-btn ${isSaved ? 'is-saved' : ''}`}
                onClick={toggleSave}
                title={isSaved ? 'Bỏ lưu homestay' : 'Lưu homestay vào danh sách yêu thích'}
              >
                <Icon
                  name="heart"
                  size={14}
                  fill={isSaved ? '#ff4d6d' : 'none'}
                  color={isSaved ? '#ff4d6d' : '#fff'}
                />
                {isSaved ? 'Đã lưu' : 'Lưu Homestay'}
              </button>
            </div>
          </div>

          <div className="stay-hero-right">
            <span className="stay-hero-price-label">Giá phòng/đêm từ</span>
            <div className="stay-hero-price-action">
              <strong className="stay-hero-price-val">{formattedLowestPrice}</strong>
              <button type="button" className="stay-hero-choose-btn" onClick={checkRooms}>
                Chọn phòng
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating search bar matching homepage style */}
      <section className="detail-search" aria-label="Kiểm tra phòng trống">
        <label>
          Ngày nhận
          <span className="search-control">
            <input
              type="text"
              placeholder="Chọn ngày nhận"
              value={arrival}
              onChange={(e) => {
                setArrival(e.target.value);
                if (departure && departure <= e.target.value) setDeparture('');
                setAvailableRoomTypes(null);
                setSelectedRoom(null);
              }}
              onFocus={(e) => { e.currentTarget.type = 'date'; }}
              onBlur={(e) => { if (!e.currentTarget.value) e.currentTarget.type = 'text'; }}
            />
            <i><Icon name="calendar" size={16} /></i>
          </span>
        </label>

        <label>
          Ngày trả
          <span className="search-control">
            <input
              type="text"
              placeholder="Chọn ngày trả"
              min={arrival || undefined}
              value={departure}
              onChange={(e) => { setDeparture(e.target.value); setAvailableRoomTypes(null); setSelectedRoom(null); }}
              onFocus={(e) => { e.currentTarget.type = 'date'; }}
              onBlur={(e) => { if (!e.currentTarget.value) e.currentTarget.type = 'text'; }}
            />
            <i><Icon name="calendar" size={16} /></i>
          </span>
        </label>

        <GuestPickerDropdown
          value={{ adults: adultCount, children: childCount, rooms: roomQuantity }}
          onChange={({ adults, children, rooms }) => {
            setAdultCount(adults);
            setChildCount(children);
            setRoomQuantity(rooms);
            setAvailableRoomTypes(null);
            setSelectedRoom(null);
          }}
        />

        <button type="button" onClick={checkRooms} disabled={checkingAvailability}>
          {checkingAvailability ? 'Đang kiểm tra...' : 'Kiểm tra phòng'} <span>→</span>
        </button>
      </section>

      {availabilityError && <p className="state-message error" role="alert">{availabilityError}</p>}

      <div className="detail-content">
        <section id="overview" className="detail-intro redesigned-intro">
          <div>
            <small>KHÁM PHÁ KHÔNG GIAN</small>
            <h2>Giới thiệu homestay</h2>
            <p>{data.description}</p>
          </div>
          <aside>
            <article>
              <b>{data.roomTypes.length}</b>
              <span>Loại phòng</span>
            </article>
            <article>
              <b>{data.roomTypes.reduce((sum, room) => sum + room.availableRoomCount, 0)}</b>
              <span>Phòng còn trống</span>
            </article>
            <article>
              <b>{reviews.total ? Number(reviews.average).toFixed(1) : '—'}</b>
              <span>Điểm đánh giá</span>
            </article>
          </aside>
        </section>

        <section id="amenities" className="detail-box featured-amenities">
          <header className="section-title">
            <small>TRẢI NGHIỆM TIỆN NGHI</small>
            <h2>Tiện ích nổi bật</h2>
            <p>Mọi tiện nghi cần thiết cho một kỳ nghỉ thoải mái và trọn vẹn.</p>
          </header>
          <div>
            {amenities.map((item) => (
              <article key={item.id}>
                <i>{getAmenitySvg(item.name, item.category)}</i>
                <span>
                  {item.name}
                  <small>{item.category}</small>
                </span>
              </article>
            ))}
          </div>
        </section>

        <section id="rooms" className="rooms-section">
          <div className="rooms-heading">
            <div>
              <small>LỰA CHỌN LƯU TRÚ</small>
              <h2>Chọn căn phòng dành cho bạn</h2>
            </div>
            <p>Giá minh bạch · Xem chi tiết ngay trên trang</p>
          </div>
          <div className="detail-room-list">
            {availableRoomTypes?.size === 0 && <p className="state-message">Không còn loại phòng phù hợp trong ngày đã chọn. Hãy thử ngày khác hoặc giảm số khách/phòng.</p>}
            {data.roomTypes.filter((room) => availableRoomTypes === null || availableRoomTypes.has(room.id)).map((room, index) => (
              <article
                className={`detail-room-card ${selectedRoom?.id === room.id ? 'selected' : ''}`}
                key={room.id}
              >
                <img
                  src={freshImageUrl(room.thumbnailUrl, imageVersion) || roomFallbacks[index % roomFallbacks.length]}
                  alt={room.name}
                />
                <div className="room-card-shade" />
                <div className="room-card-top">
                  <span>
                    <Icon name="user" size={12} />
                    Tối đa {(room.extraGuestAllowed ? room.maxCapacity : room.baseCapacity) || room.maxAdults + room.maxChildren} khách
                  </span>
                  <span>{(availableRoomTypes?.get(room.id) ?? room.availableRoomCount) > 0 ? `${availableRoomTypes?.get(room.id) ?? room.availableRoomCount} phòng trống` : 'Đã hết phòng'}</span>
                </div>
                <div className="room-copy">
                  <h3>{room.name}</h3>
                  <div className="room-facts">
                    <span>
                      <Icon name="bed" size={13} />
                      {room.bedType}
                    </span>
                    <span>
                      <Icon name="maximize" size={13} />
                      {room.roomSize || '—'} m²
                    </span>
                  </div>
                  <p>{room.description}</p>
                </div>
                <div className="room-actions">
                  <strong>
                    {money(room.basePrice)} <small>/ đêm</small>
                  </strong>
                  <button
                    type="button"
                    className="room-book-pill"
                    disabled={(availableRoomTypes?.get(room.id) ?? room.availableRoomCount) === 0}
                    onClick={() => openRoomDetail(room)}
                  >
                    {(availableRoomTypes?.get(room.id) ?? room.availableRoomCount) > 0 ? 'Đặt phòng →' : 'Hết phòng'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {selectedRoom && (
          <section id="room-detail-inline" className="inline-room-detail">
            <header>
              <div>
                <small>CHI TIẾT PHÒNG TẠI {data.name.toUpperCase()}</small>
                <h2>{selectedRoom.name}</h2>
              </div>
              <button type="button" onClick={closeRoomDetail}>Thu gọn ×</button>
            </header>
            <div className="room-page-gallery">
              <img
                className="room-page-main-image"
                src={freshImageUrl(selectedRoomImages[Math.min(activeRoomImage, selectedRoomImages.length - 1)]?.url, imageVersion)}
                alt={selectedRoomImages[Math.min(activeRoomImage, selectedRoomImages.length - 1)]?.caption || selectedRoom.name}
              />
              <div className="room-page-thumbs">
                {selectedRoomImages.map((image, index) => (
                  <button
                    type="button"
                    className={index === activeRoomImage ? 'active' : ''}
                    key={`${image.id}-${image.url}`}
                    onClick={() => setActiveRoomImage(index)}
                  >
                    <img src={freshImageUrl(image.url, imageVersion)} alt={image.caption || `Xem ảnh ${index + 1}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="room-page-layout">
              <article className="room-page-info">
                <div className="room-page-facts">
                  <span>
                    <Icon name="user" size={14} />
                    {bookingGuestMax} khách
                  </span>
                  <span>
                    <Icon name="bed" size={14} />
                    {selectedRoom.bedType}
                  </span>
                  <span>
                    <Icon name="maximize" size={14} />
                    {selectedRoom.roomSize || '—'} m²
                  </span>
                </div>
                <p>
                  {selectedRoom.description} Không gian được thiết kế ấm cúng, nhiều ánh sáng tự nhiên và đầy đủ tiện nghi cho một kỳ nghỉ thoải mái.
                </p>
                <hr />
                <h2>Tiện nghi trong phòng</h2>
                <ul className="room-page-amenities">
                  <li>WiFi tốc độ cao miễn phí</li>
                  <li>Máy điều hòa</li>
                  <li>Phòng tắm riêng &amp; nước nóng</li>
                  <li>TV màn hình phẳng</li>
                  <li>Ấm đun nước và minibar</li>
                  <li>{selectedRoom.name.toLowerCase().includes('ban công') ? 'Ban công riêng, nhìn ra thành phố' : 'Dọn phòng hằng ngày'}</li>
                </ul>
                <hr />
                <h2>Chính sách phòng</h2>
                <div className="room-page-policy">
                  <p><b>Nhận phòng</b><span>Từ {data.checkInTime.slice(0, 5)}</span></p>
                  <p><b>Trả phòng</b><span>Trước {data.checkOutTime.slice(0, 5)}</span></p>
                  <p><b>Hủy phòng</b><span>Miễn phí trước 7 ngày</span></p>
                </div>
              </article>
              <aside className="room-page-booking">
                <small>GIÁ PHÒNG</small>
                <div>
                  <strong>{money(selectedRoom.basePrice)}</strong>
                  <span>/ phòng / đêm</span>
                </div>
                <p>✓ {selectedRoom.availableRoomCount} phòng đang còn trống</p>
                <label>
                  Ngày nhận
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={arrival}
                    onChange={(e) => { setArrival(e.target.value); setBookingError(''); }}
                  />
                </label>
                <label>
                  Ngày trả
                  <input
                    type="date"
                    min={arrival || new Date().toISOString().slice(0, 10)}
                    value={departure}
                    onChange={(e) => { setDeparture(e.target.value); setBookingError(''); }}
                  />
                </label>
                <div className="guest-room-fields">
                  <QuantityStepper label="Người lớn" value={adultCount} min={1} max={Math.max(1, bookingGuestMax - childCount)} onChange={(value) => { setAdultCount(value); setBookingError(''); }} />
                  <QuantityStepper label="Trẻ em" value={childCount} min={0} max={Math.max(0, bookingGuestMax - adultCount)} onChange={(value) => { setChildCount(value); setBookingError(''); }} />
                  <QuantityStepper label="Số phòng" value={roomQuantity} min={1} max={Math.max(1, Math.min(selectedRoom.availableRoomCount, 10))} onChange={(quantity) => {
                    setRoomQuantity(quantity);
                    const limit = ((selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity) || selectedRoom.maxAdults + selectedRoom.maxChildren) * quantity;
                    const nextAdults = Math.max(1, Math.min(adultCount, limit));
                    setAdultCount(nextAdults);
                    setChildCount(Math.max(0, Math.min(childCount, limit - nextAdults)));
                    setBookingError('');
                  }} />
                </div>
                <small className="capacity-note">
                  Tối đa {bookingGuestMax} khách. {selectedRoom.extraGuestAllowed && selectedRoom.maxCapacity > selectedRoom.baseCapacity
                    ? `Phụ thu ${money(selectedRoom.extraGuestFee)}/khách từ khách thứ ${selectedRoom.baseCapacity + 1} mỗi phòng.`
                    : `Giá gồm tối đa ${selectedRoom.baseCapacity || bookingGuestMax} khách/phòng.`}
                </small>
                {bookingNights > 0 && (
                  <div className="booking-price-breakdown">
                    <div><span>Tiền phòng</span><strong>{money(roomPriceTotal)}</strong></div>
                    {extraGuestCount > 0 && <div><span>Thêm {extraGuestCount} khách</span><strong>+ {money(extraGuestTotal)}</strong></div>}
                    <div className="booking-total"><span>Tổng cộng</span><strong>{money(bookingGrandTotal)}</strong></div>
                  </div>
                )}
                {bookingError && <div className="booking-error">{bookingError}</div>}
                <button
                  type="button"
                  disabled={selectedRoom.availableRoomCount === 0}
                  onClick={openPaymentPage}
                >
                  {selectedRoom.availableRoomCount > 0 ? 'Đến trang thanh toán →' : 'Phòng đã hết'}
                </button>
                <em>Chưa phát sinh giao dịch ở bước này</em>
              </aside>
            </div>
          </section>
        )}

        <section id="policy" className="detail-box policy-section">
          <header className="section-title">
            <small>THÔNG TIN CẦN BIẾT</small>
            <h2>Chính sách homestay</h2>
          </header>
          <div className="policy-grid">
            <article>
              <i><Icon name="clock" size={24} /></i>
              <div>
                <b>Nhận phòng</b>
                <strong>Từ {data.checkInTime.slice(0, 5)}</strong>
                <small>Vui lòng xuất trình giấy tờ tùy thân</small>
              </div>
            </article>
            <article>
              <i><Icon name="clock" size={24} /></i>
              <div>
                <b>Trả phòng</b>
                <strong>Trước {data.checkOutTime.slice(0, 5)}</strong>
                <small>Hỗ trợ trả phòng linh hoạt (khi có thể)</small>
              </div>
            </article>
            <article>
              <i><Icon name="fileText" size={24} /></i>
              <div>
                <b>Hủy phòng</b>
                <strong>Miễn phí hủy trước 7 ngày</strong>
                <small>Các trường hợp khác tùy theo điều kiện đặt phòng</small>
              </div>
            </article>
            <article>
              <i><Icon name="shield" size={24} /></i>
              <div>
                <b>Quy định chung</b>
                <ul>
                  <li>Không hút thuốc trong phòng</li>
                  {!data.amenities.some((amenity) => /vật nuôi|thú cưng|pet/i.test(amenity.name || '')) && <li>Không mang thú cưng</li>}
                  <li>Giữ yên tĩnh sau 22:00</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section id="location" className="detail-box location-section">
          <div>
            <small>KHÁM PHÁ KHU VỰC</small>
            <h2>Vị trí thuận tiện</h2>
            <strong>
              <Icon name="location" size={16} />
              {address}
            </strong>
            <p>
              Nằm ngay trung tâm {data.ward || data.district}, dễ dàng di chuyển đến bãi biển, chợ đêm và các điểm tham quan nổi tiếng.
            </p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${data.latitude || ''},${data.longitude || ''}`}
              target="_blank"
              rel="noreferrer"
            >
              Mở Google Maps &nbsp; →
            </a>
          </div>
          <div className="map-visual">
            <span className="map-water">Bãi biển</span>
            <div className="map-road" />
            <b>
              <Icon name="location" size={22} color="#0b4ae6" />
              <small>{data.name}</small>
            </b>
            <em>{data.ward || data.district}</em>
          </div>
        </section>

        <section id="reviews" className="detail-box review-section">
          <header className="section-title review-title">
            <div>
              <small>CẢM NHẬN TỪ KHÁCH</small>
              <h2>Đánh giá thực tế</h2>
            </div>
            {reviews.total > 0 && (
              <button type="button" onClick={() => setShowAllReviews(true)}>
                Xem tất cả {reviews.total} đánh giá →
              </button>
            )}
          </header>
          <div className="review-layout">
            <div className="rating-total">
              <strong>{reviews.total ? Number(reviews.average).toFixed(1) : '—'} <small>/ 5</small></strong>
              <span>{'★'.repeat(Math.round(reviews.average || 0))}{'☆'.repeat(5 - Math.round(reviews.average || 0))}</span>
              <small>{reviews.total} đánh giá</small>
            </div>
            <div className="rating-bars">
              {[5,4,3,2,1].map((star) => {
                const count = reviews.distribution.find((x) => x.rating === star)?.count || 0;
                const value = reviews.total ? Math.round(count * 100 / reviews.total) : 0;
                return (
                  <div key={star}>
                    <span>{star} sao</span>
                    <i><b style={{ width: `${value}%` }} /></i>
                    <small>{value}%</small>
                  </div>
                );
              })}
            </div>
            <div className="review-list">
              {reviews.items.length ? (
                reviews.items.slice(0, 1).map((review) => (
                  <blockquote key={review.id}>
                    <p>{review.comment || 'Khách hàng không để lại nội dung.'}</p>
                    <footer>
                      <span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span>
                      <div>
                        <strong>{review.customerName}</strong>
                        <small>{new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</small>
                      </div>
                      <em>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</em>
                    </footer>
                    {review.hostReply && (
                      <div className="host-review-reply">
                        <b>Phản hồi từ chủ homestay</b>
                        <p>{review.hostReply}</p>
                      </div>
                    )}
                  </blockquote>
                ))
              ) : (
                <p className="empty-reviews">Homestay chưa có đánh giá.</p>
              )}
            </div>
          </div>
          {['Customer', 'Host'].includes(user?.role) && reviewBookings.length > 0 && (
            <form className="review-form" onSubmit={submitReview}>
              <h3>Chia sẻ trải nghiệm của bạn</h3>
              <select required value={reviewForm.bookingId} onChange={(e) => setReviewForm({ ...reviewForm, bookingId: e.target.value })}>
                <option value="">Chọn đơn đã hoàn thành</option>
                {reviewBookings.map((booking) => (
                  <option value={booking.id} key={booking.id}>
                    {booking.bookingCode} · trả phòng {booking.checkOutDate}
                  </option>
                ))}
              </select>
              <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>
                {[5,4,3,2,1].map((rating) => (
                  <option value={rating} key={rating}>{rating} sao</option>
                ))}
              </select>
              <textarea maxLength="1000" rows="4" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="Điều gì khiến kỳ nghỉ của bạn đáng nhớ?" />
              <button type="submit">Gửi đánh giá</button>
              {reviewMessage && <p>{reviewMessage}</p>}
            </form>
          )}
        </section>
      </div>
      {showAllReviews && <div className="reviews-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAllReviews(false); }}>
        <section className="reviews-modal" role="dialog" aria-modal="true" aria-label="Tất cả đánh giá">
          <button className="reviews-modal-close" onClick={() => setShowAllReviews(false)} aria-label="Đóng">×</button>
          <aside className="reviews-modal-summary"><div className="reviews-modal-heading"><small>ĐÁNH GIÁ CỦA KHÁCH VỀ</small><h2>{data.name}</h2></div><div className="reviews-score"><strong>{reviews.total ? Number(reviews.average).toFixed(1) : '—'}</strong><span>/ 5</span><em>{'★'.repeat(Math.round(reviews.average || 0))}{'☆'.repeat(5 - Math.round(reviews.average || 0))}</em><p>{reviews.total} đánh giá đã xác thực</p></div><div className="reviews-modal-bars">{[5,4,3,2,1].map((star) => { const count = reviews.distribution.find((x) => x.rating === star)?.count || 0; const value = reviews.total ? Math.round(count * 100 / reviews.total) : 0; return <button key={star} className={reviewRatingFilter === star ? 'active' : ''} onClick={() => changeReviewFilters(() => setReviewRatingFilter(reviewRatingFilter === star ? 0 : star))}><span>{star} sao</span><i><b style={{ width: `${value}%` }} /></i><small>{count}</small></button>; })}</div><div className="reviews-amenity-overview">{amenities.slice(0, 6).map((item) => <button key={item.id} className={reviewAmenityFilter === item.name ? 'active' : ''} onClick={() => changeReviewFilters(() => setReviewAmenityFilter(reviewAmenityFilter === item.name ? '' : item.name))}><span>{item.name}</span><b>{reviewAmenityFilter === item.name ? '✓' : 'Có sẵn'}</b></button>)}</div></aside>
          <div className="reviews-modal-main"><section className="reviews-filter-section"><h3>Bộ lọc</h3><div className="reviews-filters"><label><span>Phản hồi</span><select value={reviewReplyFilter} onChange={(e) => changeReviewFilters(() => setReviewReplyFilter(e.target.value))}><option value="all">Tất cả ({reviews.total})</option><option value="replied">Có phản hồi chủ nhà</option><option value="not-replied">Chưa có phản hồi</option></select></label><label><span>Điểm đánh giá</span><select value={reviewRatingFilter} onChange={(e) => changeReviewFilters(() => setReviewRatingFilter(Number(e.target.value)))}><option value="0">Tất cả mức sao</option>{[5,4,3,2,1].map((star) => <option value={star} key={star}>{star} sao</option>)}</select></label><label><span>Tiện ích được nhắc</span><select value={reviewAmenityFilter} onChange={(e) => changeReviewFilters(() => setReviewAmenityFilter(e.target.value))}><option value="">Tất cả tiện ích</option>{reviewAmenityOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Thời gian</span><select value={reviewTimeFilter} onChange={(e) => changeReviewFilters(() => setReviewTimeFilter(e.target.value))}><option value="all">Tất cả thời gian</option><option value="year">Trong 1 năm</option><option value="month">Trong 1 tháng</option></select></label></div><div className="reviews-search"><input value={reviewSearch} onChange={(e) => changeReviewFilters(() => setReviewSearch(e.target.value))} placeholder="Tìm theo tên khách hoặc nội dung đánh giá" /><button>Tìm</button></div></section><header><div><h2>Đánh giá của khách ({filteredReviews.length})</h2></div><label>Sắp xếp theo:<select value={reviewSort} onChange={(e) => { setReviewSort(e.target.value); setReviewPage(1); }}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="highest">Điểm cao nhất</option><option value="lowest">Điểm thấp nhất</option></select></label></header><div className="reviews-modal-list">{visibleReviews.map((review) => <article key={review.id}><header><span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span><div><strong>{review.customerName}</strong><small>Ngày đánh giá: {new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</small></div><em>{review.rating},0</em></header><p>{review.comment || 'Khách hàng không để lại nội dung.'}</p>{review.hostReply && <div className="host-review-reply"><b>Phản hồi từ chủ homestay</b><p>{review.hostReply}</p></div>}</article>)}{visibleReviews.length === 0 && <div className="reviews-empty"><b>Không tìm thấy đánh giá</b><span>Hãy thử thay đổi bộ lọc.</span></div>}</div><footer className="reviews-pagination"><button disabled={reviewPage <= 1} onClick={() => setReviewPage((page) => page - 1)}>← Trước</button><span>Trang {Math.min(reviewPage, reviewPageCount)} / {reviewPageCount}</span><button disabled={reviewPage >= reviewPageCount} onClick={() => setReviewPage((page) => page + 1)}>Sau →</button></footer></div>
        </section>
      </div>}
    </main>
  );
}
