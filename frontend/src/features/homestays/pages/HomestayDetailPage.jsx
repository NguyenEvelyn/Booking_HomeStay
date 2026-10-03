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

function BookingStepper({ label, description, value, min, max, onChange }) {
  return <div className="booking-stepper-row">
    <div><b>{label}</b><small>{description}</small></div>
    <div className="booking-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Giảm ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite" aria-label={`${label}: ${value}`}>{value}</output>
      <button type="button" aria-label={`Tăng ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  </div>;
}

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
    check: <polyline points="20 6 9 17 4 12" />,
    chevronRight: <polyline points="9 18 15 12 9 6" />,
    chevronLeft: <polyline points="15 18 9 12 15 6" />,
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </>
    ),
    image: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </>
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
  if (lower.includes('wifi') || lower.includes('mạng') || lower.includes('internet')) return <Icon name="wifi" size={20} />;
  if (lower.includes('xe') || lower.includes('đỗ') || lower.includes('parking')) return <Icon name="car" size={20} />;
  if (lower.includes('điều hòa') || lower.includes('lạnh') || lower.includes('ac')) return <Icon name="snowflake" size={20} />;
  if (lower.includes('ban công') || lower.includes('view') || lower.includes('sân')) return <Icon name="balcony" size={20} />;
  if (lower.includes('vật nuôi') || lower.includes('pet') || lower.includes('chó') || lower.includes('mèo')) return <Icon name="paw" size={20} />;
  if (lower.includes('bơi') || lower.includes('hồ')) return <Icon name="pool" size={20} />;
  if (lower.includes('bếp') || lower.includes('ăn')) return <Icon name="kitchen" size={20} />;
  if (lower.includes('lễ tân') || lower.includes('24h') || lower.includes('reception') || lower.includes('hỗ trợ')) return <Icon name="clock" size={20} />;
  return <Icon name="sparkles" size={20} />;
}

const toDateStr = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDateVN = (value) => value ? value.split('-').reverse().join('/') : '';
const calendarDays = (year, month) => {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const first = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first); date.setDate(first.getDate() + index);
    return { value: toDateStr(date), day: date.getDate(), current: date.getMonth() === month };
  });
};

export default function HomestayDetailPage({ id, initialSearch, user, onHome, onBack, onBookings, onAccount, onDeveloping, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');
  const [arrival, setArrival] = useState(initialSearch?.checkIn || '');
  const [departure, setDeparture] = useState(initialSearch?.checkOut || '');
  const [adultCount, setAdultCount] = useState(initialSearch?.adults || initialSearch?.guests || 2);
  const [childCount, setChildCount] = useState(initialSearch?.children || 0);
  const [roomQuantity, setRoomQuantity] = useState(initialSearch?.rooms || 1);
  const [dayUseHours, setDayUseHours] = useState(3);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeRoomImage, setActiveRoomImage] = useState(0);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [dateAvailability, setDateAvailability] = useState(null);
  const [roomCalendarData, setRoomCalendarData] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarLoading, setCalendarLoading] = useState(false);
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
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const nameParts = (user?.fullName || '').trim().split(/\s+/).filter(Boolean);
  const [guestInfo, setGuestInfo] = useState({
    firstName: nameParts.slice(0, -1).join(' '), lastName: nameParts.at(-1) || '',
    email: user?.email || '', country: 'Việt Nam', countryCode: '+84', phone: '', arrivalTime: '',
    birthDate: '', gender: '', documentType: 'CCCD', documentNumber: '', address: '', note: ''
  });
  const [companions, setCompanions] = useState([]);
  const [openCompanion, setOpenCompanion] = useState(0);
  const [declareLater, setDeclareLater] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [paymentOption, setPaymentOption] = useState('Deposit');
  const [showCancellationPolicy, setShowCancellationPolicy] = useState(false);
  useEffect(() => {
    const count = Math.max(0, adultCount + childCount - 1);
    setCompanions((current) => Array.from({ length: count }, (_, index) => current[index] || {
      type: index < Math.max(0, adultCount - 1) ? 'adult' : 'child', fullName: '', birthDate: '', gender: '',
      nationality: 'Việt Nam', documentType: index < Math.max(0, adultCount - 1) ? 'CCCD' : 'Giấy khai sinh',
      documentNumber: '', accompanyingAdult: 'Khách chính', sameAddress: false
    }));
  }, [adultCount, childCount]);
  useEffect(() => {
    if (!showPaymentPage) return;
    const { documentNumber: _privateDocument, ...safeGuest } = guestInfo;
    const safeCompanions = companions.map(({ documentNumber: _privateCompanionDocument, ...item }) => item);
    try { localStorage.setItem(`booking_draft_${id}`, JSON.stringify({ guest: safeGuest, companions: safeCompanions, declareLater, paymentOption })); } catch { /* storage may be unavailable */ }
  }, [showPaymentPage, guestInfo, companions, declareLater, paymentOption, id]);
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
    setError('');
    Promise.all([homestayApi.detail(id),homestayApi.effectivePolicies(id)]).then(([next,nextPolicy]) => {
      setData(next);
      setPolicy(nextPolicy);
      setSelectedRoom((current) => {
        if (!current) return current;
        const fresh = next.roomTypes.find((room) => room.id === current.id);
        return fresh ? { ...current, ...fresh } : null;
      });
    }).catch((e) => setError(e.message));
  }, [id, refreshKey]);

  // Track recommendation view event
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

  useEffect(() => {
    if (!galleryModalOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setGalleryModalOpen(false);
      else if (e.key === 'ArrowRight') {
        setActivePhotoIndex((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft') {
        setActivePhotoIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryModalOpen]);

  useEffect(() => {
    const sameDayUse = arrival && departure === arrival && policy?.document?.dayUse?.enabled;
    if (!arrival || !departure || departure < arrival || (departure === arrival && !sameDayUse)) {
      setDateAvailability(null);
      return undefined;
    }
    const availabilityCheckOut = sameDayUse ? toDateStr(new Date(new Date(`${arrival}T00:00:00`).getTime()+86400000)) : departure;
    let active = true;
    homestayApi.availability(id,{checkIn:arrival,checkOut:availabilityCheckOut,guests:1,rooms:1}).then(result=>{
      if(!active)return;
      setDateAvailability(Object.fromEntries(
        (result.items || []).map((item) => [item.roomTypeId, item.availableRooms || 0])
      ));
    }).catch(availabilityError=>{
      if(active){
        setDateAvailability(null);
        setBookingError(availabilityError.message);
      }
    });
    return()=>{active=false};
  },[id,arrival,departure,policy?.document?.dayUse?.enabled,refreshKey]);

  useEffect(() => {
    const sameDayUse = arrival && departure === arrival && policy?.document?.dayUse?.enabled;
    if (!selectedRoom?.id || !arrival || !departure || (departure < arrival) || (departure === arrival && !sameDayUse)) {
      setPriceQuote(null);
      setQuoteLoading(false);
      return undefined;
    }
    if (sameDayUse) { setPriceQuote(null); setQuoteLoading(false); setBookingError(''); return undefined; }
    let active = true;
    setQuoteLoading(true);
    const timer = window.setTimeout(() => {
      bookingApi.quote({
        roomTypeId: selectedRoom.id,
        checkInDate: arrival,
        checkOutDate: departure,
        adultCount,
        childCount,
        quantity: roomQuantity,
        customerNote: null
      }).then((quote) => {
        if (active) {
          setPriceQuote(quote);
          setBookingError('');
        }
      }).catch((quoteError) => {
        if (active) {
          setPriceQuote(null);
          setBookingError(quoteError.message);
        }
      }).finally(() => { if (active) setQuoteLoading(false); });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedRoom?.id, arrival, departure, adultCount, childCount, roomQuantity, dayUseHours, policy?.document?.dayUse?.enabled, refreshKey]);

  useEffect(() => {
    if (!selectedRoom?.id) { setRoomCalendarData(null); return undefined; }
    let active = true;
    setCalendarLoading(true);
    homestayApi.roomCalendar(selectedRoom.id, 6)
      .then((result) => { if (active) setRoomCalendarData(result); })
      .catch((calendarError) => { if (active) setBookingError(calendarError.message); })
      .finally(() => { if (active) setCalendarLoading(false); });
    return () => { active = false; };
  }, [selectedRoom?.id, refreshKey]);

  useEffect(() => {
    if (!selectedRoom || dateAvailability === null) return;
    const availableRooms = dateAvailability[selectedRoom.id] ?? 0;
    setSelectedRoom((current) => current?.id === selectedRoom.id
      ? { ...current, availableRoomCount: availableRooms }
      : current);
    setRoomQuantity((current) => Math.max(1, Math.min(current, Math.max(1, availableRooms))));
    setBookingError(availableRooms > 0 ? '' : 'Loại phòng này đã hết phòng trong khoảng ngày bạn chọn.');
  }, [selectedRoom?.id, dateAvailability]);

  if (error) return <main className="detail-state"><p>{error}</p><button onClick={onBack}>Quay lại danh sách</button></main>;
  if (!data) return <main className="detail-state"><div className="detail-loader" />Đang tải chi tiết homestay...</main>;

  const address = [data.addressLine, data.ward, data.district, data.province].filter(Boolean).join(', ');
  const isDayUse = Boolean(arrival && departure && arrival === departure && policy?.document?.dayUse?.enabled);
  const hasValidStayDates = Boolean(arrival && departure && (departure > arrival || isDayUse));
  const selectedRoomAvailableCount = dateAvailability === null || !selectedRoom
    ? null
    : (dateAvailability[selectedRoom.id] ?? 0);
  const coverUrl = (data.images && data.images.length > 0)
    ? (data.images.find((img) => img.isThumbnail)?.url || data.images[0]?.url)
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
  const rawScore = reviews.total ? reviews.average : (data.averageRating || 4.8);
  const score10 = Number((rawScore * 2).toFixed(1));
  const sentimentText = score10 >= 9.0 ? 'Tuyệt vời' : score10 >= 8.0 ? 'Ấn tượng' : score10 >= 7.0 ? 'Rất tốt' : 'Hài lòng';

  const featuredReviews = reviews.items && reviews.items.length > 0
    ? reviews.items.slice(0, 2)
    : [
        {
          id: 'featured-sample-1',
          customerName: 'Hoàng Long',
          rating: 5,
          comment: 'Không gian ấm cúng, view thoáng đãng và phòng ốc rất sạch sẽ. Chủ nhà hỗ trợ nhiệt tình từ lúc nhận phòng.'
        },
        {
          id: 'featured-sample-2',
          customerName: 'Minh Thư',
          rating: 5,
          comment: 'Vị trí thuận tiện đi lại, phòng đầy đủ tiện nghi như hình chụp. Rất đáng trải nghiệm cho kỳ nghỉ!'
        }
      ];

  const keyAmenities = (data.amenities && data.amenities.length >= 6)
    ? data.amenities.slice(0, 6)
    : [
        ...(data.amenities || []),
        { id: 'ka-1', name: 'WiFi tốc độ cao', category: 'Internet' },
        { id: 'ka-2', name: 'Máy điều hòa', category: 'Làm mát' },
        { id: 'ka-3', name: 'Chỗ đỗ xe miễn phí', category: 'Tiện ích' },
        { id: 'ka-4', name: 'Lễ tân hỗ trợ 24h', category: 'Dịch vụ' },
        { id: 'ka-5', name: 'Bếp tiện nghi', category: 'Nấu nướng' },
        { id: 'ka-6', name: 'Ban công thoáng mát', category: 'Không gian' }
      ].filter((item, idx, arr) => arr.findIndex((t) => t.name.toLowerCase() === item.name.toLowerCase()) === idx).slice(0, 6);

  const galleryImages = [
    ...(data.images || []).map((img, i) => ({
      id: img.id || `hs-img-${i}`,
      url: freshImageUrl(img.imageUrl || img.url),
      caption: img.caption || `${data.name} - Ảnh ${i + 1}`
    })),
    ...(data.roomTypes || []).flatMap((room) =>
      (room.images || []).map((img, i) => ({
        id: img.id || `room-img-${room.id}-${i}`,
        url: freshImageUrl(img.imageUrl || img.url),
        caption: img.caption || `${room.name} - Ảnh ${i + 1}`
      }))
    ),
    ...(data.roomTypes || []).filter((r) => r.thumbnailUrl).map((room) => ({
      id: `room-thumb-${room.id}`,
      url: freshImageUrl(room.thumbnailUrl),
      caption: room.name
    }))
  ];

  const fallbackCovers = [
    coverUrl,
    pineHomestayImage,
    azureHomestayImage,
    sunsetHomestayImage,
    deluxeRoomImage,
    familySuiteImage,
    gardenViewRoomImage,
    ...eloraImages
  ];
  fallbackCovers.forEach((fallbackUrl, idx) => {
    if (galleryImages.length < 8 && fallbackUrl) {
      if (!galleryImages.some((g) => g.url === fallbackUrl)) {
        galleryImages.push({
          id: `mosaic-fallback-${idx}`,
          url: fallbackUrl,
          caption: `${data.name} - Không gian ${galleryImages.length + 1}`
        });
      }
    }
  });

  const safePhotoIndex = galleryImages.length
    ? Math.min(Math.max(0, activePhotoIndex), galleryImages.length - 1)
    : 0;

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
    const capacityPerRoom = room.extraGuestAllowed ? room.maxCapacity : room.baseCapacity;
    setSelectedRoom(room); setShowPaymentPage(false); setActiveRoomImage(0); setRoomQuantity(availableQuantity); setCalendarOpen(true);
    setAdultCount((value) => Math.max(1, Math.min(value, capacityPerRoom * availableQuantity)));
    setChildCount(0);
    window.setTimeout(() => document.getElementById('room-detail-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try { const detail = await homestayApi.roomTypeDetail(room.id); setSelectedRoom((current) => current?.id === room.id ? { ...current, ...detail, availableRoomCount: current.availableRoomCount } : current); } catch { /* giữ dữ liệu danh sách nếu tải gallery thất bại */ }
  };
  const closeRoomDetail = () => { setSelectedRoom(null); setShowPaymentPage(false); window.setTimeout(() => document.querySelector('.rooms-section')?.scrollIntoView({ behavior: 'smooth' }), 0); };
  const bookingNights = arrival && departure ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000)) : 0;
  const dayUsePercent = isDayUse ? (dayUseHours <= 3 ? policy.document.dayUse.upToThreeHoursPercent : dayUseHours <= 6 ? policy.document.dayUse.upToSixHoursPercent : policy.document.dayUse.overSixHoursPercent) : 100;
  const allowedGuestCapacity=selectedRoom?(selectedRoom.extraGuestAllowed?selectedRoom.maxCapacity:selectedRoom.baseCapacity)*roomQuantity:1;
  const includedAdultCount = selectedRoom ? selectedRoom.baseCapacity * roomQuantity : 0;
  const extraAdultCount = Math.max(0, adultCount - includedAdultCount);
  const extraChildCount = Math.max(0,childCount-Math.max(0,includedAdultCount-adultCount));
  const roomPriceTotal = selectedRoom ? selectedRoom.basePrice * (isDayUse ? dayUsePercent / 100 : bookingNights) * roomQuantity : 0;
  const extraAdultTotal = extraAdultCount * (selectedRoom?.extraGuestFee || 0) * (isDayUse ? 1 : bookingNights);
  const childFeeTotal = extraChildCount * (selectedRoom?.extraChildFee || 0) * (isDayUse ? 1 : bookingNights);
  const extraFeeTotal = extraAdultTotal + childFeeTotal;
  const bookingGrandTotal = roomPriceTotal + extraFeeTotal;
  const quotedRoomTotal = priceQuote?.roomTotal ?? roomPriceTotal;
  const quotedExtraAdultTotal = priceQuote?.extraAdultFee ?? extraAdultTotal;
  const quotedChildFeeTotal = priceQuote?.extraChildFee ?? childFeeTotal;
  const quotedGrandTotal = priceQuote?.total ?? bookingGrandTotal;
  const maximumRooms = Math.max(1, selectedRoomAvailableCount ?? selectedRoom?.availableRoomCount ?? 1);
  const maximumGuests = selectedRoom ? (selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity) * roomQuantity : 1;
  const hasFlexiblePrice = priceQuote?.nightsBreakdown?.some((night) => night.basePrice !== selectedRoom?.basePrice)
    || priceQuote?.seasonalSurchargeAmount > 0;
  const todayValue = toDateStr(new Date());
  const daysInCalendar = calendarDays(calendarMonth.getFullYear(), calendarMonth.getMonth());
  const isBookedDate = (value) => roomCalendarData?.dailyStatus?.[value]?.status === 'booked';
  const chooseCalendarDate = (value) => {
    if (value < todayValue || isBookedDate(value)) return;
    if (!arrival || departure || value < arrival) { setArrival(value); setDeparture(''); setBookingError(''); return; }
    if (value === arrival && policy?.document?.dayUse?.enabled) { setDeparture(value); setCalendarOpen(false); setBookingError(''); return; }
    if (value === arrival) { setBookingError('Homestay chưa bật chính sách đặt và trả phòng trong ngày.'); return; }
    for (let cursor = new Date(`${arrival}T00:00:00`); toDateStr(cursor) < value; cursor.setDate(cursor.getDate() + 1)) {
      if (isBookedDate(toDateStr(cursor))) { setBookingError(`Ngày ${formatDateVN(toDateStr(cursor))} đã kín phòng.`); return; }
    }
    setDeparture(value); setCalendarOpen(false); setBookingError('');
  };
  const selectedRoomImages = selectedRoom?.rooms?.flatMap((room) => room.images.map((image) => ({ ...image, caption: image.caption || `Phòng ${room.roomNumber}` })))?.length
    ? selectedRoom.rooms.flatMap((room) => room.images.map((image) => ({ ...image, caption: image.caption || `Phòng ${room.roomNumber}` })))
    : selectedRoom?.images?.length ? selectedRoom.images : eloraImages.map((url, index) => ({ id: `fallback-${index}`, url, caption: selectedRoom?.name || 'Ảnh phòng' }));
  const openPaymentPage = async () => {
    if (!user) { setBookingError('Vui lòng đăng nhập tài khoản khách hàng trước khi đặt phòng.'); return; }
    if (!arrival || !departure) { setBookingError('Vui lòng chọn ngày nhận và trả phòng.'); return; }
    if (!isDayUse && bookingNights < 1) { setBookingError('Ngày trả phòng phải sau ngày nhận phòng.'); return; }
    setBookingBusy(true); setBookingError('');
    try {
      const quote = await bookingApi.quote({ roomTypeId: selectedRoom.id, checkInDate: arrival, checkOutDate: departure, adultCount, childCount, quantity: roomQuantity, customerNote: null, dayUseHours: isDayUse ? dayUseHours : null });
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
    if (!/^\d{8,15}$/.test(guestInfo.phone.replace(/\s/g, ''))) { setBookingError('Số điện thoại phải có 8–15 chữ số.'); document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior:'smooth' }); return; }
    if (!guestInfo.birthDate || !guestInfo.gender || !guestInfo.documentNumber.trim() || !guestInfo.address.trim()) { setBookingError('Vui lòng hoàn tất ngày sinh, giới tính, giấy tờ và địa chỉ của khách chính.'); document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior:'smooth' }); return; }
    if (guestInfo.documentType === 'CCCD' && !/^\d{12}$/.test(guestInfo.documentNumber)) { setBookingError('Số CCCD phải gồm đúng 12 chữ số.'); document.querySelector('.payment-guest-card')?.scrollIntoView({ behavior:'smooth' }); return; }
    const missingCompanion = !declareLater && companions.findIndex((item) => !item.fullName.trim() || !item.birthDate || !item.gender || (item.type === 'adult' && !item.documentNumber.trim()));
    if (missingCompanion >= 0) { setOpenCompanion(missingCompanion); setBookingError('Vui lòng hoàn tất thông tin khách đi cùng hoặc chọn khai báo sau.'); document.querySelector('.companion-card')?.scrollIntoView({ behavior:'smooth' }); return; }
    if (!privacyAccepted || !policyAccepted) { setBookingError('Vui lòng đồng ý xử lý dữ liệu cá nhân và chính sách hủy/hoàn cọc.'); return; }
    const guestCount = adultCount + childCount;
    setBookingBusy(true); setBookingError('');
    try {
      const contactNote = [`Email: ${guestInfo.email.trim()}`, `Điện thoại: ${guestInfo.countryCode} ${guestInfo.phone.trim()}`, guestInfo.arrivalTime ? `Giờ nhận phòng dự kiến: ${guestInfo.arrivalTime}` : 'Giờ nhận phòng dự kiến: Chưa biết', guestInfo.note.trim() ? `Ghi chú: ${guestInfo.note.trim()}` : ''].filter(Boolean).join('\n');
      const primaryGuest = { type:'adult', fullName:`${guestInfo.firstName.trim()} ${guestInfo.lastName.trim()}`, birthDate:guestInfo.birthDate, gender:guestInfo.gender, nationality:guestInfo.country, documentType:guestInfo.documentType, documentNumber:guestInfo.documentNumber, address:guestInfo.address, accompanyingAdult:null };
      const guestDeclarations = companions.map(item=>({ type:item.type, fullName:item.fullName, birthDate:item.birthDate||null, gender:item.gender, nationality:item.nationality, documentType:item.documentType, documentNumber:item.documentNumber||null, address:item.sameAddress?guestInfo.address:null, accompanyingAdult:item.type==='child'?item.accompanyingAdult:null }));
      const result = await bookingApi.createVnPayPayment({ roomTypeId: selectedRoom.id, checkInDate: arrival, checkOutDate: departure, adultCount, childCount, quantity: roomQuantity, customerNote: contactNote, recommendationSessionId: recommendationSessionId(), dayUseHours: isDayUse ? dayUseHours : null, paymentOption, primaryGuest, companions:guestDeclarations, declareCompanionsLater:declareLater, privacyAccepted, policyAccepted });
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
            <section className="payment-card"><h2>Thông tin lưu trú</h2><div className="payment-dates"><div><small>NHẬN PHÒNG</small><strong>{formatDate(arrival)}</strong><span>{isDayUse ? `Từ ${String(policy.document.dayUse.from).slice(0,5)}` : `Từ ${data.checkInTime.slice(0, 5)}`}</span></div><b>{isDayUse ? `${dayUseHours <= 6 ? dayUseHours : 'Trên 6'} giờ →` : `${bookingNights} đêm →`}</b><div><small>TRẢ PHÒNG</small><strong>{formatDate(departure)}</strong><span>{isDayUse ? `Trước ${String(policy.document.dayUse.to).slice(0,5)}` : `Trước ${data.checkOutTime.slice(0, 5)}`}</span></div></div></section>
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
              <div className="payment-form-grid payment-identity-grid">
                <label><span>Ngày sinh *</span><input type="date" value={guestInfo.birthDate} onChange={updateGuestInfo('birthDate')} /></label>
                <label><span>Giới tính *</span><select value={guestInfo.gender} onChange={updateGuestInfo('gender')}><option value="">Chọn giới tính</option><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>
                <label><span>Loại giấy tờ *</span><select value={guestInfo.documentType} onChange={updateGuestInfo('documentType')}><option>CCCD</option><option>Hộ chiếu</option></select></label>
                <label><span>Số giấy tờ *</span><input value={guestInfo.documentNumber} onChange={updateGuestInfo('documentNumber')} placeholder={guestInfo.documentType==='CCCD'?'12 chữ số':'Số hộ chiếu'} /></label>
                <label className="payment-field-wide"><span>Địa chỉ thường trú *</span><input value={guestInfo.address} onChange={updateGuestInfo('address')} placeholder="Số nhà, đường, phường/xã, tỉnh/thành" /></label>
              </div>
              <p className="payment-form-help">Vui lòng đảm bảo thông tin liên hệ của quý khách là chính xác. Chúng tôi sẽ sử dụng thông tin này để gửi xác nhận và thông báo về đặt phòng.</p>
            </section>
            <section className="payment-card companion-card"><h2><i className="payment-step">4</i> Khách đi cùng · Khai báo lưu trú</h2>
              <p className="payment-form-help">Thông tin này được dùng để thông báo lưu trú theo quy định và chỉ được chia sẻ với cơ quan có thẩm quyền khi cần.</p>
              <label className="payment-check"><input type="checkbox" checked={declareLater} onChange={e=>setDeclareLater(e.target.checked)} /><span>Khai báo sau, gửi link cho từng khách tự điền <small>Hạn: trước 24 giờ nhận phòng</small></span></label>
              {declareLater ? <div className="payment-info">✉ Chúng tôi sẽ gửi link qua email và nhắc lại trước giờ nhận phòng.</div> : companions.map((item,index)=>{
                const complete=item.fullName.trim()&&item.birthDate&&item.gender&&(item.type==='child'||item.documentNumber.trim());
                return <div className="companion-accordion" key={index}><button type="button" aria-expanded={openCompanion===index} onClick={()=>setOpenCompanion(openCompanion===index?-1:index)}><b>{item.fullName.trim()?.[0]||index+2}</b><span><strong>{item.type==='child'?`Trẻ em ${index+1}`:`Khách ${index+2} (người lớn)`}</strong><small>{item.fullName||'Chưa nhập họ tên'}</small></span><em className={complete?'done':'missing'}>{complete?'Đã khai ✓':'Chưa khai'}</em><i>{openCompanion===index?'−':'+'}</i></button>{openCompanion===index&&<div className="companion-fields payment-form-grid">
                  <label className="payment-field-wide"><span>Họ và tên *</span><input value={item.fullName} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,fullName:e.target.value}:x))}/></label>
                  <label><span>Ngày sinh *</span><input type="date" value={item.birthDate} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,birthDate:e.target.value}:x))}/></label>
                  <label><span>Giới tính *</span><select value={item.gender} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,gender:e.target.value}:x))}><option value="">Chọn</option><option>Nam</option><option>Nữ</option><option>Khác</option></select></label>
                  <label><span>Quốc tịch</span><input value={item.nationality} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,nationality:e.target.value}:x))}/></label>
                  {item.type==='child'?<label><span>Đi cùng ai? *</span><select value={item.accompanyingAdult} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,accompanyingAdult:e.target.value}:x))}><option>Khách chính</option>{companions.filter(x=>x.type==='adult'&&x.fullName).map((x,i)=><option key={i}>{x.fullName}</option>)}</select></label>:null}
                  <label><span>Loại giấy tờ {item.type==='adult'?'*':''}</span><select value={item.documentType} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,documentType:e.target.value}:x))}><option>CCCD</option><option>Hộ chiếu</option>{item.type==='child'&&<><option>Giấy khai sinh</option><option>Chưa có giấy tờ</option></>}</select></label>
                  <label><span>Số giấy tờ {item.type==='adult'?'*':'(tùy chọn)'}</span><input value={item.documentNumber} onChange={e=>setCompanions(c=>c.map((x,i)=>i===index?{...x,documentNumber:e.target.value}:x))}/></label>
                </div>}</div>})}
              <label className="payment-check privacy"><input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)}/><span>Tôi đồng ý xử lý dữ liệu cá nhân để thực hiện đặt phòng và khai báo lưu trú. *</span></label>
            </section>
            <section className="payment-card payment-extra-card"><h2><i className="payment-step">5</i> Thông tin bổ sung</h2><label><span>Giờ dự kiến đến</span><select value={guestInfo.arrivalTime} onChange={updateGuestInfo('arrivalTime')}><option value="">Tôi chưa biết</option><option>09:00 - 12:00</option><option>12:00 - 14:00</option><option>14:00 - 16:00</option><option>16:00 - 18:00</option><option>Sau 18:00</option></select></label><label><span>Ghi chú cho chủ nhà (tùy chọn)</span><textarea maxLength="300" rows="4" value={guestInfo.note} onChange={updateGuestInfo('note')} placeholder="Yêu cầu đặc biệt, giờ đến dự kiến..."></textarea><small>{guestInfo.note.length}/300</small></label></section>
            <section className="payment-card payment-options"><h2><i className="payment-step">6</i> Phương thức thanh toán</h2>
              <label className={paymentOption==='Deposit'?'selected':''}><input type="radio" name="paymentOption" checked={paymentOption==='Deposit'} onChange={()=>setPaymentOption('Deposit')}/><span><strong>Đặt cọc {money(priceQuote?.depositAmount ?? quotedGrandTotal*.3)}</strong><small>Còn lại {money(quotedGrandTotal-(priceQuote?.depositAmount ?? quotedGrandTotal*.3))} thanh toán khi nhận phòng</small></span><em>Phổ biến</em></label>
              <label className={paymentOption==='Full'?'selected':''}><input type="radio" name="paymentOption" checked={paymentOption==='Full'} onChange={()=>setPaymentOption('Full')}/><span><strong>Thanh toán toàn bộ</strong><small>{money(quotedGrandTotal)}</small></span></label>
              <p className="payment-note"><span className="vnpay-mark">VN<span>PAY</span></span> Bạn sẽ được chuyển sang cổng VNPay an toàn để hoàn tất thanh toán.</p>
              <button type="button" className="policy-link" onClick={()=>setShowCancellationPolicy(true)}>Chính sách hủy và hoàn cọc</button>
              <label className="payment-check"><input type="checkbox" checked={policyAccepted} onChange={e=>setPolicyAccepted(e.target.checked)}/><span>Tôi đã đọc và đồng ý với chính sách hủy, hoàn cọc. *</span></label>
            </section>
          </div>
          <aside className="payment-summary" aria-live="polite"><h2>Chi tiết thanh toán</h2><div><span>{selectedRoom.name} · {isDayUse?`${dayUseHours<=6?dayUseHours:'trên 6'} giờ`:`${bookingNights} đêm`}</span><strong>{money(quotedRoomTotal)}</strong></div>{quotedExtraAdultTotal>0&&<div><span>Phụ thu khách</span><strong>{money(quotedExtraAdultTotal+quotedChildFeeTotal)}</strong></div>}<div><span>Phí dịch vụ</span><strong>0 đ</strong></div><hr/><div><span>Tổng tiền</span><strong>{money(quotedGrandTotal)}</strong></div><div className="payment-due"><span>Cần thanh toán hôm nay</span><strong>{money(paymentOption==='Full'?quotedGrandTotal:(priceQuote?.depositAmount??quotedGrandTotal*.3))}</strong>{paymentOption==='Deposit'&&<small>Còn lại trả tại homestay: {money(quotedGrandTotal-(priceQuote?.depositAmount??quotedGrandTotal*.3))}</small>}</div><p className="payment-checklist">Khách chính {guestInfo.documentNumber?'✓':'○'} · Khách đi cùng {declareLater?'gửi sau':`${companions.filter(x=>x.fullName&&x.birthDate).length}/${companions.length}`} · Chính sách {policyAccepted?'✓':'✗'}</p>{bookingError&&<div className="booking-error">{bookingError}</div>}<button disabled={bookingBusy||paymentSecondsLeft<=0||!privacyAccepted||!policyAccepted} onClick={payWithVnPay}>{bookingBusy?'Đang kết nối VNPay...':paymentOption==='Full'?`Thanh toán ${money(quotedGrandTotal)} qua VNPay`:`Thanh toán cọc ${money(priceQuote?.depositAmount??quotedGrandTotal*.3)} qua VNPay`}</button><small>🔒 Giao dịch được bảo mật bởi VNPay</small></aside>
        </div>
      </section>
      {showCancellationPolicy&&<div className="customer-modal-backdrop" role="presentation" onClick={()=>setShowCancellationPolicy(false)}><section className="customer-action-modal policy-modal" role="dialog" aria-modal="true" aria-label="Chính sách hủy và hoàn cọc" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setShowCancellationPolicy(false)}>×</button><small>CHÍNH SÁCH THANH TOÁN</small><h2>Hủy phòng và hoàn cọc</h2><p>Khoản hoàn cọc được tính theo thời điểm hủy và chính sách hiệu lực của homestay. Số tiền thực tế sẽ được backend tính lại tại thời điểm thanh toán.</p><button onClick={()=>setShowCancellationPolicy(false)}>Tôi đã hiểu</button></section></div>}
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
          Kiểm tra phòng <span>→</span>
        </button>
      </section>

      <div className="detail-content">
        {/* 1. Bộ sưu tập ảnh Mosaic */}
        <section className="detail-gallery-mosaic" aria-label="Thư viện ảnh homestay">
          <div
            className="gallery-mosaic-main"
            onClick={() => { setActivePhotoIndex(0); setGalleryModalOpen(true); }}
            title="Bấm để xem ảnh lớn"
          >
            <img src={galleryImages[0]?.url} alt={galleryImages[0]?.caption || data.name} />
          </div>
          <div className="gallery-mosaic-grid">
            {galleryImages.slice(1, 7).map((img, index) => {
              const photoIdx = index + 1;
              const isLast = index === 5 || index === galleryImages.slice(1, 7).length - 1;
              return (
                <div
                  key={img.id || photoIdx}
                  className={`gallery-mosaic-item ${isLast ? 'gallery-mosaic-last' : ''}`}
                  onClick={() => { setActivePhotoIndex(photoIdx); setGalleryModalOpen(true); }}
                  title={isLast ? 'Xem tất cả hình ảnh' : `Bấm xem ảnh ${photoIdx + 1}`}
                >
                  <img src={img.url} alt={img.caption || `${data.name} ${photoIdx}`} />
                  {isLast && (
                    <div className="gallery-more-overlay">
                      <Icon name="image" size={20} color="#fff" />
                      <span>Xem tất cả hình ảnh</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Hàng 3 thẻ tổng quan: Đánh giá, Bản đồ (không hiển thị địa điểm lân cận), Tiện ích nổi bật */}
        <section className="detail-overview-grid">
          {/* Thẻ 1: Đánh giá nổi bật */}
          <article className="overview-card overview-review-card">
            <header className="overview-card-header">
              <div className="overview-score-row">
                <strong>{score10}</strong>
                <span className="score-scale">/ 10</span>
                <span className="sentiment-badge">{sentimentText}</span>
              </div>
              <button
                type="button"
                className="overview-card-link"
                onClick={() => setShowAllReviews(true)}
              >
                {reviews.total ? `${reviews.total} đánh giá` : 'Xem đánh giá'} <Icon name="chevronRight" size={13} />
              </button>
            </header>

            <span className="overview-subheading">Khách nói gì về kỳ nghỉ của họ</span>

            <div className="overview-review-snippets">
              {featuredReviews.map((rev) => (
                <div key={rev.id} className="overview-review-item">
                  <div className="overview-reviewer-meta">
                    <span className="overview-avatar">
                      {(rev.customerName || 'KH').split(/\s+/).map((p) => p[0]).slice(-2).join('').toUpperCase()}
                    </span>
                    <strong className="overview-reviewer-name">{rev.customerName}</strong>
                    <div className="overview-stars">
                      {'★'.repeat(rev.rating || 5)}
                    </div>
                  </div>
                  <p className="overview-review-quote">
                    "{rev.comment || 'Không gian ấm cúng, chủ nhà thân thiện và hỗ trợ chu đáo.'}"
                  </p>
                </div>
              ))}
            </div>
          </article>

          {/* Thẻ 2: Bản đồ vị trí (không hiển thị các địa điểm gần đó) */}
          <article className="overview-card overview-map-card">
            <header className="overview-card-header">
              <h3>Vị trí</h3>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="overview-card-link"
              >
                Xem bản đồ <Icon name="chevronRight" size={13} />
              </a>
            </header>

            <div className="overview-map-address">
              <Icon name="location" size={15} color="#0b4ae6" />
              <span>{address}</span>
            </div>

            <div className="overview-map-embed">
              <iframe
                title={`Bản đồ ${data.name}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                width="100%"
                height="100%"
                loading="lazy"
                style={{ border: 0 }}
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </article>

          {/* Thẻ 3: Tiện ích chính */}
          <article className="overview-card overview-amenity-card">
            <header className="overview-card-header">
              <h3>Tiện ích chính</h3>
              <button
                type="button"
                className="overview-card-link"
                onClick={checkRooms}
              >
                Xem thêm <Icon name="chevronRight" size={13} />
              </button>
            </header>

            <div className="overview-amenities-grid">
              {keyAmenities.map((item, idx) => (
                <div key={item.id || idx} className="overview-amenity-item">
                  <i>{getAmenitySvg(item.name, item.category)}</i>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* 3. Đoạn giới thiệu mô tả về homestay */}
        <section className="detail-description-card">
          <h2>Giới thiệu về homestay</h2>
          <p className={isDescriptionExpanded ? 'expanded' : 'clamped'}>
            {data.description || 'Homestay mang đến không gian nghỉ dưỡng ấm cúng, thiết kế hiện đại và đầy đủ tiện nghi, lý tưởng cho kỳ nghỉ của bạn cùng gia đình và bạn bè.'}
          </p>
          {(data.description && data.description.length > 220) && (
            <button
              type="button"
              className="desc-toggle-btn"
              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            >
              {isDescriptionExpanded ? 'Thu gọn' : 'Xem thêm'}
              <Icon name={isDescriptionExpanded ? 'chevronLeft' : 'chevronRight'} size={13} />
            </button>
          )}
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
            {data.roomTypes.map((room, index) => {
              const availableCount = dateAvailability === null
                ? null
                : (dateAvailability[room.id] ?? 0);
              return (
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
                    {room.baseCapacity} khách tiêu chuẩn · tối đa {room.extraGuestAllowed ? room.maxCapacity : room.baseCapacity} khách
                  </span>
                  <span>{availableCount === null
                    ? 'Chọn ngày để kiểm tra'
                    : (availableCount > 0 ? `${availableCount} phòng trống` : 'Đã hết phòng')}</span>
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
                    disabled={availableCount === 0}
                    onClick={() => openRoomDetail(room)}
                  >
                    {availableCount === null ? 'Xem phòng →' : (availableCount > 0 ? 'Đặt phòng →' : 'Hết phòng')}
                  </button>
                </div>
              </article>
              );
            })}
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
                    <img src={image.url} alt={image.caption || `Xem ảnh ${index + 1}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="room-page-layout">
              <article className="room-page-info modern-room-info">
                <div className="room-facts-pills">
                  <span className="room-fact-pill">
                    <Icon name="user" size={14} />
                    Tối đa {selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity} khách
                  </span>
                  <span className="room-fact-pill">
                    <Icon name="bed" size={14} />
                    {selectedRoom.bedType}
                  </span>
                  <span className="room-fact-pill">
                    <Icon name="maximize" size={14} />
                    {selectedRoom.roomSize || '—'} m²
                  </span>
                </div>
                <p className="room-info-desc">
                  {selectedRoom.description || 'Không gian được thiết kế ấm cúng, nhiều ánh sáng tự nhiên và đầy đủ tiện nghi cho một kỳ nghỉ thoải mái.'}
                </p>
                <hr className="room-info-sep" />
                <div className="room-amenities-block">
                  <h3 className="room-block-title">Tiện nghi trong phòng</h3>
                  <ul className="room-amenities-checklist">
                    {['WiFi tốc độ cao miễn phí', 'Máy điều hòa', 'Phòng tắm riêng & nước nóng', 'TV màn hình phẳng', 'Ấm đun nước và minibar', selectedRoom.name.toLowerCase().includes('ban công') ? 'Ban công riêng, nhìn ra thành phố' : 'Dọn phòng hằng ngày'].map((amenity) => <li key={amenity}><i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i><span>{amenity}</span></li>)}
                  </ul>
                </div>
                <hr className="room-info-sep" />
                <div className="room-policy-block">
                  <h3 className="room-block-title">Chính sách phòng</h3>
                  <div className="room-policy-cards-grid">
                    <div className="room-policy-mini-card"><span className="mini-card-label">Nhận phòng</span><strong className="mini-card-val">Từ {data.checkInTime?.slice(0, 5) || '—'}</strong><small className="mini-card-sub">Theo giờ quy định</small></div>
                    <div className="room-policy-mini-card"><span className="mini-card-label">Trả phòng</span><strong className="mini-card-val">Trước {data.checkOutTime?.slice(0, 5) || '—'}</strong><small className="mini-card-sub">Bàn giao phòng</small></div>
                    <div className="room-policy-mini-card highlight-green"><span className="mini-card-label">Hủy phòng</span><strong className="mini-card-val">{policy?.cancellationTiers?.[0] ? `Hoàn ${policy.cancellationTiers[0].refundPercent}%` : 'Xem chính sách'}</strong><small className="mini-card-sub">{policy?.cancellationTiers?.[0] ? `Từ ${policy.cancellationTiers[0].minimumDays} ngày trước` : 'Điều kiện áp dụng bên dưới'}</small></div>
                  </div>
                </div>
              </article>
              <aside className="room-page-booking booking-card-redesign">
                <small className="booking-price-label">GIÁ PHÒNG</small>
                <div className="booking-base-price">
                  <strong>{money(selectedRoom.basePrice)}</strong>
                  <span>/ phòng / đêm</span>
                </div>
                <p className={`booking-availability ${selectedRoomAvailableCount === 1 ? 'scarce' : ''}`}><i aria-hidden="true" />{selectedRoomAvailableCount === null
                  ? 'Chọn ngày để kiểm tra phòng trống'
                  : selectedRoomAvailableCount === 1 ? 'Chỉ còn 1 phòng' : `Còn ${selectedRoomAvailableCount} phòng`}</p>
                <button type="button" className="booking-date-trigger" onClick={() => setCalendarOpen((open) => !open)}>
                  <span><small>NGÀY NHẬN</small><b>{arrival ? formatDateVN(arrival) : 'Chọn ngày'}</b></span>
                  <em>{isDayUse ? 'Trong ngày' : bookingNights > 0 ? `${bookingNights} đêm` : '→'}</em>
                  <span><small>NGÀY TRẢ</small><b>{departure ? formatDateVN(departure) : 'Chọn ngày'}</b></span>
                </button>
                {calendarOpen && <div className="room-availability-calendar">
                  <header>
                    <button type="button" onClick={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>‹</button>
                    <b>Tháng {calendarMonth.getMonth() + 1}/{calendarMonth.getFullYear()}</b>
                    <button type="button" onClick={() => setCalendarMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>›</button>
                  </header>
                  {calendarLoading && <p>Đang tải lịch phòng…</p>}
                  <div className="calendar-weekdays">{['T2','T3','T4','T5','T6','T7','CN'].map((day) => <b key={day}>{day}</b>)}</div>
                  <div className="calendar-days">{daysInCalendar.map((item) => {
                    const booked = isBookedDate(item.value); const past = item.value < todayValue;
                    const selected = item.value === arrival || item.value === departure;
                    const inRange = arrival && departure && item.value > arrival && item.value < departure;
                    return <button type="button" key={item.value} disabled={!item.current || past || booked}
                      className={`${booked ? 'booked' : 'available'} ${selected ? 'selected' : ''} ${inRange ? 'in-range' : ''}`}
                      onClick={() => chooseCalendarDate(item.value)}>{item.day}</button>;
                  })}</div>
                  <footer><span><i className="available" /> Còn trống</span><span><i className="booked" /> Đã kín</span><span><i className="selected" /> Đang chọn</span></footer>
                </div>}
                {isDayUse&&<div className="day-use-duration"><div><b>Thời lượng sử dụng</b><small>Trong khung {String(policy.document.dayUse.from).slice(0,5)}–{String(policy.document.dayUse.to).slice(0,5)}</small></div><select aria-label="Thời lượng đặt phòng trong ngày" value={dayUseHours} onChange={e=>setDayUseHours(Number(e.target.value))}><option value="3">Tối đa 3 giờ · {policy.document.dayUse.upToThreeHoursPercent}%</option><option value="6">Tối đa 6 giờ · {policy.document.dayUse.upToSixHoursPercent}%</option><option value="9">Trên 6 giờ · {policy.document.dayUse.overSixHoursPercent}%</option></select></div>}
                <div className="booking-steppers">
                  <BookingStepper label="Người lớn" description="Từ 12 tuổi" value={adultCount} min={1} max={Math.max(1,maximumGuests-childCount)} onChange={(value)=>{setAdultCount(value);setBookingError('')}}/>
                  <BookingStepper label="Trẻ em" description={`Có tính trong giới hạn ${maximumGuests} khách`} value={childCount} min={0} max={Math.max(0,maximumGuests-adultCount)} onChange={(value)=>{setChildCount(value);setBookingError('')}}/>
                  <BookingStepper label="Số phòng" description={selectedRoomAvailableCount==null?'Chọn ngày để kiểm tra':`Tối đa ${maximumRooms} phòng còn trống`} value={roomQuantity} min={1} max={maximumRooms} onChange={(quantity)=>{setRoomQuantity(quantity);const allowed=(selectedRoom.extraGuestAllowed?selectedRoom.maxCapacity:selectedRoom.baseCapacity)*quantity;setAdultCount(value=>Math.max(1,Math.min(value,allowed)));setChildCount(value=>Math.min(value,Math.max(0,allowed-adultCount)));setBookingError('')}}/>
                </div>
                <div className="capacity-note"><i aria-hidden="true">i</i><span>Giá gồm {selectedRoom.baseCapacity} khách/phòng; tối đa {selectedRoom.extraGuestAllowed?selectedRoom.maxCapacity:selectedRoom.baseCapacity} khách/phòng, bao gồm cả trẻ em.{selectedRoom.extraGuestAllowed&&selectedRoom.maxCapacity>selectedRoom.baseCapacity?` Phụ thu người lớn ${money(selectedRoom.extraGuestFee)}, trẻ em 0–${selectedRoom.childMaxAge??11} tuổi ${money(selectedRoom.extraChildFee)}/đêm.`:''}</span></div>
                {(bookingNights > 0 || isDayUse) && (
                  <div className={`booking-price-breakdown ${quoteLoading?'is-loading':''}`} aria-live="polite" aria-busy={quoteLoading}>
                    {quoteLoading&&<div className="quote-loading"><i/> Đang cập nhật giá…</div>}
                    <div><span>{isDayUse?`${money(selectedRoom.basePrice)} × ${dayUsePercent}% day-use`:`${money(selectedRoom.basePrice)} × ${bookingNights} đêm`}{roomQuantity>1?` × ${roomQuantity} phòng`:''}</span><strong>{money(quotedRoomTotal)}</strong></div>
                    {hasFlexiblePrice && <div className="pricing-note"><span>Đã áp dụng giá linh động và ưu đãi tốt nhất</span></div>}
                    {(priceQuote?.extraAdults ?? extraAdultCount) > 0 && <div><span>Phụ thu người lớn: {money(selectedRoom.extraGuestFee)} × {priceQuote?.extraAdults ?? extraAdultCount} người × {isDayUse?'1 lượt':`${bookingNights} đêm`}</span><strong>+ {money(quotedExtraAdultTotal)}</strong></div>}
                    {(priceQuote?.extraChildren ?? extraChildCount) > 0 && <div><span>Phụ thu trẻ em: {money(selectedRoom.extraChildFee)} × {priceQuote?.extraChildren ?? extraChildCount} trẻ × {isDayUse?'1 lượt':`${bookingNights} đêm`}</span><strong>+ {money(quotedChildFeeTotal)}</strong></div>}
                    <div className="booking-total"><span>Tổng cộng</span><strong>{money(quotedGrandTotal)}</strong></div>
                    <small>Đã bao gồm các khoản phí hiển thị</small>
                    <button type="button" className="cancellation-policy-link" onClick={()=>document.getElementById('policy')?.scrollIntoView({behavior:'smooth'})}>Chính sách hủy phòng</button>
                  </div>
                )}
                {bookingError && <div className="booking-error" role="alert">⚠ {bookingError}</div>}
                <div className="booking-summary-line">{adultCount} người lớn{childCount?` · ${childCount} trẻ em`:''} · {roomQuantity} phòng · {isDayUse?`${dayUseHours<=6?dayUseHours:'trên 6'} giờ trong ngày`:`${bookingNights||0} đêm`}</div>
                <button
                  className="booking-primary-action"
                  type="button"
                  disabled={!hasValidStayDates || selectedRoomAvailableCount === 0 || quoteLoading}
                  onClick={openPaymentPage}
                >
                  {quoteLoading?'Đang cập nhật giá…':!hasValidStayDates?'Chọn ngày để kiểm tra':isDayUse?'Đặt phòng trong ngày':(selectedRoomAvailableCount > 0?'Tiếp tục thanh toán →':'Phòng đã hết trong ngày đã chọn')}
                </button>
                <em className="booking-reassurance">♢ Chưa phát sinh giao dịch ở bước này</em>
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
                <strong>{policy?.cancellationTiers?.map((tier) => `${tier.maximumDays == null ? `≥${tier.minimumDays}` : `${tier.minimumDays}–${tier.maximumDays}`} ngày: hoàn ${tier.refundPercent}%`).join(' · ') || 'Xem điều kiện đặt phòng'}</strong>
                <small>Khoản hoàn được tính theo chính sách đã lưu tại thời điểm đặt phòng</small>
              </div>
            </article>
            <article>
              <i><Icon name="shield" size={24} /></i>
              <div>
                <b>Quy định chung</b>
                <ul>
                  <li>{policy?.document?.houseRules?.smokingInRoomAllowed ? 'Cho phép hút thuốc theo khu vực quy định' : 'Không hút thuốc trong phòng'}</li>
                  <li>{policy?.document?.pets?.allowed ? `Cho phép tối đa ${policy.document.pets.maximumPerRoom} thú cưng/phòng · ${money(policy.document.pets.feePerNight)}/đêm` : 'Không mang thú cưng'}</li>
                  <li>Giữ yên tĩnh từ {String(policy?.document?.houseRules?.quietHoursFrom || '22:00').slice(0,5)} đến {String(policy?.document?.houseRules?.quietHoursTo || '07:00').slice(0,5)}</li>
                </ul>
              </div>
            </article>
            {policy?.document?.dayUse?.enabled && <article className="day-use-policy-card">
              <i><Icon name="calendar" size={24} /></i>
              <div>
                <b>Đặt và trả trong ngày</b>
                <strong>{String(policy.document.dayUse.from).slice(0,5)} – {String(policy.document.dayUse.to).slice(0,5)}</strong>
                <ul>
                  <li>Tối đa 3 giờ: {policy.document.dayUse.upToThreeHoursPercent}% giá phòng/đêm</li>
                  <li>Tối đa 6 giờ: {policy.document.dayUse.upToSixHoursPercent}% giá phòng/đêm</li>
                  <li>Trên 6 giờ: {policy.document.dayUse.overSixHoursPercent}% giá phòng/đêm</li>
                  <li>Đặt cọc {policy.document.dayUse.depositPercent}%; không hoàn cọc nếu hủy trong {policy.document.dayUse.nonRefundableCancellationWindowHours} giờ trước giờ nhận</li>
                </ul>
              </div>
            </article>}
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

      {/* Lightbox thư viện ảnh homestay */}
      {galleryModalOpen && (
        <div
          className="gallery-lightbox-modal"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGalleryModalOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh homestay"
        >
          <div className="gallery-lightbox-top">
            <div className="gallery-lightbox-info">
              <span className="gallery-lightbox-counter">
                {safePhotoIndex + 1} / {galleryImages.length}
              </span>
              <span className="gallery-lightbox-title">
                {galleryImages[safePhotoIndex]?.caption || data.name}
              </span>
            </div>
            <button
              type="button"
              className="gallery-lightbox-close"
              onClick={() => setGalleryModalOpen(false)}
              aria-label="Đóng thư viện ảnh"
            >
              ×
            </button>
          </div>

          <div className="gallery-lightbox-stage">
            <button
              type="button"
              className="gallery-lightbox-arrow prev"
              onClick={() =>
                setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1))
              }
              aria-label="Ảnh trước"
            >
              <Icon name="chevronLeft" size={24} color="#fff" />
            </button>

            <img
              src={galleryImages[safePhotoIndex]?.url || galleryImages[0]?.url}
              alt={galleryImages[safePhotoIndex]?.caption || data.name}
              className="gallery-lightbox-img"
            />

            <button
              type="button"
              className="gallery-lightbox-arrow next"
              onClick={() =>
                setActivePhotoIndex((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0))
              }
              aria-label="Ảnh tiếp theo"
            >
              <Icon name="chevronRight" size={24} color="#fff" />
            </button>
          </div>

          <div className="gallery-lightbox-thumbs">
            {galleryImages.map((img, idx) => (
              <button
                type="button"
                key={img.id || idx}
                className={`gallery-lightbox-thumb ${idx === safePhotoIndex ? 'active' : ''}`}
                onClick={() => setActivePhotoIndex(idx)}
                aria-label={`Xem ảnh ${idx + 1}`}
              >
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
