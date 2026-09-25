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

const money = (value) => `${new Intl.NumberFormat('vi-VN').format(value)} ─æ`;
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
  if (lower.includes('wifi') || lower.includes('mß║íng') || lower.includes('internet')) return <Icon name="wifi" size={24} />;
  if (lower.includes('xe') || lower.includes('─æß╗ù') || lower.includes('parking')) return <Icon name="car" size={24} />;
  if (lower.includes('─æiß╗üu h├▓a') || lower.includes('lß║ính') || lower.includes('ac')) return <Icon name="snowflake" size={24} />;
  if (lower.includes('ban c├┤ng') || lower.includes('view') || lower.includes('s├ón')) return <Icon name="balcony" size={24} />;
  if (lower.includes('vß║¡t nu├┤i') || lower.includes('pet') || lower.includes('ch├│') || lower.includes('m├¿o')) return <Icon name="paw" size={24} />;
  if (lower.includes('b╞íi') || lower.includes('hß╗ô')) return <Icon name="pool" size={24} />;
  if (lower.includes('bß║┐p') || lower.includes('─ân')) return <Icon name="kitchen" size={24} />;
  return <Icon name="sparkles" size={24} />;
}

export default function HomestayDetailPage({ id, initialSearch, user, onHome, onBack, onBookings, onAccount, onDeveloping }) {
  const [data, setData] = useState(null);
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
    email: user?.email || '', country: 'Viß╗çt Nam', countryCode: '+84', phone: '', arrivalTime: ''
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

  useEffect(() => {
    window.scrollTo(0, 0);
    homestayApi.detail(id).then(setData).catch((e) => setError(e.message));
  }, [id]);

  // Track recommendation view event (from team's feature)
  const viewedId = useRef(null);
  useEffect(() => {
    if (data && viewedId.current !== data.id) {
      viewedId.current = data.id;
      recordRecommendationEvent('view', data.id).catch(() => {});
    }
  }, [data]);

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

  if (error) return <main className="detail-state"><p>{error}</p><button onClick={onBack}>Quay lß║íi danh s├ích</button></main>;
  if (!data) return <main className="detail-state"><div className="detail-loader" />─Éang tß║úi chi tiß║┐t homestay...</main>;

  const address = [data.addressLine, data.ward, data.district, data.province].filter(Boolean).join(', ');
  const coverUrl = (data.images && data.images.length > 0)
    ? (data.images.find((img) => img.isThumbnail)?.url || data.images[0]?.url)
    : homestayCover(data.name);
  const lowestPrice = (data.roomTypes && data.roomTypes.length > 0)
    ? Math.min(...data.roomTypes.map((room) => room.basePrice))
    : 0;
  const formattedLowestPrice = lowestPrice > 0
    ? `${new Intl.NumberFormat('vi-VN').format(lowestPrice)} VND`
    : '─Éang cß║¡p nhß║¡t';
  const ratingNumber = reviews.total
    ? Number(reviews.average).toFixed(1).replace('.', ',')
    : (data.averageRating ? Number(data.averageRating).toFixed(1).replace('.', ',') : '4,8');
  const amenities = data.amenities.length ? data.amenities.slice(0, 5) : [
    { id: 1, name: 'WiFi miß╗àn ph├¡', category: 'Internet' }, { id: 2, name: 'Bß╗â b╞íi ngo├ái trß╗¥i', category: 'Giß║úi tr├¡' },
    { id: 3, name: 'Nh├á h├áng', category: 'Tiß╗çn ├¡ch' }, { id: 4, name: 'Spa & th╞░ gi├ún', category: 'Dß╗ïch vß╗Ñ' },
    { id: 5, name: '─É╞░a ─æ├│n s├ón bay', category: 'Dß╗ïch vß╗Ñ' }
  ];
  const reviewAmenityOptions = ['WiFi', 'Ban c├┤ng', '─Éiß╗üu h├▓a', 'Nh├á bß║┐p', 'S├ón v╞░ß╗¥n', 'Chß╗ù ─æß╗ù xe', 'Vß║¡t nu├┤i', 'Th├ánh phß╗æ'];
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
    setAdultCount((value) => Math.max(1, Math.min(value, room.maxAdults * availableQuantity)));
    setChildCount((value) => Math.min(value, room.maxChildren * availableQuantity));
    window.setTimeout(() => document.getElementById('room-detail-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try { const detail = await homestayApi.roomTypeDetail(room.id); setSelectedRoom((current) => current?.id === room.id ? { ...current, ...detail } : current); } catch { /* giß╗» dß╗» liß╗çu danh s├ích nß║┐u tß║úi gallery thß║Ñt bß║íi */ }
  };
  const closeRoomDetail = () => { setSelectedRoom(null); setShowPaymentPage(false); window.setTimeout(() => document.querySelector('.rooms-section')?.scrollIntoView({ behavior: 'smooth' }), 0); };
  const bookingNights = arrival && departure ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000)) : 0;
  const includedAdultCount = selectedRoom ? Math.min(2, selectedRoom.maxAdults) * roomQuantity : 0;
  const extraAdultCount = Math.max(0, adultCount - includedAdultCount);
  const roomPriceTotal = selectedRoom ? selectedRoom.basePrice * bookingNights * roomQuantity : 0;
  const extraAdultTotal = extraAdultCount * 150000 * bookingNights;
  const childFeeTotal = childCount * 100000 * bookingNights;
  const extraFeeTotal = extraAdultTotal + childFeeTotal;
  const bookingGrandTotal = roomPriceTotal + extraFeeTotal;
  const quotedRoomTotal = priceQuote?.roomTotal ?? roomPriceTotal;
  const quotedExtraAdultTotal = priceQuote?.extraAdultFee ?? extraAdultTotal;
  const quotedChildFeeTotal = priceQuote?.childFee ?? childFeeTotal;
  const quotedGrandTotal = priceQuote?.total ?? bookingGrandTotal;
  const selectedRoomImages = selectedRoom?.rooms?.flatMap((room) => room.images.map((image) => ({ ...image, caption: image.caption || `Ph├▓ng ${room.roomNumber}` })))?.length
    ? selectedRoom.rooms.flatMap((room) => room.images.map((image) => ({ ...image, caption: image.caption || `Ph├▓ng ${room.roomNumber}` })))
    : selectedRoom?.images?.length ? selectedRoom.images : eloraImages.map((url, index) => ({ id: `fallback-${index}`, url, caption: selectedRoom?.name || 'ß║ónh ph├▓ng' }));
  const openPaymentPage = async () => {
    if (!user) { setBookingError('Vui l├▓ng ─æ─âng nhß║¡p t├ái khoß║ún kh├ích h├áng tr╞░ß╗¢c khi ─æß║╖t ph├▓ng.'); return; }
    if (!arrival || !departure) { setBookingError('Vui l├▓ng chß╗ìn ng├áy nhß║¡n v├á trß║ú ph├▓ng.'); return; }
    if (bookingNights < 1) { setBookingError('Ng├áy trß║ú ph├▓ng phß║úi sau ng├áy nhß║¡n ph├▓ng.'); return; }
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
    if (!user) { setBookingError('Vui l├▓ng ─æ─âng nhß║¡p t├ái khoß║ún kh├ích h├áng tr╞░ß╗¢c khi ─æß║╖t ph├▓ng.'); return; }
    if (!arrival || !departure) { setBookingError('Vui l├▓ng chß╗ìn ng├áy nhß║¡n v├á trß║ú ph├▓ng.'); return; }
    if (paymentSecondsLeft <= 0) { setBookingError('Thß╗¥i gian giß╗» gi├í ─æ├ú hß║┐t. Vui l├▓ng quay lß║íi kiß╗âm tra ph├▓ng v├á gi├í.'); return; }
    if (!guestInfo.firstName.trim() || !guestInfo.lastName.trim() || !guestInfo.email.trim() || !guestInfo.country) {
      setBookingError('Vui l├▓ng ─æiß╗ün ─æß║ºy ─æß╗º th├┤ng tin bß║»t buß╗Öc cß╗ºa kh├ích ch├¡nh.');
      document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(guestInfo.email.trim())) {
      setBookingError('Email cß╗ºa kh├ích ch├¡nh kh├┤ng hß╗úp lß╗ç.');
      document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const guestCount = adultCount + childCount;
    setBookingBusy(true); setBookingError('');
    try {
      const contactNote = [`Kh├ích ch├¡nh: ${guestInfo.firstName.trim()} ${guestInfo.lastName.trim()}`, `Email: ${guestInfo.email.trim()}`, guestInfo.phone.trim() ? `─Éiß╗çn thoß║íi: ${guestInfo.countryCode} ${guestInfo.phone.trim()}` : '', `Quß╗æc gia c╞░ tr├║: ${guestInfo.country}`, guestInfo.arrivalTime ? `Giß╗¥ nhß║¡n ph├▓ng dß╗▒ kiß║┐n: ${guestInfo.arrivalTime}` : 'Giß╗¥ nhß║¡n ph├▓ng dß╗▒ kiß║┐n: Ch╞░a biß║┐t'].filter(Boolean).join('\n');
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
      <div className={`payment-countdown ${paymentSecondsLeft <= 60 ? 'urgent' : ''}`} role="timer" aria-live="polite"><span>{paymentSecondsLeft > 0 ? 'Ch├║ng t├┤i ─æang giß╗» gi├í cho qu├╜ kh├ích...' : 'Thß╗¥i gian giß╗» gi├í ─æ├ú hß║┐t'}</span><i>Γù╖</i><strong>{countdown}</strong></div>
      <nav className="room-breadcrumb" aria-label="─É╞░ß╗¥ng dß║½n trang"><button onClick={onHome}>Trang chß╗º</button><span>ΓÇ║</span><button onClick={onBack}>Homestay</button><span>ΓÇ║</span><button onClick={() => setShowPaymentPage(false)}>{selectedRoom.name}</button><span>ΓÇ║</span><strong>Thanh to├ín</strong></nav>
      <section className="payment-shell">
        <button className="room-back-button" onClick={() => { setShowPaymentPage(false); window.scrollTo(0, 0); }}>ΓåÉ Quay lß║íi th├┤ng tin ph├▓ng</button>
        <header><small>X├üC NHß║¼N ─Éß║╢T PH├ÆNG</small><h1>Thanh to├ín ─æ╞ín ─æß║╖t ph├▓ng</h1><p>Kiß╗âm tra th├┤ng tin tr╞░ß╗¢c khi chuyß╗ân sang cß╗òng thanh to├ín VNPay.</p></header>
        <div className="payment-layout">
          <div className="payment-main">
            <section className="payment-card payment-stay-card"><img src={roomFallbacks[roomIndex % roomFallbacks.length]} alt={selectedRoom.name} /><div><small>{data.name}</small><h2>{selectedRoom.name}</h2><p>ΓÖÖ {guestCount} kh├ích &nbsp; ┬╖ &nbsp; Γû░ {selectedRoom.bedType} &nbsp; ┬╖ &nbsp; Γû│ {selectedRoom.roomSize || 'ΓÇö'} m┬▓</p></div></section>
            <section className="payment-card"><h2>Th├┤ng tin l╞░u tr├║</h2><div className="payment-dates"><div><small>NHß║¼N PH├ÆNG</small><strong>{formatDate(arrival)}</strong><span>Tß╗½ {data.checkInTime.slice(0, 5)}</span></div><b>{bookingNights} ─æ├¬m ΓåÆ</b><div><small>TRß║ó PH├ÆNG</small><strong>{formatDate(departure)}</strong><span>Tr╞░ß╗¢c {data.checkOutTime.slice(0, 5)}</span></div></div></section>
            <section className="payment-card payment-guest-card">
              <h2>Ai l├á kh├ích ch├¡nh?</h2><p className="payment-required">* Mß╗Ñc bß║»t buß╗Öc</p>
              <div className="payment-form-grid">
                <label><span>T├¬n *</span><input maxLength={50} autoComplete="given-name" value={guestInfo.firstName} onChange={updateGuestInfo('firstName')} placeholder="T├¬n" /></label>
                <label><span>Hß╗ì *</span><input maxLength={50} autoComplete="family-name" value={guestInfo.lastName} onChange={updateGuestInfo('lastName')} placeholder="Hß╗ì (vd: Nguyß╗àn)" /></label>
                <label><span>Email *</span><input type="email" maxLength={120} autoComplete="email" value={guestInfo.email} onChange={updateGuestInfo('email')} placeholder="Email ID" /></label>
                <label><span>Quß╗æc gia c╞░ tr├║ *</span><select value={guestInfo.country} onChange={updateGuestInfo('country')}><option>Viß╗çt Nam</option><option>Hoa Kß╗│</option><option>H├án Quß╗æc</option><option>Nhß║¡t Bß║ún</option><option>Kh├íc</option></select></label>
              </div>
              <span className="payment-phone-title">Sß╗æ ─æiß╗çn thoß║íi di ─æß╗Öng</span>
              <div className="payment-phone-row"><label><span>M├ú quß╗æc gia/v├╣ng</span><select value={guestInfo.countryCode} onChange={updateGuestInfo('countryCode')}><option>+84</option><option>+1</option><option>+81</option><option>+82</option></select></label><label><span>Sß╗æ ─æiß╗çn thoß║íi</span><input type="tel" maxLength={20} autoComplete="tel" value={guestInfo.phone} onChange={updateGuestInfo('phone')} placeholder="Sß╗æ ─æiß╗çn thoß║íi di ─æß╗Öng" /></label></div>
              <p className="payment-form-help">Vui l├▓ng ─æß║úm bß║úo th├┤ng tin li├¬n hß╗ç cß╗ºa qu├╜ kh├ích l├á ch├¡nh x├íc. Ch├║ng t├┤i sß║╜ sß╗¡ dß╗Ñng th├┤ng tin n├áy ─æß╗â gß╗¡i x├íc nhß║¡n v├á th├┤ng b├ío vß╗ü ─æß║╖t ph├▓ng.</p>
            </section>
            <section className="payment-card payment-extra-card"><h2>Th├┤ng tin l╞░u tr├║ bß╗ò sung</h2><p>Vui l├▓ng cung cß║Ñp th├┤ng tin sau ─æß╗â chß╗ù nghß╗ë chuß║⌐n bß╗ï ─æ├│n tiß║┐p bß║ín tß╗æt h╞ín.</p><label><span>Bß║ín dß╗▒ kiß║┐n ─æß║┐n nhß║¡n ph├▓ng l├║c n├áo?</span><select value={guestInfo.arrivalTime} onChange={updateGuestInfo('arrivalTime')}><option value="">T├┤i ch╞░a biß║┐t</option><option>12:00 - 14:00</option><option>14:00 - 16:00</option><option>16:00 - 18:00</option><option>18:00 - 20:00</option><option>Sau 20:00</option></select><small>Chß╗º homestay sß║╜ ─æ╞░ß╗úc b├ío tr╞░ß╗¢c giß╗¥ ─æß║┐n dß╗▒ kiß║┐n.</small></label></section>
            <section className="payment-card"><h2>Ph╞░╞íng thß╗⌐c thanh to├ín</h2><label className="payment-method"><input type="radio" checked readOnly /><span className="vnpay-mark">VN<span>PAY</span></span><div><strong>Thanh to├ín qua VNPay</strong><small>Qu├⌐t m├ú QR bß║▒ng ß╗⌐ng dß╗Ñng ng├ón h├áng hoß║╖c v├¡ VNPay</small></div><i>Γ£ô</i></label><p className="payment-note">Bß║ín sß║╜ ─æ╞░ß╗úc chuyß╗ân ─æß║┐n trang VNPay an to├án ─æß╗â qu├⌐t m├ú v├á ho├án tß║Ñt thanh to├ín.</p></section>
          </div>
          <aside className="payment-summary"><h2>Chi tiß║┐t thanh to├ín</h2><div><span>{roomQuantity} ph├▓ng ├ù {bookingNights} ─æ├¬m</span><strong>{money(quotedRoomTotal)}</strong></div>{extraAdultCount > 0 && <div><span>Phß╗Ñ thu {extraAdultCount} ng╞░ß╗¥i lß╗¢n</span><strong>{money(quotedExtraAdultTotal)}</strong></div>}{childCount > 0 && <div><span>Phß╗Ñ thu {childCount} trß║╗ em</span><strong>{money(quotedChildFeeTotal)}</strong></div>}<div><span>Ph├¡ dß╗ïch vß╗Ñ</span><strong>0 ─æ</strong></div><hr /><div className="payment-grand-total"><span>Tß╗òng thanh to├ín</span><strong>{money(quotedGrandTotal)}</strong></div>{bookingError && <div className="booking-error">{bookingError}</div>}<button disabled={bookingBusy || paymentSecondsLeft <= 0} onClick={payWithVnPay}>{bookingBusy ? '─Éang kß║┐t nß╗æi VNPay...' : paymentSecondsLeft <= 0 ? 'Thß╗¥i gian giß╗» gi├í ─æ├ú hß║┐t' : 'Tiß║┐p tß╗Ñc ─æß║┐n VNPay ΓåÆ'}</button><small>≡ƒöÆ Giao dß╗ïch ─æ╞░ß╗úc bß║úo mß║¡t bß╗ƒi VNPay</small></aside>
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
                {ratingNumber} <span className="stay-hero-star">Γÿà</span>
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
                title={isSaved ? 'Bß╗Å l╞░u homestay' : 'L╞░u homestay v├áo danh s├ích y├¬u th├¡ch'}
              >
                <Icon
                  name="heart"
                  size={14}
                  fill={isSaved ? '#ff4d6d' : 'none'}
                  color={isSaved ? '#ff4d6d' : '#fff'}
                />
                {isSaved ? '─É├ú l╞░u' : 'L╞░u Homestay'}
              </button>
            </div>
          </div>

          <div className="stay-hero-right">
            <span className="stay-hero-price-label">Gi├í ph├▓ng/─æ├¬m tß╗½</span>
            <div className="stay-hero-price-action">
              <strong className="stay-hero-price-val">{formattedLowestPrice}</strong>
              <button type="button" className="stay-hero-choose-btn" onClick={checkRooms}>
                Chß╗ìn ph├▓ng
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Floating search bar matching homepage style */}
      <section className="detail-search" aria-label="Kiß╗âm tra ph├▓ng trß╗æng">
        <label>
          Ng├áy nhß║¡n
          <span className="search-control">
            <input
              type="text"
              placeholder="Chß╗ìn ng├áy nhß║¡n"
              value={arrival}
              onChange={(e) => {
                setArrival(e.target.value);
                if (departure && departure <= e.target.value) setDeparture('');
              }}
              onFocus={(e) => { e.currentTarget.type = 'date'; }}
              onBlur={(e) => { if (!e.currentTarget.value) e.currentTarget.type = 'text'; }}
            />
            <i><Icon name="calendar" size={16} /></i>
          </span>
        </label>

        <label>
          Ng├áy trß║ú
          <span className="search-control">
            <input
              type="text"
              placeholder="Chß╗ìn ng├áy trß║ú"
              min={arrival || undefined}
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
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
          }}
        />

        <button type="button" onClick={checkRooms}>
          Kiß╗âm tra ph├▓ng <span>ΓåÆ</span>
        </button>
      </section>

      <div className="detail-content">
        <section id="overview" className="detail-intro redesigned-intro">
          <div>
            <small>KH├üM PH├ü KH├öNG GIAN</small>
            <h2>Giß╗¢i thiß╗çu homestay</h2>
            <p>{data.description}</p>
          </div>
          <aside>
            <article>
              <b>{data.roomTypes.length}</b>
              <span>Loß║íi ph├▓ng</span>
            </article>
            <article>
              <b>{data.roomTypes.reduce((sum, room) => sum + room.availableRoomCount, 0)}</b>
              <span>Ph├▓ng c├▓n trß╗æng</span>
            </article>
            <article>
              <b>{reviews.total ? Number(reviews.average).toFixed(1) : 'ΓÇö'}</b>
              <span>─Éiß╗âm ─æ├ính gi├í</span>
            </article>
          </aside>
        </section>

        <section id="amenities" className="detail-box featured-amenities">
          <header className="section-title">
            <small>TRß║óI NGHIß╗åM TIß╗åN NGHI</small>
            <h2>Tiß╗çn ├¡ch nß╗òi bß║¡t</h2>
            <p>Mß╗ìi tiß╗çn nghi cß║ºn thiß║┐t cho mß╗Öt kß╗│ nghß╗ë thoß║úi m├íi v├á trß╗ìn vß║╣n.</p>
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
              <small>Lß╗░A CHß╗îN L╞»U TR├Ü</small>
              <h2>Chß╗ìn c─ân ph├▓ng d├ánh cho bß║ín</h2>
            </div>
            <p>Gi├í minh bß║ích ┬╖ Xem chi tiß║┐t ngay tr├¬n trang</p>
          </div>
          <div className="detail-room-list">
            {data.roomTypes.map((room, index) => (
              <article
                className={`detail-room-card ${selectedRoom?.id === room.id ? 'selected' : ''}`}
                key={room.id}
              >
                <img
                  src={room.thumbnailUrl || roomFallbacks[index % roomFallbacks.length]}
                  alt={room.name}
                />
                <div className="room-card-shade" />
                <div className="room-card-top">
                  <span>
                    <Icon name="user" size={12} />
                    Tß╗æi ─æa {room.maxAdults} ng╞░ß╗¥i lß╗¢n ┬╖ {room.maxChildren} trß║╗ em
                  </span>
                  <span>{room.availableRoomCount > 0 ? `${room.availableRoomCount} ph├▓ng trß╗æng` : '─É├ú hß║┐t ph├▓ng'}</span>
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
                      {room.roomSize || 'ΓÇö'} m┬▓
                    </span>
                  </div>
                  <p>{room.description}</p>
                </div>
                <div className="room-actions">
                  <strong>
                    {money(room.basePrice)} <small>/ ─æ├¬m</small>
                  </strong>
                  <button
                    type="button"
                    className="room-book-pill"
                    disabled={room.availableRoomCount === 0}
                    onClick={() => openRoomDetail(room)}
                  >
                    {room.availableRoomCount > 0 ? '─Éß║╖t ph├▓ng ΓåÆ' : 'Hß║┐t ph├▓ng'}
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
                <small>CHI TIß║╛T PH├ÆNG Tß║áI {data.name.toUpperCase()}</small>
                <h2>{selectedRoom.name}</h2>
              </div>
              <button type="button" onClick={closeRoomDetail}>Thu gß╗ìn ├ù</button>
            </header>
            <div className="room-page-gallery">
              <img
                className="room-page-main-image"
                src={selectedRoomImages[Math.min(activeRoomImage, selectedRoomImages.length - 1)]?.url}
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
                    <img src={image.url} alt={image.caption || `Xem ß║únh ${index + 1}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="room-page-layout">
              <article className="room-page-info">
                <div className="room-page-facts">
                  <span>
                    <Icon name="user" size={14} />
                    {selectedRoom.maxAdults + selectedRoom.maxChildren} kh├ích
                  </span>
                  <span>
                    <Icon name="bed" size={14} />
                    {selectedRoom.bedType}
                  </span>
                  <span>
                    <Icon name="maximize" size={14} />
                    {selectedRoom.roomSize || 'ΓÇö'} m┬▓
                  </span>
                </div>
                <p>
                  {selectedRoom.description} Kh├┤ng gian ─æ╞░ß╗úc thiß║┐t kß║┐ ß║Ñm c├║ng, nhiß╗üu ├ính s├íng tß╗▒ nhi├¬n v├á ─æß║ºy ─æß╗º tiß╗çn nghi cho mß╗Öt kß╗│ nghß╗ë thoß║úi m├íi.
                </p>
                <hr />
                <h2>Tiß╗çn nghi trong ph├▓ng</h2>
                <ul className="room-page-amenities">
                  <li>WiFi tß╗æc ─æß╗Ö cao miß╗àn ph├¡</li>
                  <li>M├íy ─æiß╗üu h├▓a</li>
                  <li>Ph├▓ng tß║»m ri├¬ng &amp; n╞░ß╗¢c n├│ng</li>
                  <li>TV m├án h├¼nh phß║│ng</li>
                  <li>ß║ñm ─æun n╞░ß╗¢c v├á minibar</li>
                  <li>{selectedRoom.name.toLowerCase().includes('ban c├┤ng') ? 'Ban c├┤ng ri├¬ng, nh├¼n ra th├ánh phß╗æ' : 'Dß╗ìn ph├▓ng hß║▒ng ng├áy'}</li>
                </ul>
                <hr />
                <h2>Ch├¡nh s├ích ph├▓ng</h2>
                <div className="room-page-policy">
                  <p><b>Nhß║¡n ph├▓ng</b><span>Tß╗½ {data.checkInTime.slice(0, 5)}</span></p>
                  <p><b>Trß║ú ph├▓ng</b><span>Tr╞░ß╗¢c {data.checkOutTime.slice(0, 5)}</span></p>
                  <p><b>Hß╗ºy ph├▓ng</b><span>Miß╗àn ph├¡ tr╞░ß╗¢c 7 ng├áy</span></p>
                </div>
              </article>
              <aside className="room-page-booking">
                <small>GI├ü PH├ÆNG</small>
                <div>
                  <strong>{money(selectedRoom.basePrice)}</strong>
                  <span>/ ph├▓ng / ─æ├¬m</span>
                </div>
                <p>Γ£ô {selectedRoom.availableRoomCount} ph├▓ng ─æang c├▓n trß╗æng</p>
                <label>
                  Ng├áy nhß║¡n
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={arrival}
                    onChange={(e) => { setArrival(e.target.value); setBookingError(''); }}
                  />
                </label>
                <label>
                  Ng├áy trß║ú
                  <input
                    type="date"
                    min={arrival || new Date().toISOString().slice(0, 10)}
                    value={departure}
                    onChange={(e) => { setDeparture(e.target.value); setBookingError(''); }}
                  />
                </label>
                <div className="guest-room-fields">
                  <label>
                    Ng╞░ß╗¥i lß╗¢n
                    <select
                      value={adultCount}
                      onChange={(e) => { setAdultCount(Number(e.target.value)); setBookingError(''); }}
                    >
                      {Array.from({ length: selectedRoom.maxAdults * roomQuantity }, (_, i) => i + 1).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Trß║╗ em
                    <select
                      value={childCount}
                      onChange={(e) => { setChildCount(Number(e.target.value)); setBookingError(''); }}
                    >
                      {Array.from({ length: selectedRoom.maxChildren * roomQuantity + 1 }, (_, i) => i).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Sß╗æ ph├▓ng
                    <select
                      value={roomQuantity}
                      onChange={(e) => {
                        const quantity = Number(e.target.value);
                        setRoomQuantity(quantity);
                        setAdultCount((value) => Math.min(value, selectedRoom.maxAdults * quantity));
                        setChildCount((value) => Math.min(value, selectedRoom.maxChildren * quantity));
                        setBookingError('');
                      }}
                    >
                      {Array.from({ length: Math.min(selectedRoom.availableRoomCount, 10) }, (_, i) => i + 1).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <small className="capacity-note">
                  Gi├í gß╗ôm tß╗æi ─æa {Math.min(2, selectedRoom.maxAdults)} ng╞░ß╗¥i lß╗¢n/ph├▓ng. Phß╗Ñ thu: ng╞░ß╗¥i lß╗¢n 150.000─æ v├á trß║╗ em 100.000─æ mß╗ùi ─æ├¬m.
                </small>
                {bookingNights > 0 && (
                  <div className="booking-price-breakdown">
                    <div><span>Tiß╗ün ph├▓ng</span><strong>{money(roomPriceTotal)}</strong></div>
                    {extraAdultCount > 0 && <div><span>Th├¬m {extraAdultCount} ng╞░ß╗¥i lß╗¢n</span><strong>+ {money(extraAdultTotal)}</strong></div>}
                    {childCount > 0 && <div><span>Th├¬m {childCount} trß║╗ em</span><strong>+ {money(childFeeTotal)}</strong></div>}
                    <div className="booking-total"><span>Tß╗òng cß╗Öng</span><strong>{money(bookingGrandTotal)}</strong></div>
                  </div>
                )}
                {bookingError && <div className="booking-error">{bookingError}</div>}
                <button
                  type="button"
                  disabled={selectedRoom.availableRoomCount === 0}
                  onClick={openPaymentPage}
                >
                  {selectedRoom.availableRoomCount > 0 ? '─Éß║┐n trang thanh to├ín ΓåÆ' : 'Ph├▓ng ─æ├ú hß║┐t'}
                </button>
                <em>Ch╞░a ph├ít sinh giao dß╗ïch ß╗ƒ b╞░ß╗¢c n├áy</em>
              </aside>
            </div>
          </section>
        )}

        <section id="policy" className="detail-box policy-section">
          <header className="section-title">
            <small>TH├öNG TIN Cß║ªN BIß║╛T</small>
            <h2>Ch├¡nh s├ích homestay</h2>
          </header>
          <div className="policy-grid">
            <article>
              <i><Icon name="clock" size={24} /></i>
              <div>
                <b>Nhß║¡n ph├▓ng</b>
                <strong>Tß╗½ {data.checkInTime.slice(0, 5)}</strong>
                <small>Vui l├▓ng xuß║Ñt tr├¼nh giß║Ñy tß╗¥ t├╣y th├ón</small>
              </div>
            </article>
            <article>
              <i><Icon name="clock" size={24} /></i>
              <div>
                <b>Trß║ú ph├▓ng</b>
                <strong>Tr╞░ß╗¢c {data.checkOutTime.slice(0, 5)}</strong>
                <small>Hß╗ù trß╗ú trß║ú ph├▓ng linh hoß║ít (khi c├│ thß╗â)</small>
              </div>
            </article>
            <article>
              <i><Icon name="fileText" size={24} /></i>
              <div>
                <b>Hß╗ºy ph├▓ng</b>
                <strong>Miß╗àn ph├¡ hß╗ºy tr╞░ß╗¢c 7 ng├áy</strong>
                <small>C├íc tr╞░ß╗¥ng hß╗úp kh├íc t├╣y theo ─æiß╗üu kiß╗çn ─æß║╖t ph├▓ng</small>
              </div>
            </article>
            <article>
              <i><Icon name="shield" size={24} /></i>
              <div>
                <b>Quy ─æß╗ïnh chung</b>
                <ul>
                  <li>Kh├┤ng h├║t thuß╗æc trong ph├▓ng</li>
                  <li>Kh├┤ng mang th├║ c╞░ng</li>
                  <li>Giß╗» y├¬n t─⌐nh sau 22:00</li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section id="location" className="detail-box location-section">
          <div>
            <small>KH├üM PH├ü KHU Vß╗░C</small>
            <h2>Vß╗ï tr├¡ thuß║¡n tiß╗çn</h2>
            <strong>
              <Icon name="location" size={16} />
              {address}
            </strong>
            <p>
              Nß║▒m ngay trung t├óm {data.ward || data.district}, dß╗à d├áng di chuyß╗ân ─æß║┐n b├úi biß╗ân, chß╗ú ─æ├¬m v├á c├íc ─æiß╗âm tham quan nß╗òi tiß║┐ng.
            </p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${data.latitude || ''},${data.longitude || ''}`}
              target="_blank"
              rel="noreferrer"
            >
              Mß╗ƒ Google Maps &nbsp; ΓåÆ
            </a>
          </div>
          <div className="map-visual">
            <span className="map-water">B├úi biß╗ân</span>
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
              <small>Cß║óM NHß║¼N Tß╗¬ KH├üCH</small>
              <h2>─É├ính gi├í thß╗▒c tß║┐</h2>
            </div>
            {reviews.total > 0 && (
              <button type="button" onClick={() => setShowAllReviews(true)}>
                Xem tß║Ñt cß║ú {reviews.total} ─æ├ính gi├í ΓåÆ
              </button>
            )}
          </header>
          <div className="review-layout">
            <div className="rating-total">
              <strong>{reviews.total ? Number(reviews.average).toFixed(1) : 'ΓÇö'} <small>/ 5</small></strong>
              <span>{'Γÿà'.repeat(Math.round(reviews.average || 0))}{'Γÿå'.repeat(5 - Math.round(reviews.average || 0))}</span>
              <small>{reviews.total} ─æ├ính gi├í</small>
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
                    <p>{review.comment || 'Kh├ích h├áng kh├┤ng ─æß╗â lß║íi nß╗Öi dung.'}</p>
                    <footer>
                      <span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span>
                      <div>
                        <strong>{review.customerName}</strong>
                        <small>{new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</small>
                      </div>
                      <em>{'Γÿà'.repeat(review.rating)}{'Γÿå'.repeat(5-review.rating)}</em>
                    </footer>
                    {review.hostReply && (
                      <div className="host-review-reply">
                        <b>Phß║ún hß╗ôi tß╗½ chß╗º homestay</b>
                        <p>{review.hostReply}</p>
                      </div>
                    )}
                  </blockquote>
                ))
              ) : (
                <p className="empty-reviews">Homestay ch╞░a c├│ ─æ├ính gi├í.</p>
              )}
            </div>
          </div>
          {['Customer', 'Host'].includes(user?.role) && reviewBookings.length > 0 && (
            <form className="review-form" onSubmit={submitReview}>
              <h3>Chia sß║╗ trß║úi nghiß╗çm cß╗ºa bß║ín</h3>
              <select required value={reviewForm.bookingId} onChange={(e) => setReviewForm({ ...reviewForm, bookingId: e.target.value })}>
                <option value="">Chß╗ìn ─æ╞ín ─æ├ú ho├án th├ánh</option>
                {reviewBookings.map((booking) => (
                  <option value={booking.id} key={booking.id}>
                    {booking.bookingCode} ┬╖ trß║ú ph├▓ng {booking.checkOutDate}
                  </option>
                ))}
              </select>
              <select value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}>
                {[5,4,3,2,1].map((rating) => (
                  <option value={rating} key={rating}>{rating} sao</option>
                ))}
              </select>
              <textarea maxLength="1000" rows="4" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="─Éiß╗üu g├¼ khiß║┐n kß╗│ nghß╗ë cß╗ºa bß║ín ─æ├íng nhß╗¢?" />
              <button type="submit">Gß╗¡i ─æ├ính gi├í</button>
              {reviewMessage && <p>{reviewMessage}</p>}
            </form>
          )}
        </section>
      </div>
      {showAllReviews && <div className="reviews-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAllReviews(false); }}>
        <section className="reviews-modal" role="dialog" aria-modal="true" aria-label="Tß║Ñt cß║ú ─æ├ính gi├í">
          <button className="reviews-modal-close" onClick={() => setShowAllReviews(false)} aria-label="─É├│ng">├ù</button>
          <aside className="reviews-modal-summary"><div className="reviews-modal-heading"><small>─É├üNH GI├ü Cß╗ªA KH├üCH Vß╗Ç</small><h2>{data.name}</h2></div><div className="reviews-score"><strong>{reviews.total ? Number(reviews.average).toFixed(1) : 'ΓÇö'}</strong><span>/ 5</span><em>{'Γÿà'.repeat(Math.round(reviews.average || 0))}{'Γÿå'.repeat(5 - Math.round(reviews.average || 0))}</em><p>{reviews.total} ─æ├ính gi├í ─æ├ú x├íc thß╗▒c</p></div><div className="reviews-modal-bars">{[5,4,3,2,1].map((star) => { const count = reviews.distribution.find((x) => x.rating === star)?.count || 0; const value = reviews.total ? Math.round(count * 100 / reviews.total) : 0; return <button key={star} className={reviewRatingFilter === star ? 'active' : ''} onClick={() => changeReviewFilters(() => setReviewRatingFilter(reviewRatingFilter === star ? 0 : star))}><span>{star} sao</span><i><b style={{ width: `${value}%` }} /></i><small>{count}</small></button>; })}</div><div className="reviews-amenity-overview">{amenities.slice(0, 6).map((item) => <button key={item.id} className={reviewAmenityFilter === item.name ? 'active' : ''} onClick={() => changeReviewFilters(() => setReviewAmenityFilter(reviewAmenityFilter === item.name ? '' : item.name))}><span>{item.name}</span><b>{reviewAmenityFilter === item.name ? 'Γ£ô' : 'C├│ sß║╡n'}</b></button>)}</div></aside>
          <div className="reviews-modal-main"><section className="reviews-filter-section"><h3>Bß╗Ö lß╗ìc</h3><div className="reviews-filters"><label><span>Phß║ún hß╗ôi</span><select value={reviewReplyFilter} onChange={(e) => changeReviewFilters(() => setReviewReplyFilter(e.target.value))}><option value="all">Tß║Ñt cß║ú ({reviews.total})</option><option value="replied">C├│ phß║ún hß╗ôi chß╗º nh├á</option><option value="not-replied">Ch╞░a c├│ phß║ún hß╗ôi</option></select></label><label><span>─Éiß╗âm ─æ├ính gi├í</span><select value={reviewRatingFilter} onChange={(e) => changeReviewFilters(() => setReviewRatingFilter(Number(e.target.value)))}><option value="0">Tß║Ñt cß║ú mß╗⌐c sao</option>{[5,4,3,2,1].map((star) => <option value={star} key={star}>{star} sao</option>)}</select></label><label><span>Tiß╗çn ├¡ch ─æ╞░ß╗úc nhß║»c</span><select value={reviewAmenityFilter} onChange={(e) => changeReviewFilters(() => setReviewAmenityFilter(e.target.value))}><option value="">Tß║Ñt cß║ú tiß╗çn ├¡ch</option>{reviewAmenityOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Thß╗¥i gian</span><select value={reviewTimeFilter} onChange={(e) => changeReviewFilters(() => setReviewTimeFilter(e.target.value))}><option value="all">Tß║Ñt cß║ú thß╗¥i gian</option><option value="year">Trong 1 n─âm</option><option value="month">Trong 1 th├íng</option></select></label></div><div className="reviews-search"><input value={reviewSearch} onChange={(e) => changeReviewFilters(() => setReviewSearch(e.target.value))} placeholder="T├¼m theo t├¬n kh├ích hoß║╖c nß╗Öi dung ─æ├ính gi├í" /><button>T├¼m</button></div></section><header><div><h2>─É├ính gi├í cß╗ºa kh├ích ({filteredReviews.length})</h2></div><label>Sß║»p xß║┐p theo:<select value={reviewSort} onChange={(e) => { setReviewSort(e.target.value); setReviewPage(1); }}><option value="newest">Mß╗¢i nhß║Ñt</option><option value="oldest">C┼⌐ nhß║Ñt</option><option value="highest">─Éiß╗âm cao nhß║Ñt</option><option value="lowest">─Éiß╗âm thß║Ñp nhß║Ñt</option></select></label></header><div className="reviews-modal-list">{visibleReviews.map((review) => <article key={review.id}><header><span>{review.customerName.split(/\s+/).map((part) => part[0]).slice(-2).join('').toUpperCase()}</span><div><strong>{review.customerName}</strong><small>Ng├áy ─æ├ính gi├í: {new Intl.DateTimeFormat('vi-VN').format(new Date(review.createdAt))}</small></div><em>{review.rating},0</em></header><p>{review.comment || 'Kh├ích h├áng kh├┤ng ─æß╗â lß║íi nß╗Öi dung.'}</p>{review.hostReply && <div className="host-review-reply"><b>Phß║ún hß╗ôi tß╗½ chß╗º homestay</b><p>{review.hostReply}</p></div>}</article>)}{visibleReviews.length === 0 && <div className="reviews-empty"><b>Kh├┤ng t├¼m thß║Ñy ─æ├ính gi├í</b><span>H├úy thß╗¡ thay ─æß╗òi bß╗Ö lß╗ìc.</span></div>}</div><footer className="reviews-pagination"><button disabled={reviewPage <= 1} onClick={() => setReviewPage((page) => page - 1)}>ΓåÉ Tr╞░ß╗¢c</button><span>Trang {Math.min(reviewPage, reviewPageCount)} / {reviewPageCount}</span><button disabled={reviewPage >= reviewPageCount} onClick={() => setReviewPage((page) => page + 1)}>Sau ΓåÆ</button></footer></div>
        </section>
      </div>}
    </main>
  );
}
