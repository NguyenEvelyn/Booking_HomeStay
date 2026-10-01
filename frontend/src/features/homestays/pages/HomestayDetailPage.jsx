import React, { useEffect, useRef, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import { recommendationSessionId, recordRecommendationEvent } from '../api/recommendationEvents.js';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import GuestPickerDropdown from '../../../shared/components/GuestPickerDropdown.jsx';
import { freshImageUrl } from '../../../shared/utils/freshImageUrl.js';
import { bookingApi } from '../../bookings/api/bookingApi.js';
import HomestayPolicyModal from './HomestayPolicyModal.jsx';
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

const toDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateVN = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const formatShortDateVN = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2];
    const month = parts[1];
    const year = parts[0];
    return `${day} Th${parseInt(month, 10)} ${year}`;
  }
  return dateStr;
};

const getCalendarMonthDays = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days = [];
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthLastDate - i);
    days.push({
      dateStr: toDateStr(d),
      dayNum: prevMonthLastDate - i,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({
      dateStr: toDateStr(d),
      dayNum: i,
      isCurrentMonth: true,
    });
  }

  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({
      dateStr: toDateStr(d),
      dayNum: i,
      isCurrentMonth: false,
    });
  }

  return days;
};

export default function HomestayDetailPage({ id, initialSearch, user, onHome, onBack, onBookings, onAccount, onDeveloping, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [arrival, setArrival] = useState(initialSearch?.checkIn || '');
  const [departure, setDeparture] = useState(initialSearch?.checkOut || '');
  const [adultCount, setAdultCount] = useState(initialSearch?.adults || initialSearch?.guests || 2);
  const [childCount, setChildCount] = useState(initialSearch?.children || 0);
  const [roomQuantity, setRoomQuantity] = useState(initialSearch?.rooms || 1);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [activeRoomImage, setActiveRoomImage] = useState(0);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [roomCalendarData, setRoomCalendarData] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(() => !(initialSearch?.checkIn && initialSearch?.checkOut));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarHoverDate, setCalendarHoverDate] = useState(null);
  const [dateAvailability, setDateAvailability] = useState(null);
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
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
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

  const [policies, setPolicies] = useState(null);
  const [showAllPolicies, setShowAllPolicies] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setError('');
    homestayApi.detail(id).then((next) => {
      setData(next);
      setSelectedRoom((current) => {
        if (!current) return current;
        const fresh = next.roomTypes.find((room) => room.id === current.id);
        return fresh ? { ...current, ...fresh } : null;
      });
    }).catch((e) => setError(e.message));

    homestayApi.effectivePolicies(id)
      .then(setPolicies)
      .catch((err) => console.warn('Could not load effective policies:', err));
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
    if (!selectedRoom?.id) {
      setRoomCalendarData(null);
      return;
    }
    let isMounted = true;
    setCalendarLoading(true);
    homestayApi.roomCalendar(selectedRoom.id, 6)
      .then((res) => {
        if (isMounted) {
          setRoomCalendarData(res);
          setCalendarLoading(false);
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải lịch phòng:', err);
        if (isMounted) setCalendarLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedRoom?.id]);

  useEffect(() => {
    if (!arrival || !departure || departure <= arrival) {
      setDateAvailability(null);
      return undefined;
    }
    let active = true;
    homestayApi.availability(id, { checkIn: arrival, checkOut: departure, guests: 1, rooms: 1 }).then((result) => {
      if (!active) return;
      setDateAvailability(Object.fromEntries(
        (result.items || []).map((item) => [item.roomTypeId, item.availableRooms || 0])
      ));
    }).catch((availabilityError) => {
      if (active) {
        setDateAvailability(null);
        setBookingError(availabilityError.message);
      }
    });
    return () => { active = false; };
  }, [id, arrival, departure, refreshKey]);

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
  const hasValidStayDates = Boolean(arrival && departure && departure > arrival);
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
    setSelectedRoom(room); setShowPaymentPage(false); setActiveRoomImage(0); setRoomQuantity(availableQuantity);
    setAdultCount((value) => Math.max(1, Math.min(value, capacityPerRoom * availableQuantity)));
    setChildCount(0);
    setCalendarOpen(!(arrival && departure));
    setCalendarMonth(new Date());
    setBookingError('');
    window.setTimeout(() => document.getElementById('room-detail-inline')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    try { const detail = await homestayApi.roomTypeDetail(room.id); setSelectedRoom((current) => current?.id === room.id ? { ...current, ...detail, availableRoomCount: current.availableRoomCount } : current); } catch { /* giữ dữ liệu danh sách nếu tải gallery thất bại */ }
  };
  const closeRoomDetail = () => { setSelectedRoom(null); setShowPaymentPage(false); window.setTimeout(() => document.querySelector('.rooms-section')?.scrollIntoView({ behavior: 'smooth' }), 0); };

  const todayStr = toDateStr(new Date());
  const isPast = (dateStr) => Boolean(dateStr && dateStr < todayStr);
  const isBooked = (dateStr) => {
    if (!dateStr || isPast(dateStr)) return false;
    if (!roomCalendarData) return false;
    return (
      (Array.isArray(roomCalendarData.bookedDates) && roomCalendarData.bookedDates.includes(dateStr)) ||
      roomCalendarData.dailyStatus?.[dateStr]?.status === 'booked'
    );
  };
  const isAvailable = (dateStr) => {
    if (!dateStr || isPast(dateStr)) return false;
    if (isBooked(dateStr)) return false;
    return true;
  };

  const handleCalendarDateClick = (dateStr) => {
    if (!dateStr || isPast(dateStr)) return;
    if (isBooked(dateStr)) {
      setBookingError(`Ngày ${formatDateVN(dateStr)} phòng này đã kín/được đặt trước. Vui lòng chọn ngày khác.`);
      return;
    }
    setBookingError('');
    if (!arrival || (arrival && departure)) {
      setArrival(dateStr);
      setDeparture('');
      return;
    }
    if (arrival && !departure) {
      if (dateStr <= arrival) {
        setArrival(dateStr);
        setDeparture('');
        return;
      }
      let cur = new Date(arrival);
      const end = new Date(dateStr);
      let hasBlocked = false;
      let conflictDate = '';
      while (cur < end) {
        const curStr = toDateStr(cur);
        if (isBooked(curStr)) {
          hasBlocked = true;
          conflictDate = curStr;
          break;
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (hasBlocked) {
        setBookingError(`Không thể chọn khoảng này vì ngày ${formatDateVN(conflictDate)} phòng đã có người đặt trước.`);
        return;
      }
      setDeparture(dateStr);
      setCalendarOpen(false);
    }
  };

  const handleClearDates = () => {
    setArrival('');
    setDeparture('');
    setBookingError('');
  };

  const handlePrevMonth = () => {
    const today = new Date();
    const currentFirst = new Date(today.getFullYear(), today.getMonth(), 1);
    const target = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    if (target >= currentFirst) {
      setCalendarMonth(target);
    }
  };

  const handleNextMonth = () => {
    const maxMonth = new Date();
    maxMonth.setMonth(maxMonth.getMonth() + 6);
    const target = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    if (target <= maxMonth) {
      setCalendarMonth(target);
    }
  };

  const isPrevMonthDisabled = () => {
    const today = new Date();
    return (
      calendarMonth.getFullYear() === today.getFullYear() &&
      calendarMonth.getMonth() === today.getMonth()
    );
  };

  const calendarDays = getCalendarMonthDays(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth()
  );
  const bookingNights = arrival && departure ? Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000)) : 0;
  const allowedGuestCapacity=selectedRoom?(selectedRoom.extraGuestAllowed?selectedRoom.maxCapacity:selectedRoom.baseCapacity)*roomQuantity:1;
  const includedAdultCount = selectedRoom ? selectedRoom.baseCapacity * roomQuantity : 0;
  const extraAdultCount = Math.max(0, adultCount - includedAdultCount);
  const extraChildCount = Math.max(0,childCount-Math.max(0,includedAdultCount-adultCount));
  const roomPriceTotal = selectedRoom ? selectedRoom.basePrice * bookingNights * roomQuantity : 0;
  const extraAdultTotal = extraAdultCount * (selectedRoom?.extraGuestFee || 0) * bookingNights;
  const childFeeTotal = extraChildCount * (selectedRoom?.extraChildFee || 0) * bookingNights;
  const extraFeeTotal = extraAdultTotal + childFeeTotal;
  const bookingGrandTotal = roomPriceTotal + extraFeeTotal;
  const quotedRoomTotal = priceQuote?.roomTotal ?? roomPriceTotal;
  const quotedExtraAdultTotal = priceQuote?.extraAdultFee ?? extraAdultTotal;
  const quotedChildFeeTotal = priceQuote?.extraChildFee ?? childFeeTotal;
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
          <aside className="payment-summary"><h2>Chi tiết thanh toán</h2><div><span>{roomQuantity} phòng × {bookingNights} đêm</span><strong>{money(quotedRoomTotal)}</strong></div>{extraAdultCount > 0 && <div><span>Phụ thu {extraAdultCount} người lớn</span><strong>{money(quotedExtraAdultTotal)}</strong></div>}{childCount > 0 && <div><span>Phụ thu {childCount} trẻ em</span><strong>{money(quotedChildFeeTotal)}</strong></div>}<div><span>Phí dịch vụ</span><strong>0 đ</strong></div><hr /><div className="payment-grand-total"><span>Tổng thanh toán</span><strong>{money(quotedGrandTotal)}</strong></div>{bookingError && <div className="booking-error">{bookingError}</div>}<button disabled={bookingBusy || paymentSecondsLeft <= 0} onClick={payWithVnPay}>{bookingBusy ? 'Đang kết nối VNPay...' : paymentSecondsLeft <= 0 ? 'Thời gian giữ giá đã hết' : 'Tiếp tục đến VNPay →'}</button><small>🔒 Giao dịch được bảo mật bởi VNPay</small></aside>
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
                    <Icon name="user" size={15} color="#0b4ae6" />
                    Tối đa {selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity} khách
                  </span>
                  <span className="room-fact-pill">
                    <Icon name="bed" size={15} color="#0b4ae6" />
                    {selectedRoom.bedType}
                  </span>
                  <span className="room-fact-pill">
                    <Icon name="maximize" size={15} color="#0b4ae6" />
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
                    <li>
                      <i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i>
                      <span>WiFi tốc độ cao miễn phí</span>
                    </li>
                    <li>
                      <i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i>
                      <span>Máy điều hòa 2 chiều</span>
                    </li>
                    <li>
                      <i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i>
                      <span>Phòng tắm riêng &amp; nước nóng</span>
                    </li>
                    <li>
                      <i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i>
                      <span>TV thông minh màn hình phẳng</span>
                    </li>
                    <li>
                      <i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i>
                      <span>Ấm đun siêu tốc &amp; minibar</span>
                    </li>
                    <li>
                      <i className="amenity-icon-check"><Icon name="check" size={14} color="#10b981" /></i>
                      <span>{selectedRoom.name.toLowerCase().includes('ban công') ? 'Ban công riêng, ngắm cảnh ngoài trời' : 'Dọn phòng & khăn sạch hằng ngày'}</span>
                    </li>
                  </ul>
                </div>

                <hr className="room-info-sep" />

                <div className="room-policy-block">
                  <h3 className="room-block-title">Chính sách phòng</h3>
                  <div className="room-policy-cards-grid">
                    <div className="room-policy-mini-card">
                      <span className="mini-card-label">Nhận phòng</span>
                      <strong className="mini-card-val">Từ {data.checkInTime ? data.checkInTime.slice(0, 5) : '14:00'}</strong>
                      <small className="mini-card-sub">Nhận phòng linh hoạt</small>
                    </div>
                    <div className="room-policy-mini-card">
                      <span className="mini-card-label">Trả phòng</span>
                      <strong className="mini-card-val">Trước {data.checkOutTime ? data.checkOutTime.slice(0, 5) : '12:00'}</strong>
                      <small className="mini-card-sub">Bàn giao phòng</small>
                    </div>
                    <div className="room-policy-mini-card highlight-green">
                      <span className="mini-card-label">Hủy phòng</span>
                      <strong className="mini-card-val">Miễn phí trước 7 ngày</strong>
                      <small className="mini-card-sub">Hoàn tiền 100%</small>
                    </div>
                  </div>
                </div>
              </article>

              <aside className="room-page-booking modern-booking-card">
                <div className="booking-card-top-bar">
                  <span className="booking-gold-badge">GIÁ PHÒNG</span>
                  <div className="booking-rate-display">
                    <strong className="booking-price-number">{money(selectedRoom.basePrice)}</strong>
                    <span className="booking-price-period">/ phòng / đêm</span>
                  </div>
                  <div className={`booking-stock-pill ${selectedRoom.availableRoomCount > 0 ? 'is-in-stock' : 'is-sold-out'}`}>
                    {selectedRoom.availableRoomCount > 0 ? (
                      <>
                        <Icon name="check" size={13} color="#15803d" />
                        <span>{selectedRoom.availableRoomCount} phòng đang còn trống</span>
                      </>
                    ) : (
                      <>
                        <Icon name="x" size={13} color="#b91c1c" />
                        <span>Tạm hết phòng này</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Chọn ngày lưu trú với trigger & popover/inline calendar */}
                <div className="booking-section-group">
                  <div className="booking-group-header">
                    <label className="booking-group-title">
                      <Icon name="calendar" size={14} color="#0b4ae6" />
                      <span>Thời gian lưu trú</span>
                    </label>
                    {arrival && departure && (
                      <button
                        type="button"
                        className="booking-clear-dates-btn"
                        onClick={handleClearDates}
                      >
                        Xóa ngày
                      </button>
                    )}
                  </div>

                  <div
                    className={`booking-date-trigger-row ${calendarOpen ? 'is-open' : ''}`}
                    onClick={() => setCalendarOpen(!calendarOpen)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={`date-trigger-box ${arrival ? 'has-date' : ''}`}>
                      <span className="trigger-label">NGÀY NHẬN</span>
                      <span className="trigger-val-text">{arrival ? formatShortDateVN(arrival) : 'Chọn ngày'}</span>
                    </div>
                    <div className="date-trigger-arrow">
                      <Icon name="chevronRight" size={15} color="#94a3b8" />
                    </div>
                    <div className={`date-trigger-box ${departure ? 'has-date' : ''}`}>
                      <span className="trigger-label">NGÀY TRẢ</span>
                      <span className="trigger-val-text">{departure ? formatShortDateVN(departure) : 'Chọn ngày'}</span>
                    </div>
                  </div>

                  {/* Lịch đặt phòng tương tác: Xanh lá (còn trống) / Đỏ (đã đặt) */}
                  {calendarOpen && (
                    <div className="room-interactive-calendar">
                      <div className="cal-header">
                        <button
                          type="button"
                          className="cal-month-nav-btn"
                          onClick={handlePrevMonth}
                          disabled={isPrevMonthDisabled()}
                          title="Tháng trước"
                        >
                          <Icon name="chevronLeft" size={14} />
                        </button>
                        <span className="cal-current-month-text">
                          Tháng {calendarMonth.getMonth() + 1}, {calendarMonth.getFullYear()}
                        </span>
                        <button
                          type="button"
                          className="cal-month-nav-btn"
                          onClick={handleNextMonth}
                          title="Tháng sau"
                        >
                          <Icon name="chevronRight" size={14} />
                        </button>
                      </div>

                      {calendarLoading && (
                        <div className="cal-loading-bar">
                          <div className="detail-loader" style={{ width: 16, height: 16, borderWidth: 2 }} />
                          <span>Đang tải lịch...</span>
                        </div>
                      )}

                      {/* Header các ngày trong tuần */}
                      <div className="cal-weekdays">
                        <span>T2</span>
                        <span>T3</span>
                        <span>T4</span>
                        <span>T5</span>
                        <span>T6</span>
                        <span>T7</span>
                        <span>CN</span>
                      </div>

                      {/* Lưới ngày */}
                      <div className="cal-grid">
                        {calendarDays.map((dayItem, idx) => {
                          const { dateStr, dayNum, isCurrentMonth } = dayItem;
                          const past = isPast(dateStr);
                          const booked = isBooked(dateStr);
                          const available = isAvailable(dateStr);
                          const isArr = arrival === dateStr;
                          const isDep = departure === dateStr;
                          const inRange = arrival && departure && dateStr > arrival && dateStr < departure;
                          const isHoverRange = arrival && !departure && calendarHoverDate && dateStr > arrival && dateStr <= calendarHoverDate && !booked;

                          let dayClass = 'cal-day';
                          if (!isCurrentMonth) dayClass += ' other-month';
                          if (past) dayClass += ' is-past';
                          else if (booked) dayClass += ' is-booked'; // MÀU ĐỎ: ĐÃ ĐƯỢC ĐẶT
                          else if (available) dayClass += ' is-available'; // MÀU XANH LÁ: CÒN TRỐNG

                          if (isArr) dayClass += ' is-arrival';
                          if (isDep) dayClass += ' is-departure';
                          if (inRange) dayClass += ' is-in-range';
                          if (isHoverRange) dayClass += ' is-hover-range';

                          return (
                            <button
                              key={`${dateStr}-${idx}`}
                              type="button"
                              className={dayClass}
                              disabled={past || booked || !isCurrentMonth}
                              onClick={() => handleCalendarDateClick(dateStr)}
                              onMouseEnter={() => setCalendarHoverDate(dateStr)}
                              onMouseLeave={() => setCalendarHoverDate(null)}
                              title={
                                past ? 'Ngày đã qua' :
                                booked ? 'Ngày này phòng đã kín / có người đặt trước' :
                                `Còn trống ngày ${formatDateVN(dateStr)} (Nhấp để chọn)`
                              }
                            >
                              <span className="day-number">{dayNum}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Chú thích màu sắc */}
                      <div className="cal-legend">
                        <div className="legend-tag legend-green">
                          <span className="legend-color-box green" />
                          <span>Còn trống (Xanh)</span>
                        </div>
                        <div className="legend-tag legend-red">
                          <span className="legend-color-box red" />
                          <span>Đã đặt (Đỏ)</span>
                        </div>
                        <div className="legend-tag legend-blue">
                          <span className="legend-color-box blue" />
                          <span>Đang chọn</span>
                        </div>
                      </div>

                      <div className="cal-footer">
                        {bookingNights > 0 ? (
                          <span className="cal-nights-counter">
                            ✓ {bookingNights} đêm ({formatDateVN(arrival)} → {formatDateVN(departure)})
                          </span>
                        ) : (
                          <span className="cal-hint-text">
                            {!arrival ? 'Chọn ngày nhận phòng' : 'Chọn ngày trả phòng'}
                          </span>
                        )}
                        <button
                          type="button"
                          className="cal-close-btn"
                          onClick={() => setCalendarOpen(false)}
                        >
                          {arrival && departure ? 'Xong ✓' : 'Đóng'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chọn số khách & số lượng phòng */}
                <div className="booking-section-group">
                  <div className="booking-group-title">
                    <Icon name="user" size={14} color="#0b4ae6" />
                    <span>Số lượng khách &amp; phòng</span>
                  </div>
                  <div className="booking-guests-grid">
                    <div className="guest-select-card">
                      <span className="guest-card-label">Người lớn</span>
                      <select
                        className="guest-card-select"
                        value={adultCount}
                        onChange={(e) => { setAdultCount(Number(e.target.value)); setBookingError(''); }}
                      >
                        {Array.from({ length: Math.max(1, allowedGuestCapacity - childCount) }, (_, i) => i + 1).map((value) => (
                          <option key={value} value={value}>{value} người</option>
                        ))}
                      </select>
                    </div>

                    <div className="guest-select-card">
                      <span className="guest-card-label">Trẻ em</span>
                      <select
                        className="guest-card-select"
                        value={childCount}
                        onChange={(e) => { setChildCount(Number(e.target.value)); setBookingError(''); }}
                      >
                        {Array.from({ length: Math.max(0, allowedGuestCapacity - adultCount) + 1 }, (_, i) => i).map((value) => (
                          <option key={value} value={value}>{value} trẻ em</option>
                        ))}
                      </select>
                    </div>

                    <div className="guest-select-card">
                      <span className="guest-card-label">Số phòng</span>
                      <select
                        className="guest-card-select"
                        value={roomQuantity}
                        onChange={(e) => {
                          const quantity = Number(e.target.value);
                          setRoomQuantity(quantity);
                          const allowed = (selectedRoom.extraGuestAllowed ? selectedRoom.maxCapacity : selectedRoom.baseCapacity) * quantity;
                          setAdultCount((value) => Math.max(1, Math.min(value, allowed)));
                          setChildCount(0);
                          setBookingError('');
                        }}
                      >
                        {Array.from({ length: selectedRoomAvailableCount === null ? 1 : Math.max(1, Math.min(selectedRoomAvailableCount, 10)) }, (_, i) => i + 1).map((value) => (
                          <option key={value} value={value}>{value} phòng</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="booking-capacity-note">
                  <small>
                    * Giá gồm {selectedRoom.baseCapacity} khách/phòng{selectedRoom.extraGuestAllowed && selectedRoom.maxCapacity > selectedRoom.baseCapacity ? `; tối đa ${selectedRoom.maxCapacity} khách. Phụ thu: người lớn ${money(selectedRoom.extraGuestFee)}, trẻ em 0–${selectedRoom.childMaxAge ?? 11} tuổi ${money(selectedRoom.extraChildFee)}/đêm` : ''}.
                  </small>
                </div>

                {/* Bảng chi tiết giá khi đã chọn số đêm */}
                {bookingNights > 0 && (
                  <div className="booking-bill-card">
                    <div className="bill-line">
                      <span>Tiền phòng ({bookingNights} đêm × {roomQuantity} phòng)</span>
                      <strong>{money(roomPriceTotal)}</strong>
                    </div>
                    {extraAdultCount > 0 && (
                      <div className="bill-line">
                        <span>Phụ thu {extraAdultCount} người lớn</span>
                        <strong>+ {money(extraAdultTotal)}</strong>
                      </div>
                    )}
                    {extraChildCount > 0 && (
                      <div className="bill-line">
                        <span>Phụ thu {extraChildCount} trẻ em</span>
                        <strong>+ {money(childFeeTotal)}</strong>
                      </div>
                    )}
                    <div className="bill-sep" />
                    <div className="bill-line bill-grand-total">
                      <span>Tổng thanh toán</span>
                      <strong className="bill-total-amount">{money(bookingGrandTotal)}</strong>
                    </div>
                  </div>
                )}

                {bookingError && (
                  <div className="booking-alert-box">
                    <Icon name="x" size={16} color="#dc2626" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="booking-submit-action-btn"
                  disabled={!hasValidStayDates || selectedRoomAvailableCount === 0 || bookingBusy}
                  onClick={openPaymentPage}
                >
                  {bookingBusy
                    ? 'Đang kiểm tra...'
                    : !hasValidStayDates
                    ? 'Chọn ngày để kiểm tra'
                    : (selectedRoomAvailableCount > 0 ? 'Đến trang thanh toán →' : 'Phòng đã hết trong ngày đã chọn')}
                </button>
                <div className="booking-security-badge">
                  <Icon name="shield" size={13} color="#15803d" />
                  <span>Chưa phát sinh giao dịch ở bước này · Yên tâm đặt phòng</span>
                </div>
              </aside>
            </div>
          </section>
        )}

        {/* Dynamic Homestay Policy Section */}
        {(() => {
          const policyDoc = policies?.document;
          const policyCheckIn = policyDoc?.checkInOut?.checkInTime
            ? policyDoc.checkInOut.checkInTime.slice(0, 5)
            : data.checkInTime.slice(0, 5);
          const policyCheckOut = policyDoc?.checkInOut?.checkOutTime
            ? policyDoc.checkInOut.checkOutTime.slice(0, 5)
            : data.checkOutTime.slice(0, 5);

          const cancellationTiers = policies?.cancellationTiers || [];
          const fullRefundTier = cancellationTiers.find((t) => t.refundPercent >= 100);
          const topRefundTier = cancellationTiers.length > 0
            ? [...cancellationTiers].sort((a, b) => b.refundPercent - a.refundPercent)[0]
            : null;

          let cancelHighlight = 'Hủy phòng linh hoạt theo mốc';
          let cancelSubtitle = 'Xem chi tiết các mốc hoàn tiền';
          if (fullRefundTier) {
            cancelHighlight = `Hoàn 100% trước ${fullRefundTier.minimumDays} ngày`;
            cancelSubtitle = cancellationTiers.length > 1 ? `Có ${cancellationTiers.length} mốc hoàn tiền linh hoạt` : 'Miễn phí hủy phòng';
          } else if (topRefundTier && topRefundTier.refundPercent > 0) {
            cancelHighlight = `Hoàn ${topRefundTier.refundPercent}% trước ${topRefundTier.minimumDays} ngày`;
            cancelSubtitle = `Xử lý hoàn tiền trong 3–15 ngày làm việc`;
          }

          const houseRules = policyDoc?.houseRules;
          const quietTime = houseRules?.quietHoursFrom
            ? `Giữ yên tĩnh ${houseRules.quietHoursFrom.slice(0, 5)} - ${houseRules.quietHoursTo.slice(0, 5)}`
            : 'Giữ yên tĩnh sau 22:00';
          const smokingRule = houseRules?.smokingInRoomAllowed
            ? 'Cho phép hút thuốc (khu vực quy định)'
            : 'Không hút thuốc trong phòng';
          const petRule = policyDoc?.pets?.allowed
            ? `Cho phép thú cưng (phụ phí ${money(policyDoc.pets.feePerNight || 150000)}/đêm)`
            : 'Không mang theo thú cưng';

          return (
            <section id="policy" className="detail-box policy-section">
              <header className="section-title policy-header">
                <div>
                  <small>THÔNG TIN CẦN BIẾT</small>
                  <h2>Chính sách homestay</h2>
                </div>
                <button
                  type="button"
                  className="btn-policy-modal-trigger"
                  onClick={() => setShowAllPolicies(true)}
                >
                  Xem tất cả chính sách →
                </button>
              </header>
              <div className="policy-grid">
                <article>
                  <i><Icon name="clock" size={24} /></i>
                  <div>
                    <b>Nhận phòng</b>
                    <strong>Từ {policyCheckIn}</strong>
                    <small>
                      {policyDoc?.checkInOut?.earlyCheckInTiers?.some((t) => t.percent === 0)
                        ? 'Hỗ trợ check-in sớm miễn phí (tùy phòng)'
                        : 'Vui lòng xuất trình giấy tờ tùy thân'}
                    </small>
                  </div>
                </article>
                <article>
                  <i><Icon name="clock" size={24} /></i>
                  <div>
                    <b>Trả phòng</b>
                    <strong>Trước {policyCheckOut}</strong>
                    <small>
                      {houseRules?.freeLuggageStorageHoursAfterCheckout
                        ? `Gửi hành lý miễn phí ${houseRules.freeLuggageStorageHoursAfterCheckout}h sau trả phòng`
                        : 'Hỗ trợ trả phòng linh hoạt (khi có thể)'}
                    </small>
                  </div>
                </article>
                <article>
                  <i><Icon name="fileText" size={24} /></i>
                  <div>
                    <b>Hủy phòng & Hoàn tiền</b>
                    <strong>{cancelHighlight}</strong>
                    <small>{cancelSubtitle}</small>
                  </div>
                </article>
                <article>
                  <i><Icon name="shield" size={24} /></i>
                  <div>
                    <b>Quy định chung</b>
                    <ul>
                      <li>{smokingRule}</li>
                      <li>{petRule}</li>
                      <li>{quietTime}</li>
                    </ul>
                  </div>
                </article>
              </div>
            </section>
          );
        })()}

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

      {/* Modal chi tiết đầy đủ chính sách homestay */}
      <HomestayPolicyModal
        isOpen={showAllPolicies}
        onClose={() => setShowAllPolicies(false)}
        homestayName={data?.name}
        policies={policies}
        defaultCheckIn={data?.checkInTime}
        defaultCheckOut={data?.checkOutTime}
      />
    </main>
  );
}
