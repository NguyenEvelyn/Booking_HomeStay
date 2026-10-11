import React, { useEffect, useRef, useState } from 'react';
import './styles/home.css';
import { homestayApi } from '../homestays/api/homestayApi.js';
import GuestPickerDropdown from '../../shared/components/GuestPickerDropdown.jsx';

const heroImage = '/assets/figma/hero.png';
const aboutImage = '/assets/figma/about.jpg';
const sunsetImage = '/assets/figma/stay-sunset.jpg';
const azureImage = '/assets/figma/stay-azure.jpg';
const oceanImage = '/assets/figma/stay-ocean.png';
const coastalImage = '/assets/figma/stay-coastal.jpg';
const seasideImage = '/assets/figma/stay-seaside.jpg';
const offersImage = '/assets/figma/offers-bg.png';
const ctaWaveBanner = '/assets/figma/herobanner.jpg';
const supportBanner = '/assets/figma/herobanner.png';
const voucherWeek = '/assets/figma/voucher-week.png';
const voucherHotDeal = '/assets/figma/voucher-hotdeal.png';
const voucherSummer = '/assets/figma/voucher-summer.png';
const blogOne = '/assets/figma/blog-1.jpg';
const blogTwo = '/assets/figma/blog-2.jpg';
const blogThree = '/assets/figma/blog-3.jpg';
const phuQuoc = '/assets/figma/destination-phuquoc.png';
const quyNhon = '/assets/figma/destination-quynhon.jpg';
const vungTau = '/assets/figma/destination-vungtau.jpg';
const daNang = '/assets/figma/destination-danang.png';
const haLong = '/assets/figma/destination-halong.jpg';
const honSon = '/assets/figma/destination-honson.jpg';
const canTho = '/assets/figma/destination-cantho.jpg';
const phuQuy = '/assets/figma/destination-phuquy.png';
const logoWhite = '/assets/figma/tripio-logo-white.png';
const localIsoDate = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

function Icon({ name }) {
  const icons = {
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    arrowUpRight: (
      <>
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    heart: (
      <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 0 1 12 6a5 5 0 0 1 7.5 6.6Z" />
    ),
    suitcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 12v3M16 12v3M3 13h18" />
      </>
    ),
    star: (
      <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.8Z" />
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    homePlus: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-6h6v6" />
        <path d="M18 3v5M15.5 5.5h5" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
      </>
    ),
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    ),
    message: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>
    ),
    arrowLeft: <path d="M19 12H5m7-7-7 7 7 7" />,
    arrowRight: <path d="M5 12h14m-7-7 7 7-7 7" />,
    mail: (
      <>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </>
    ),
    facebook: (
      <path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z" />
    ),
    tiktok: (
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 3 15.68a6.34 6.34 0 0 0 6.34 6.32 6.34 6.34 0 0 0 6.34-6.32V8.9a8.16 8.16 0 0 0 4.91 1.63v-3.45a4.85 4.85 0 0 1-1-.39z" />
    ),
    youtube: (
      <path d="M21.582 6.186a2.506 2.506 0 0 0-1.764-1.774C18.258 4 12 4 12 4s-6.258 0-7.818.412a2.506 2.506 0 0 0-1.764 1.774C2 7.754 2 12 2 12s0 4.246.418 5.814a2.506 2.506 0 0 0 1.764 1.774C5.742 20 12 20 12 20s6.258 0 7.818-.412a2.506 2.506 0 0 0 1.764-1.774C22 16.246 22 12 22 12s0-4.246-.418-5.814zM10 15.5v-7l6 3.5-6 3.5z" />
    ),
    instagram: (
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    ),
    thumbsUp: (
      <path d="M7 10v12M15 10.5a3 3 0 0 0-3-3l.5-3.5a1.8 1.8 0 0 0-3.5-.8L6 10H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12.5a2.5 2.5 0 0 0 2.4-1.8l2-7A2 2 0 0 0 18 10.5z" />
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      focusable="false"
    >
      {icons[name]}
    </svg>
  );
}

const stays = [
  {
    name: 'The Sunset Residence',
    location: 'Phú Quốc, Việt Nam',
    price: '1,456k VND',
    rating: '4,8',
    image: sunsetImage,
  },
  {
    name: 'Azure Bay Retreat',
    location: 'Đà Nẵng, Việt Nam',
    price: '1,156k VND',
    rating: '4,2',
    image: azureImage,
  },
  {
    name: 'Ocean Crest Residence',
    location: 'Quy Nhơn, Việt Nam',
    price: '2,559k VND',
    rating: '4,9',
    image: oceanImage,
  },
  {
    name: 'The Coastal Haven',
    location: 'Phú Quý, Việt Nam',
    price: '1,009k VND',
    rating: '4,1',
    image: coastalImage,
  },
  {
    name: 'Seaside Pearl Resort',
    location: 'Vĩnh Hy, Việt Nam',
    price: '1,999k VND',
    rating: '4,9',
    image: seasideImage,
  },
];

const destinations = [
  ['01', 'Phú Quốc', phuQuoc],
  ['02', 'Quy Nhơn', quyNhon],
  ['03', 'Vũng Tàu', vungTau],
  ['04', 'Đà Nẵng', daNang],
  ['05', 'Vịnh Hạ Long', haLong],
  ['06', 'Hòn Sơn', honSon],
  ['07', 'Cần Thơ', canTho],
  ['08', 'Phú Quý', phuQuy],
];

const posts = [
  ['5 điểm đến biển lý tưởng cho chuyến đi cuối tuần', blogOne],
  ['Bí quyết lựa chọn homestay phù hợp cho mọi chuyến đi', blogTwo],
  ['Những trải nghiệm không thể bỏ lỡ trong hành trình', blogThree],
];

const offers = [
  voucherWeek,
  voucherHotDeal,
  voucherSummer,
  voucherHotDeal,
  voucherWeek,
];

export default function HomePage({
  user,
  onLogout,
  onDeveloping,
  onBrowseHomestays,
  onOpenHomestay,
  onChangePassword,
  onBookings,
  onHostPortal,
  onAdminPortal,
  onRegisterHomestay,
  onRegisterHost,
  onProfile,
}) {
  const [menuScrolled, setMenuScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [activeHero, setActiveHero] = useState(0);
  const [heroDragStart, setHeroDragStart] = useState(null);
  const [heroDragOffset, setHeroDragOffset] = useState(0);
  const [navPill, setNavPill] = useState({ left: 0, width: 0 });
  const navRef = useRef(null);
  const userMenuRef = useRef(null);
  const navItemRefs = useRef({});
  const stayGridRef = useRef(null);
  const stayDrag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const destTrackRef = useRef(null);
  const destDrag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [canDestPrev, setCanDestPrev] = useState(false);
  const [canDestNext, setCanDestNext] = useState(true);
  const voucherListRef = useRef(null);
  const voucherDrag = useRef({ active: false, startY: 0, scrollTop: 0 });
  const blogTrackRef = useRef(null);
  const blogDrag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const [canBlogPrev, setCanBlogPrev] = useState(false);
  const [canBlogNext, setCanBlogNext] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchCheckIn, setSearchCheckIn] = useState('');
  const [searchCheckOut, setSearchCheckOut] = useState('');
  const [guestsConfig, setGuestsConfig] = useState({ adults: 2, children: 0, rooms: 1 });
  const [apiStays, setApiStays] = useState([]);
  const [heroPicks, setHeroPicks] = useState([]);
  const [heroPicksLoading, setHeroPicksLoading] = useState(true);

  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const closeMenu = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    let mounted = true;
    const mapStay = (item, idx) => ({
              id: item.id,
              name: item.name,
              location: `${item.district || ''}, ${item.province || ''}`.replace(/^,\s*/, '') || 'Việt Nam',
              price: typeof item.fromPrice === 'number'
                ? `Từ ${new Intl.NumberFormat('vi-VN').format(item.fromPrice)} đ`
                : item.fromPrice || '1,456k VND',
              rating: item.averageRating ? Number(item.averageRating).toFixed(1).replace('.', ',') : '4,8',
              image: item.thumbnailUrl || stays[idx % stays.length].image,
              description: item.description || null,
            });

    Promise.allSettled([
      homestayApi.list({ pageSize: 8, sort: 'rating_desc' }),
      homestayApi.recommendations({ topK: 4, guests: 2, adults: 2, children: 0, rooms: 1 }),
    ]).then(([listResult, recommendationResult]) => {
      if (!mounted) return;
      const realStays = listResult.status === 'fulfilled'
        ? (listResult.value?.items || []).map(mapStay)
        : [];
      setApiStays(realStays);

      if (recommendationResult.status === 'fulfilled' && recommendationResult.value?.items?.length) {
        setHeroPicks(recommendationResult.value.items.map((item, index) => ({
          id: item.id,
          name: item.name,
          location: [item.district, item.province].filter(Boolean).join(', '),
          image: item.thumbnailUrl || realStays.find((stay) => stay.id === item.id)?.image || heroImage,
          score: Math.round(Number(item.score || 0)),
          reason: item.reasons?.[0] || 'Phù hợp với nhu cầu của bạn',
          isTop: index === 0,
        })));
      } else {
        setHeroPicks(realStays.slice(0, 4).map((item, index) => ({
          ...item,
          score: Math.round(Number(String(item.rating).replace(',', '.')) * 20),
          reason: item.location,
          isTop: index === 0,
        })));
      }
      setHeroPicksLoading(false);
    }).catch(() => {
      if (mounted) {
        setHeroPicksLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setActiveHero(0);
  }, [heroPicks.length]);

  const displayStays = apiStays.length > 0 ? apiStays : stays;

  const navItems = [
    ['home', 'Trang chủ', '#home'],
    ['about', 'Giới thiệu', '#about'],
    ['destination', 'Địa điểm', '#stays'],
    ['homestay', 'Homestay', '#stays'],
    ['offers', 'Ưu đãi', '#offers'],
    ['news', 'Tin tức', '#news'],
  ];

  const moveNavPill = (key) => {
    const item = navItemRefs.current[key];
    if (!item) return;

    setNavPill({
      left: item.offsetLeft,
      width: item.offsetWidth,
    });
  };

  const handleNavClick = (event, key, target) => {
    event.preventDefault();
    setActiveNav(key);
    moveNavPill(key);

    const section = document.querySelector(target);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const changeHero = (index) => {
    const total = heroPicks.length;
    if (!total) return;
    const nextIndex = (index + total) % total;

    setActiveHero(nextIndex);
    setHeroDragOffset(0);
  };

  const handleHeroPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);

    setHeroDragStart({
      y: event.clientY,
    });
  };

  const handleHeroPointerMove = (event) => {
    if (!heroDragStart) return;

    setHeroDragOffset(event.clientY - heroDragStart.y);
  };

  const handleHeroPointerUp = () => {
    if (!heroDragStart) return;

    const delta = heroDragOffset;

    if (Math.abs(delta) > 45) {
      if (delta < 0) {
        changeHero(activeHero + 1);
      } else {
        changeHero(activeHero - 1);
      }
    }

    setHeroDragOffset(0);
    setHeroDragStart(null);
  };

  const handleHeroWheel = (event) => {
    event.preventDefault();

    if (Math.abs(event.deltaY) < 5) return;

    if (event.deltaY > 0) {
      changeHero(activeHero + 1);
    } else {
      changeHero(activeHero - 1);
    }
  };

  /* ---- stays drag-to-scroll mượt mà ---- */
  const onStayMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = stayGridRef.current;
    if (!el) return;

    stayDrag.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
    el.classList.add('is-dragging');

    const onWindowMouseMove = (moveEvent) => {
      if (!stayDrag.current.active) return;
      const dx = moveEvent.clientX - stayDrag.current.startX;
      if (Math.abs(dx) > 5) {
        stayDrag.current.moved = true;
      }
      el.scrollLeft = stayDrag.current.scrollLeft - dx;
    };

    const onWindowMouseUp = () => {
      stayDrag.current.active = false;
      el.classList.remove('is-dragging');
      // Delay reset so onClick can read moved first, then reset for next interaction
      setTimeout(() => {
        stayDrag.current.moved = false;
      }, 0);
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
  };

  /* ---- destinations scroll & drag ---- */
  const checkDestScroll = () => {
    const el = destTrackRef.current;
    if (!el) return;
    setCanDestPrev(el.scrollLeft > 10);
    setCanDestNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const handleDestScroll = (direction) => {
    const el = destTrackRef.current;
    if (!el) return;
    const scrollAmount = 320;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkDestScroll, 350);
  };

  const openDestination = (name) => {
    if (typeof onBrowseHomestays === 'function') {
      onBrowseHomestays({ location: name });
    } else {
      onDeveloping(`Điểm đến ${name}`);
    }
  };

  const onDestMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = destTrackRef.current;
    if (!el) return;

    destDrag.current = {
      active: true,
      startX: e.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };

    const onMouseMove = (moveEvent) => {
      if (!destDrag.current.active) return;
      const dx = moveEvent.clientX - destDrag.current.startX;
      if (Math.abs(dx) > 4) {
        destDrag.current.moved = true;
        el.classList.add('is-dragging');
      }
      el.scrollLeft = destDrag.current.scrollLeft - dx;
      checkDestScroll();
    };

    const onMouseUp = () => {
      destDrag.current.active = false;
      el.classList.remove('is-dragging');
      checkDestScroll();
      // Giữ cờ moved đến hết sự kiện click hiện tại, sau đó mở lại
      // khả năng bấm cho lần tương tác tiếp theo.
      setTimeout(() => {
        destDrag.current.moved = false;
      }, 0);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  /* ---- voucher list vertical drag-to-scroll ---- */
  const onVoucherMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = voucherListRef.current;
    if (!el) return;

    voucherDrag.current = {
      active: true,
      startY: e.clientY,
      scrollTop: el.scrollTop,
    };

    const onMouseMove = (moveEvent) => {
      if (!voucherDrag.current.active) return;
      const dy = moveEvent.clientY - voucherDrag.current.startY;
      el.scrollTop = voucherDrag.current.scrollTop - dy;
    };

    const onMouseUp = () => {
      voucherDrag.current.active = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  /* ---- blog carousel scroll & drag ---- */
  const checkBlogScroll = () => {
    const el = blogTrackRef.current;
    if (!el) return;
    setCanBlogPrev(el.scrollLeft > 10);
    setCanBlogNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const handleBlogScroll = (dir) => {
    const el = blogTrackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -640 : 640, behavior: 'smooth' });
    setTimeout(checkBlogScroll, 350);
  };

  const onBlogMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = blogTrackRef.current;
    if (!el) return;
    blogDrag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
    el.classList.add('is-dragging');
    const onMove = (mv) => {
      if (!blogDrag.current.active) return;
      const dx = mv.clientX - blogDrag.current.startX;
      if (Math.abs(dx) > 4) blogDrag.current.moved = true;
      el.scrollLeft = blogDrag.current.scrollLeft - dx;
      checkBlogScroll();
    };
    const onUp = () => {
      blogDrag.current.active = false;
      el.classList.remove('is-dragging');
      checkBlogScroll();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    const updateMenu = () => setMenuScrolled(window.scrollY > 24);
    updateMenu();
    window.addEventListener('scroll', updateMenu, { passive: true });
    return () => window.removeEventListener('scroll', updateMenu);
  }, []);

  useEffect(() => {
    const syncPill = () => moveNavPill(activeNav);
    const frame = window.requestAnimationFrame(syncPill);
    window.addEventListener('resize', syncPill);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', syncPill);
    };
  }, [activeNav]);

  return (
    <div className="home-page">

      {/* =====================================================
          HERO - 1440 x 750 DESKTOP
          ===================================================== */}
      <section className="hero" id="home">
        <div className="hero-background" aria-hidden="true">
          {(heroPicks.length ? heroPicks : [{ id: 'fallback', name: 'Tripio', image: heroImage }]).map((item, index) => (
            <img
              key={item.id}
              src={item.image}
              alt=""
              className={`hero-background-image ${
                activeHero === index ? 'is-active' : ''
              }`}
            />
          ))}
        </div>
        <nav
          className={`home-nav${
            menuScrolled ? ' is-scrolled' : ''
          }`}
        >
          <a className="home-logo" href="#home">
            <img src={logoWhite} alt="Tripio" />
          </a>

          <div className="nav-links" ref={navRef}>
            <span
              className="nav-active-pill"
              style={{
                width: navPill.width,
                transform: `translateX(${navPill.left}px)`,
              }}
              aria-hidden="true"
            />

            {navItems.map(([key, label, target]) => (
              <a
                key={key}
                ref={(node) => {
                  navItemRefs.current[key] = node;
                }}
                className={activeNav === key ? 'active' : ''}
                href={target}
                onClick={(event) =>
                  handleNavClick(event, key, target)
                }
              >
                {label}
              </a>
            ))}
          </div>

          <div className="nav-actions" ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Tài khoản"
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              title={user?.fullName ? `Tài khoản (${user.fullName})` : 'Đăng nhập'}
              onClick={() => {
                if (user && user.fullName && user.fullName !== 'Khách') {
                  setUserMenuOpen((prev) => !prev);
                } else {
                  onLogout();
                }
              }}
            >
              <Icon name="user" />
            </button>

            {userMenuOpen && user && user.fullName !== 'Khách' && (
              <div className="home-user-menu" role="menu" aria-label="Menu tài khoản">
                <div className="home-user-menu__identity">
                  <span className="home-user-menu__avatar" aria-hidden="true">
                    {user.fullName?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <div>
                    <strong>{user.fullName}</strong>
                    <span>{user.email || user.role}</span>
                  </div>
                </div>

                {user.role === 'Host' && (
                  <button
                    type="button"
                    className="home-user-menu__item is-primary"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onHostPortal?.();
                    }}
                  >
                    <i><Icon name="homePlus" /></i>
                    <span><b>Quản lý Homestay</b><small>Đi đến trung tâm đối tác</small></span>
                  </button>
                )}

                {user.role === 'Admin' && (
                  <button
                    type="button"
                    className="home-user-menu__item is-primary"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      onAdminPortal?.();
                    }}
                  >
                    <i><Icon name="profile" /></i>
                    <span><b>Trang quản trị</b><small>Quản lý hệ thống Tripio</small></span>
                  </button>
                )}

                <button
                  type="button"
                  className="home-user-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onBookings?.();
                  }}
                >
                  <i><Icon name="suitcase" /></i>
                  <span><b>Chuyến đi của tôi</b><small>Xem và quản lý các kỳ lưu trú</small></span>
                </button>

                <button
                  type="button"
                  className="home-user-menu__item"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onDeveloping('Danh sách yêu thích');
                  }}
                >
                  <i><Icon name="heart" /></i>
                  <span><b>Danh sách yêu thích</b><small>Những nơi bạn đã lưu</small></span>
                </button>

                <button type="button" className="home-user-menu__item" role="menuitem" onClick={() => { setUserMenuOpen(false); onDeveloping('Nhận xét của tôi'); }}>
                  <i><Icon name="star" /></i>
                  <span><b>Nhận xét của tôi</b><small>Quản lý đánh giá đã viết</small></span>
                </button>

                <button type="button" className="home-user-menu__item" role="menuitem" onClick={() => { setUserMenuOpen(false); onProfile?.(); }}>
                  <i><Icon name="profile" /></i>
                  <span><b>Hồ sơ của tôi</b><small>Thông tin và tùy chọn cá nhân</small></span>
                </button>

                <button type="button" className="home-user-menu__item" role="menuitem" onClick={() => { setUserMenuOpen(false); onChangePassword?.(); }}>
                  <i><Icon name="lock" /></i>
                  <span><b>Đổi mật khẩu</b><small>Bảo mật tài khoản của bạn</small></span>
                </button>

                {user.role !== 'Host' && user.role !== 'Admin' && (
                  <section className="home-user-menu__host-card" aria-label="Đăng ký cơ sở lưu trú">
                    <span className="home-user-menu__host-orbit" aria-hidden="true" />
                    <small>TRỞ THÀNH ĐỐI TÁC TRIPIO</small>
                    <strong>Biến không gian của bạn thành một hành trình đáng nhớ.</strong>
                    <button type="button" role="menuitem" onClick={() => {
                      setUserMenuOpen(false);
                      if (onRegisterHomestay) onRegisterHomestay();
                      else onRegisterHost?.();
                    }}>
                      <span>Đăng ký cho thuê nhà</span>
                      <Icon name="arrowUpRight" />
                    </button>
                  </section>
                )}

                <button
                  type="button"
                  className="home-user-menu__item is-logout"
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                >
                  <i><Icon name="logout" /></i>
                  <span><b>Đăng xuất</b></span>
                </button>
              </div>
            )}

            <button
              type="button"
              aria-label="Yêu thích"
              onClick={() =>
                onDeveloping('Danh sách yêu thích')
              }
            >
              <Icon name="heart" />
            </button>
          </div>
        </nav>

        <div className="hero-shade" />

        <div className="hero-content">
          <h1>
            <strong>FIND YOUR</strong> PERFECT STAY
          </h1>

          <p>
            Khám phá những không gian lưu trú tuyệt vời,
            từ những căn homestay ấm cúng đến các điểm
            nghỉ dưỡng sang trọng, và bắt đầu hành trình
            của riêng bạn với những trải nghiệm đáng nhớ
          </p>
        </div>

        <div
          className={`hero-picks${heroDragStart ? ' is-dragging' : ''}`}
          aria-label="Homestay hot do AI Tripio gợi ý"
          onPointerDown={handleHeroPointerDown}
          onPointerMove={handleHeroPointerMove}
          onPointerUp={handleHeroPointerUp}
          onPointerCancel={handleHeroPointerUp}
          onWheel={handleHeroWheel}
        >
          <div
            className="hero-picks-track"
            style={{
              transform: `translateY(calc(-${activeHero * 132}px + ${heroDragOffset}px))`,
            }}
          >
            {heroPicksLoading && (
              <article className="hero-pick-loading" aria-live="polite">
                <span>AI đang chọn Homestay phù hợp…</span>
              </article>
            )}
            {!heroPicksLoading && heroPicks.length === 0 && (
              <article className="hero-pick-empty">
                <span>Chưa có Homestay nổi bật</span>
              </article>
            )}
            {heroPicks.map((item, index) => (
              <article
                key={item.id}
                className={index === activeHero ? 'is-active' : ''}
                onClick={() => {
                  if (Math.abs(heroDragOffset) < 10) {
                    changeHero(index);
                  }
                }}
              >
                <img src={item.image} alt={`Ảnh ${item.name}`} draggable="false" />

                <div className="hero-pick-copy">
                  <small className={item.isTop ? 'is-hot' : ''}>
                    {item.isTop ? 'HOT NHẤT · AI GỢI Ý' : `${item.score}% PHÙ HỢP`}
                  </small>
                  <strong>{item.name}</strong>
                  <em>{item.location || item.reason}</em>
                </div>

                <button
                  type="button"
                  aria-label={`Xem chi tiết ${item.name}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenHomestay?.(item.id);
                  }}
                >
                  <Icon name="arrowUpRight" />
                </button>
              </article>
            ))}
          </div>
        </div>

      </section>


      {/* =====================================================
          SEARCH
          ===================================================== */}
      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          if (typeof onBrowseHomestays === 'function') {
            onBrowseHomestays({
              search: searchLocation,
              checkIn: searchCheckIn,
              checkOut: searchCheckOut,
              guests: guestsConfig.adults + guestsConfig.children,
            });
          } else {
            onDeveloping('Tìm phòng');
          }
        }}
      >
        <label>
          Địa điểm hoặc tên khách sạn

          <span className="search-control">
            <input
              placeholder="Bạn muốn đến đâu?"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
            />

            <i><Icon name="location" /></i>
          </span>
        </label>

        <label>
          Ngày nhận

          <span className="search-control date-control">
            <input
              type="date"
              aria-label="Ngày nhận phòng"
              min={localIsoDate()}
              value={searchCheckIn}
              onChange={(e) => {
                setSearchCheckIn(e.target.value);
                if (searchCheckOut && searchCheckOut < e.target.value) setSearchCheckOut('');
              }}
            />
          </span>
        </label>

        <label>
          Ngày trả

          <span className="search-control date-control">
            <input
              type="date"
              aria-label="Ngày trả phòng"
              min={searchCheckIn || localIsoDate()}
              value={searchCheckOut}
              onChange={(e) => setSearchCheckOut(e.target.value)}
            />
          </span>
        </label>

        <GuestPickerDropdown
          value={guestsConfig}
          onChange={setGuestsConfig}
        />

        <button type="submit">
          Tìm phòng
        </button>
      </form>


      {/* =====================================================
          ABOUT
          ===================================================== */}
      <section
        className="about-section page-section"
        id="about"
      >
        <div className="about-image">
          <img
            src={aboutImage}
            alt="Biệt thự nghỉ dưỡng Tripio"
          />
        </div>

        <div className="about-copy">
          <div className="about-title-block">
            <p className="kicker">
              VỀ CHÚNG TÔI
            </p>

            <h2>
              CÙNG TRIPIO KẾT NỐI NHỮNG
              <br />
              HÀNH TRÌNH{' '}
              <em>ĐÁNG NHỚ</em>
            </h2>
          </div>

          <p>
            Tripio là nền tảng đặt phòng homestay
            trực tuyến, giúp bạn dễ dàng tìm kiếm,
            khám phá và lựa chọn không gian lưu trú
            phù hợp cho mỗi chuyến đi. Chúng tôi mang
            đến đa dạng lựa chọn lưu trú cùng trải nghiệm
            đặt phòng nhanh chóng, tiện lợi và đáng tin cậy.
          </p>

          <div className="trust-row">
            <p className="review-label">Đánh giá</p>

            <div className="trust-body">
              <div className="trust-item">
                <div className="avatars">
                  <i /><i /><i />
                </div>
                <div className="trust-text">
                  <b>Tin tưởng bởi</b>
                  <span>900+ Khách hàng</span>
                </div>
              </div>

              <div className="trust-divider" />

              <div className="rating-item">
                <b>4.8 ⭐⭐⭐⭐⭐</b>
                <span>600+ Lượt đánh giá</span>
              </div>
            </div>
          </div>

          <div className="stats">
            <div>
              <b>1000+</b>
              <span>Chỗ ở chất lượng</span>
            </div>

            <div>
              <b>50+</b>
              <span>Điểm đến hấp dẫn</span>
            </div>

            <div>
              <b>98%</b>
              <span>Khách hàng hài lòng</span>
            </div>

            <div>
              <b>2000+</b>
              <span>Lượt đặt thành công</span>
            </div>
          </div>
        </div>
      </section>


      {/* =====================================================
          STAYS
          ===================================================== */}
      <section
        className="stays-section"
        id="stays"
      >
        <div className="stays-intro">
          <div className="stays-title-block">
            <p className="kicker dark">DÀNH CHO BẠN</p>

            <h2>
              HOMESTAY ĐƯỢC
              <br />
              <em>YÊU THÍCH</em>
            </h2>
          </div>

          <div className="stays-bottom-block">
            <p>
              Khám phá các homestay được nhiều du khách
              yêu thích và lựa chọn cho hành trình đáng nhớ
              cùng những trải nghiệm trọn vẹn
            </p>

            <button
              type="button"
              className="stays-all-btn"
              onClick={() => {
                if (typeof onBrowseHomestays === 'function') {
                  onBrowseHomestays();
                } else {
                  onDeveloping('Xem tất cả homestay');
                }
              }}
            >
              <span>Xem tất cả</span>
              <span className="arrow-circle">
                <Icon name="arrowUpRight" />
              </span>
            </button>
          </div>
        </div>

        <div
          className="stay-grid"
          ref={stayGridRef}
          onMouseDown={onStayMouseDown}
        >
          {displayStays.map((stay) => {
            const goToDetail = (wasMoved) => {
              if (wasMoved) return;
              if (stay.id && typeof onOpenHomestay === 'function') {
                onOpenHomestay(stay.id);
              } else if (typeof onBrowseHomestays === 'function') {
                onBrowseHomestays();
              } else {
                onDeveloping('Đặt phòng');
              }
            };

            return (
              <article
                className="stay-card"
                key={stay.id || stay.name}
                style={{ cursor: 'pointer' }}
                onMouseUp={(e) => {
                  if (e.button !== 0) return;
                  goToDetail(stayDrag.current.moved);
                }}
              >
                {/* Background Image */}
                <img
                  className="stay-card-bg"
                  src={stay.image}
                  alt={stay.name}
                  draggable="false"
                />

                {/* Top: Location Badge | Heart Button */}
                <div className="stay-top">
                  <span className="stay-location-badge">
                    <Icon name="location" />
                    <span>{stay.location}</span>
                  </span>

                  <button
                    type="button"
                    className="stay-heart-btn"
                    aria-label="Yêu thích"
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (stayDrag.current.moved) return;
                      onDeveloping('Yêu thích homestay');
                    }}
                  >
                    <Icon name="heart" />
                  </button>
                </div>

                {/* Rectangle blur overlay W 350 H 185 từ Figma */}
                <div className="stay-blur-overlay" aria-hidden="true" />

                {/* Card info */}
                <div className="stay-info">
                  <div className="stay-title-row">
                    <h3>{stay.name}</h3>
                    <span className="stay-rating-badge">
                      {stay.rating} <span className="star-icon">★</span>
                    </span>
                  </div>

                  <p>
                    {stay.description || 'Khám phá điểm dừng chân hoàn hảo với trải nghiệm nghỉ dưỡng tiện nghi và đầy cảm hứng'}
                  </p>

                  <footer>
                    <b>{stay.price}</b>
                    <button
                      type="button"
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        goToDetail(stayDrag.current.moved);
                      }}
                    >
                      Đặt phòng
                    </button>
                  </footer>
                </div>
              </article>
            );
          })}


        </div>
      </section>


      {/* =====================================================
          CTA - BANNER SÓNG BIỂN (1440 x 600)
          ===================================================== */}
      <section
        className="cta-section"
        id="offers"
      >
        <img
          className="cta-bg-image"
          src={ctaWaveBanner}
          alt="Banner sóng biển Tripio"
          draggable="false"
        />

        <div className="cta-content">
          <p className="kicker">
            BẮT ĐẦU HÀNH TRÌNH
          </p>

          <h2>
            ĐẶT <em>HOMESTAY</em> DỄ DÀNG VÀ KHÁM PHÁ
            <br />
            NHIỀU HƠN CÙNG <em>TRIPIO</em>
          </h2>

          <button
            type="button"
            className="cta-all-btn"
            onClick={() => {
              if (typeof onBrowseHomestays === 'function') {
                onBrowseHomestays();
              } else {
                onDeveloping('Đặt phòng');
              }
            }}
          >
            <span>Đặt phòng ngay</span>
            <span className="arrow-circle">
              <Icon name="arrowUpRight" />
            </span>
          </button>
        </div>
      </section>


      {/* =====================================================
          DESTINATIONS
          ===================================================== */}
      <section className="destinations-section page-section">
        <header>
          <div>
            <p className="kicker dark">
              XU HƯỚNG DU LỊCH
            </p>

            <h2>
              CÁC ĐIỂM ĐẾN ĐANG <em>THỊNH HÀNH</em>
            </h2>
          </div>

          <div className="carousel-arrows">
            <button
              type="button"
              className={`dest-arrow ${canDestPrev ? 'active' : ''}`}
              onClick={() => handleDestScroll('left')}
              aria-label="Điểm đến trước"
            >
              <Icon name="arrowLeft" />
            </button>

            <button
              type="button"
              className={`dest-arrow ${canDestNext ? 'active' : ''}`}
              onClick={() => handleDestScroll('right')}
              aria-label="Điểm đến tiếp theo"
            >
              <Icon name="arrowRight" />
            </button>
          </div>
        </header>

        <div
          className="destination-track"
          ref={destTrackRef}
          onMouseDown={onDestMouseDown}
          onScroll={checkDestScroll}
        >
          {destinations.map(
            ([number, name, image]) => (
              <article
                className="dest-card"
                key={name}
                role="link"
                tabIndex={0}
                aria-label={`Xem homestay và đặt phòng tại ${name}`}
                onClick={() => {
                  if (destDrag.current.moved) return;
                  openDestination(name);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  openDestination(name);
                }}
              >
                <img
                  className="dest-card-bg"
                  src={image}
                  alt={name}
                  draggable="false"
                />

                <div className="dest-card-overlay" aria-hidden="true" />

                <b className="dest-number">{number}</b>

                <div className="dest-bottom-info">
                  <span className="dest-name">{name}</span>
                  <span className="dest-circle-arrow">
                    <Icon name="arrowRight" />
                  </span>
                </div>
              </article>
            )
          )}
        </div>
      </section>


      {/* =====================================================
          OFFERS
          ===================================================== */}
      <div className="offers-outer">
        <p className="offers-watermark" aria-hidden="true">
          TRIPIO HOMESTAY
        </p>

        <section
          className="offers-section"
          id="offers"
          style={{
            backgroundImage: `url('${offersImage}')`,
          }}
        >
          <div className="offers-copy">
            <img
              className="offers-logo-img"
              src={logoWhite}
              alt="tripio"
            />

            <div className="offers-text-block">
              <p className="offers-kicker">
                ƯU ĐÃI CÙNG TRIPIO
              </p>

              <h2>
                SĂN NGAY NHỮNG{' '}
                <em>KHUYẾN MÃI</em>
                {' '}HẤP DẪN NHẤT
              </h2>
            </div>
          </div>

          <div
            className="voucher-list"
            aria-label="Danh sách ưu đãi"
            ref={voucherListRef}
            onMouseDown={onVoucherMouseDown}
          >
            {[
              {
                img: voucherWeek,
                label: 'Tuần lễ vàng',
                title: 'ƯU ĐÃI TUẦN LỄ VÀNG',
                desc: 'Giảm đến 30% cho đơn đặt phòng đầu tiên khi bạn trải nghiệm và đặt homestay trên Tripio',
              },
              {
                img: voucherHotDeal,
                label: 'Summer Hot Deal',
                title: 'SUMMER HOT DEAL – SIÊU ƯU ĐÃI 55%',
                desc: 'Ưu đãi đặc biệt mùa hè: giảm đến 55% cho các gói nghỉ dưỡng cao cấp tại Tripio',
              },
              {
                img: voucherSummer,
                label: 'Summer Essential Sale',
                title: 'SUMMER ESSENTIAL SALE',
                desc: 'Kỳ nghỉ mùa hè trọn vẹn với ưu đãi giảm giá độc quyền dành riêng cho thành viên Tripio',
              },
              {
                img: voucherWeek,
                label: 'Cuối tuần vui',
                title: 'ƯU ĐÃI CUỐI TUẦN VUI VẺ',
                desc: 'Giảm ngay 20% khi đặt phòng vào cuối tuần – áp dụng cho tất cả các homestay trên Tripio',
              },
              {
                img: voucherHotDeal,
                label: 'Flash Sale',
                title: 'FLASH SALE – GIẢM ĐẾN 40%',
                desc: 'Chớp ngay cơ hội vàng: flash sale 24h giảm đến 40% toàn bộ homestay ven biển',
              },
              {
                img: voucherSummer,
                label: 'Lễ tết',
                title: 'ƯU ĐÃI DỊP LỄ TẾT 2025',
                desc: 'Đặt sớm – nghỉ ngon: ưu đãi đặc biệt dịp lễ Tết dành cho gia đình và nhóm bạn',
              },
            ].map(({ img, label, title, desc }, index) => (
              <article
                className="voucher-card"
                key={`voucher-${index}`}
              >
                <img
                  className="voucher-card-thumb"
                  src={img}
                  alt={label}
                />

                <div className="voucher-card-body">
                  <h3>{title}</h3>

                  <p>{desc}</p>

                  <button
                    type="button"
                    className="voucher-save-btn"
                    onClick={() => onDeveloping('Lưu voucher')}
                  >
                    Lưu voucher
                  </button>
                </div>

                <button
                  className="voucher-info-btn"
                  type="button"
                  aria-label="Thông tin ưu đãi"
                  onClick={() => onDeveloping('Thông tin ưu đãi')}
                >
                  <Icon name="info" />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>


      {/* =====================================================
          SUPPORT
          ===================================================== */}
      <section
        className="support-section"
        style={{ backgroundImage: `url('${supportBanner}')` }}
      >
        <div className="support-copy">
          <p>
            LUÔN ĐỒNG HÀNH CÙNG BẠN
          </p>

          <h2>
            SẴN SÀNG GIẢI ĐÁP THẮC MẮC
          </h2>
        </div>

        <div className="support-actions">
          <a href="tel:0963508070">
            <span><Icon name="phone" /></span>

            <div className="support-btn-text">
              <small>Hotline</small>
              <b>0963 508 070</b>
            </div>
          </a>

          <button
            type="button"
            onClick={() => onDeveloping('Nhắn tin tư vấn')}
          >
            <span><Icon name="message" /></span>
            <b>Nhắn tin tư vấn</b>
          </button>
        </div>
      </section>


      {/* =====================================================
          NEWS
          ===================================================== */}
      <section
        className="guide-section page-section"
        id="news"
      >
        {/* ---- Header row: kicker+h2 left, arrows right ---- */}
        <header className="guide-header">
          <div className="guide-title-block">
            <p className="kicker dark">CẨM NANG DU LỊCH</p>

            <h2>
              CẬP NHẬT XU HƯỚNG VÀ{' '}
              <em>ĐIỂM ĐẾN</em>
            </h2>
          </div>

          <div className="guide-arrows">
            <button
              type="button"
              className={`guide-arrow${canBlogPrev ? ' active' : ''}`}
              aria-label="Trước"
              onClick={() => handleBlogScroll('left')}
            >
              <Icon name="arrowLeft" />
            </button>

            <button
              type="button"
              className={`guide-arrow${canBlogNext ? ' active' : ''}`}
              aria-label="Tiếp theo"
              onClick={() => handleBlogScroll('right')}
            >
              <Icon name="arrowRight" />
            </button>
          </div>
        </header>

        {/* ---- Scrollable cards track ---- */}
        <div
          className="post-track"
          ref={blogTrackRef}
          onMouseDown={onBlogMouseDown}
        >
          {posts.map(([title, image]) => (
            <article className="post-card" key={title}>
              <img
                className="post-card-img"
                src={image}
                alt={title}
                draggable="false"
              />

              <div className="post-card-body">
                <p className="post-date">
                  <Icon name="calendar" />
                  <span>30 Tháng 1, 2026</span>
                </p>

                <h3>{title}</h3>

                <p className="post-desc">
                  Những kinh nghiệm hữu ích giúp bạn dễ dàng
                  tìm được không gian lưu trú phù hợp với nhu
                  cầu, ngân sách và phong cách du lịch của mình
                </p>

                <button
                  type="button"
                  className="post-link"
                  onClick={() => onDeveloping('Cẩm nang du lịch')}
                >
                  Xem thêm →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>



      {/* =====================================================
          FOOTER
          ===================================================== */}
      <footer
        className="home-footer"
        id="footer"
      >
        <div className="footer-newsletter">
          <div className="footer-newsletter-text">
            <h3>ĐĂNG KÝ NHẬN THÔNG TIN</h3>
            <p>
              Luôn được cập nhật về các lời khuyên du lịch và khuyến mãi mới nhất
            </p>
          </div>

          <form
            className="footer-newsletter-form"
            onSubmit={(event) => {
              event.preventDefault();
              onDeveloping('Đăng ký nhận thông tin');
            }}
          >
            <input
              type="email"
              placeholder="Nhập Email của bạn"
              required
            />

            <button type="submit">
              Gửi ngay
            </button>
          </form>
        </div>

        <div className="footer-columns">
          <div className="footer-col footer-col-brand">
            <a
              className="footer-logo"
              href="#home"
            >
              <img src={logoWhite} alt="tripio" />
            </a>

            <p>
              Tripio mang đến giải pháp đặt homestay
              tiện lợi, giúp bạn dễ dàng tìm kiếm
              không gian lưu trú.
            </p>

            <div className="footer-socials">
              <button
                type="button"
                className="footer-social-btn active"
                aria-label="Facebook"
                onClick={() => onDeveloping('Facebook')}
              >
                <Icon name="facebook" />
              </button>

              <button
                type="button"
                className="footer-social-btn"
                aria-label="TikTok"
                onClick={() => onDeveloping('TikTok')}
              >
                <Icon name="tiktok" />
              </button>

              <button
                type="button"
                className="footer-social-btn"
                aria-label="YouTube"
                onClick={() => onDeveloping('YouTube')}
              >
                <Icon name="youtube" />
              </button>

              <button
                type="button"
                className="footer-social-btn"
                aria-label="Instagram"
                onClick={() => onDeveloping('Instagram')}
              >
                <Icon name="instagram" />
              </button>
            </div>
          </div>

          <div className="footer-col footer-col-contact">
            <h4>THÔNG TIN LIÊN HỆ</h4>
            <div className="footer-title-bar" />

            <div className="footer-contact-list">
              <div className="footer-contact-item">
                <span className="footer-contact-icon">
                  <Icon name="location" />
                </span>
                <span>
                  140 Lê Trọng Tấn, Phường Tây Thạnh,
                  <br />
                  TP. Hồ Chí Minh
                </span>
              </div>

              <div className="footer-contact-item">
                <span className="footer-contact-icon">
                  <Icon name="phone" />
                </span>
                <span>Hotline: <b>0963 508 070</b></span>
              </div>

              <div className="footer-contact-item">
                <span className="footer-contact-icon">
                  <Icon name="mail" />
                </span>
                <span>tripio@gmail.com</span>
              </div>

              <div className="footer-contact-item">
                <span className="footer-contact-icon">
                  <Icon name="globe" />
                </span>
                <span>www.tripio.vn</span>
              </div>
            </div>
          </div>

          <div className="footer-col footer-col-links">
            <h4>CÁC CHÍNH SÁCH</h4>
            <div className="footer-title-bar" />

            <div className="footer-link-list">
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Chính sách đặt phòng'); }}>
                Chính sách đặt phòng
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Chính sách thanh toán'); }}>
                Chính sách thanh toán
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Chính sách hủy phòng'); }}>
                Chính sách hủy phòng
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Chính sách hoàn tiền'); }}>
                Chính sách hoàn tiền
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Chính sách bảo mật'); }}>
                Chính sách bảo mật
              </a>
            </div>
          </div>

          <div className="footer-col footer-col-fanpage">
            <h4>FANPAGE</h4>
            <div className="footer-title-bar" />

            <div
              className="footer-fanpage-card"
              style={{ backgroundImage: `url('${supportBanner}')` }}
            >
              <div className="footer-fanpage-overlay" />
              <div className="footer-fanpage-top">
                <div className="footer-fanpage-avatar">
                  <span>tripio</span>
                </div>
                <div className="footer-fanpage-info">
                  <b>Tripio</b>
                  <small>3.108 lượt thích</small>
                </div>
              </div>

              <button
                type="button"
                className="footer-fanpage-btn"
                onClick={() => onDeveloping('Thích fanpage')}
              >
                <Icon name="thumbsUp" />
                <span>Thích trang</span>
              </button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 Copyright TRIPIO. All rights reserved</p>
        </div>
      </footer>

    </div>
  );
}
