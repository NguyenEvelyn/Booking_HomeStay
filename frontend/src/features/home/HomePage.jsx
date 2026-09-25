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
    location: 'Ph├║ Quß╗æc, Viß╗çt Nam',
    price: '1,456k VND',
    rating: '4,8',
    image: sunsetImage,
  },
  {
    name: 'Azure Bay Retreat',
    location: '─É├á Nß║╡ng, Viß╗çt Nam',
    price: '1,156k VND',
    rating: '4,2',
    image: azureImage,
  },
  {
    name: 'Ocean Crest Residence',
    location: 'Quy Nh╞ín, Viß╗çt Nam',
    price: '2,559k VND',
    rating: '4,9',
    image: oceanImage,
  },
  {
    name: 'The Coastal Haven',
    location: 'Ph├║ Qu├╜, Viß╗çt Nam',
    price: '1,009k VND',
    rating: '4,1',
    image: coastalImage,
  },
  {
    name: 'Seaside Pearl Resort',
    location: 'V─⌐nh Hy, Viß╗çt Nam',
    price: '1,999k VND',
    rating: '4,9',
    image: seasideImage,
  },
];

const destinations = [
  ['01', 'Ph├║ Quß╗æc', phuQuoc],
  ['02', 'Quy Nh╞ín', quyNhon],
  ['03', 'V┼⌐ng T├áu', vungTau],
  ['04', '─É├á Nß║╡ng', daNang],
  ['05', 'Vß╗ïnh Hß║í Long', haLong],
  ['06', 'H├▓n S╞ín', honSon],
  ['07', 'Cß║ºn Th╞í', canTho],
  ['08', 'Ph├║ Qu├╜', phuQuy],
];

const posts = [
  ['5 ─æiß╗âm ─æß║┐n biß╗ân l├╜ t╞░ß╗ƒng cho chuyß║┐n ─æi cuß╗æi tuß║ºn', blogOne],
  ['B├¡ quyß║┐t lß╗▒a chß╗ìn homestay ph├╣ hß╗úp cho mß╗ìi chuyß║┐n ─æi', blogTwo],
  ['Nhß╗»ng trß║úi nghiß╗çm kh├┤ng thß╗â bß╗Å lß╗í trong h├ánh tr├¼nh', blogThree],
];

const heroStays = [
  ['The Whispering Pines Retreat', heroImage],
  ['Ocean Breeze Private Retreat', oceanImage],
  ['The Coastal Haven', coastalImage],
  ['Azure Bay Private Retreat', azureImage],
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
}) {
  const [menuScrolled, setMenuScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [activeHero, setActiveHero] = useState(0);
  const [heroDragStart, setHeroDragStart] = useState(null);
  const [heroDragOffset, setHeroDragOffset] = useState(0);
  const [navPill, setNavPill] = useState({ left: 0, width: 0 });
  const navRef = useRef(null);
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

  useEffect(() => {
    let mounted = true;
    homestayApi
      .list({ pageSize: 6 })
      .then((res) => {
        if (mounted && res?.items?.length) {
          setApiStays(
            res.items.map((item, idx) => ({
              id: item.id,
              name: item.name,
              location: `${item.district || ''}, ${item.province || ''}`.replace(/^,\s*/, '') || 'Viß╗çt Nam',
              price: typeof item.fromPrice === 'number'
                ? `Tß╗½ ${new Intl.NumberFormat('vi-VN').format(item.fromPrice)} ─æ`
                : item.fromPrice || '1,456k VND',
              rating: item.averageRating ? Number(item.averageRating).toFixed(1).replace('.', ',') : '4,8',
              image: item.thumbnailUrl || stays[idx % stays.length].image,
              description: item.description || null,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const displayStays = apiStays.length > 0 ? apiStays : stays;

  const navItems = [
    ['home', 'Trang chß╗º', '#home'],
    ['about', 'Giß╗¢i thiß╗çu', '#about'],
    ['destination', '─Éß╗ïa ─æiß╗âm', '#stays'],
    ['homestay', 'Homestay', '#stays'],
    ['offers', '╞»u ─æ├úi', '#offers'],
    ['news', 'Tin tß╗⌐c', '#news'],
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
    const total = heroStays.length;
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

  /* ---- stays drag-to-scroll m╞░ß╗út m├á ---- */
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
    el.classList.add('is-dragging');

    const onMouseMove = (moveEvent) => {
      if (!destDrag.current.active) return;
      const dx = moveEvent.clientX - destDrag.current.startX;
      if (Math.abs(dx) > 4) {
        destDrag.current.moved = true;
      }
      el.scrollLeft = destDrag.current.scrollLeft - dx;
      checkDestScroll();
    };

    const onMouseUp = () => {
      destDrag.current.active = false;
      el.classList.remove('is-dragging');
      checkDestScroll();
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
          {heroStays.map(([name, image], index) => (
            <img
              key={name}
              src={image}
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

          <div className="nav-actions" style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="T├ái khoß║ún"
              title={user?.fullName ? `T├ái khoß║ún (${user.fullName})` : '─É─âng nhß║¡p'}
              onClick={() => {
                if (user && user.fullName && user.fullName !== 'Kh├ích') {
                  setUserMenuOpen((prev) => !prev);
                } else {
                  onLogout();
                }
              }}
            >
              <Icon name="user" />
            </button>

            {userMenuOpen && user && user.fullName !== 'Kh├ích' && (
              <div
                className="home-user-menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  minWidth: '220px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                  padding: '8px 0',
                  zIndex: 250,
                  color: '#071f52',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #edf0f4' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px' }}>{user.fullName}</div>
                  <div style={{ color: '#6b7b93', fontSize: '11px', marginTop: '2px' }}>{user.email || user.role}</div>
                </div>

                {user.role === 'Host' && (
                  <button
                    type="button"
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 0, fontSize: '13px', fontWeight: '600', color: '#0b4ae6', cursor: 'pointer' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onHostPortal?.();
                    }}
                  >
                    Γîé Quß║ún l├╜ Homestay (Host)
                  </button>
                )}

                {user.role === 'Admin' && (
                  <button
                    type="button"
                    style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 0, fontSize: '13px', fontWeight: '600', color: '#0b4ae6', cursor: 'pointer' }}
                    onClick={() => {
                      setUserMenuOpen(false);
                      onAdminPortal?.();
                    }}
                  >
                    ΓÜÖ Trang quß║ún trß╗ï Admin
                  </button>
                )}

                <button
                  type="button"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 0, fontSize: '13px', color: '#1a2744', cursor: 'pointer' }}
                  onClick={() => {
                    setUserMenuOpen(false);
                    onBookings?.();
                  }}
                >
                  ≡ƒôà Ph├▓ng ─æ├ú ─æß║╖t
                </button>

                <button
                  type="button"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 0, fontSize: '13px', color: '#1a2744', cursor: 'pointer' }}
                  onClick={() => {
                    setUserMenuOpen(false);
                    onChangePassword?.();
                  }}
                >
                  ≡ƒöÆ ─Éß╗òi mß║¡t khß║⌐u
                </button>

                <div style={{ borderTop: '1px solid #edf0f4', margin: '4px 0' }} />

                <button
                  type="button"
                  style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 0, fontSize: '13px', color: '#b42318', cursor: 'pointer' }}
                  onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}
                >
                  ≡ƒÜ¬ ─É─âng xuß║Ñt
                </button>
              </div>
            )}

            <button
              type="button"
              aria-label="Y├¬u th├¡ch"
              onClick={() =>
                onDeveloping('Danh s├ích y├¬u th├¡ch')
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
            Kh├ím ph├í nhß╗»ng kh├┤ng gian l╞░u tr├║ tuyß╗çt vß╗¥i,
            tß╗½ nhß╗»ng c─ân homestay ß║Ñm c├║ng ─æß║┐n c├íc ─æiß╗âm
            nghß╗ë d╞░ß╗íng sang trß╗ìng, v├á bß║»t ─æß║ºu h├ánh tr├¼nh
            cß╗ºa ri├¬ng bß║ín vß╗¢i nhß╗»ng trß║úi nghiß╗çm ─æ├íng nhß╗¢
          </p>
        </div>

        <div
          className={`hero-picks${heroDragStart ? ' is-dragging' : ''}`}
          aria-label="Gß╗úi ├╜ homestay nß╗òi bß║¡t"
          onPointerDown={handleHeroPointerDown}
          onPointerMove={handleHeroPointerMove}
          onPointerUp={handleHeroPointerUp}
          onPointerCancel={handleHeroPointerUp}
          onWheel={handleHeroWheel}
        >
          <div
            className="hero-picks-track"
            style={{
              transform: `translateY(calc(-${activeHero * 122}px + ${heroDragOffset}px))`,
            }}
          >
            {heroStays.map(([name, image], index) => (
              <article
                key={`${name}-${index}`}
                className={index === activeHero ? 'is-active' : ''}
                onClick={() => {
                  if (Math.abs(heroDragOffset) < 10) {
                    changeHero(index);
                  }
                }}
              >
                <img src={image} alt="" draggable="false" />

                <span>{name}</span>

                <button
                  type="button"
                  aria-label={`Hiß╗ân thß╗ï ${name}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    changeHero(index);
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
            onDeveloping('T├¼m ph├▓ng');
          }
        }}
      >
        <label>
          ─Éß╗ïa ─æiß╗âm hoß║╖c t├¬n kh├ích sß║ín

          <span className="search-control">
            <input
              placeholder="Bß║ín muß╗æn ─æß║┐n ─æ├óu?"
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
            />

            <i><Icon name="location" /></i>
          </span>
        </label>

        <label>
          Ng├áy nhß║¡n

          <span className="search-control">
            <input
              type="text"
              placeholder="Chß╗ìn ng├áy nhß║¡n"
              value={searchCheckIn}
              onChange={(e) => setSearchCheckIn(e.target.value)}
              onFocus={(event) => {
                event.currentTarget.type = 'date';
              }}
              onBlur={(event) => {
                if (!event.currentTarget.value) {
                  event.currentTarget.type = 'text';
                }
              }}
            />

            <i><Icon name="calendar" /></i>
          </span>
        </label>

        <label>
          Ng├áy trß║ú

          <span className="search-control">
            <input
              type="text"
              placeholder="Chß╗ìn ng├áy trß║ú"
              value={searchCheckOut}
              onChange={(e) => setSearchCheckOut(e.target.value)}
              onFocus={(event) => {
                event.currentTarget.type = 'date';
              }}
              onBlur={(event) => {
                if (!event.currentTarget.value) {
                  event.currentTarget.type = 'text';
                }
              }}
            />

            <i><Icon name="calendar" /></i>
          </span>
        </label>

        <GuestPickerDropdown
          value={guestsConfig}
          onChange={setGuestsConfig}
        />

        <button type="submit">
          T├¼m ph├▓ng
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
            alt="Biß╗çt thß╗▒ nghß╗ë d╞░ß╗íng Tripio"
          />
        </div>

        <div className="about-copy">
          <div className="about-title-block">
            <p className="kicker">
              Vß╗Ç CH├ÜNG T├öI
            </p>

            <h2>
              C├ÖNG TRIPIO Kß║╛T Nß╗ÉI NHß╗«NG
              <br />
              H├ÇNH TR├îNH{' '}
              <em>─É├üNG NHß╗Ü</em>
            </h2>
          </div>

          <p>
            Tripio l├á nß╗ün tß║úng ─æß║╖t ph├▓ng homestay
            trß╗▒c tuyß║┐n, gi├║p bß║ín dß╗à d├áng t├¼m kiß║┐m,
            kh├ím ph├í v├á lß╗▒a chß╗ìn kh├┤ng gian l╞░u tr├║
            ph├╣ hß╗úp cho mß╗ùi chuyß║┐n ─æi. Ch├║ng t├┤i mang
            ─æß║┐n ─æa dß║íng lß╗▒a chß╗ìn l╞░u tr├║ c├╣ng trß║úi nghiß╗çm
            ─æß║╖t ph├▓ng nhanh ch├│ng, tiß╗çn lß╗úi v├á ─æ├íng tin cß║¡y.
          </p>

          <div className="trust-row">
            <p className="review-label">─É├ính gi├í</p>

            <div className="trust-body">
              <div className="trust-item">
                <div className="avatars">
                  <i /><i /><i />
                </div>
                <div className="trust-text">
                  <b>Tin t╞░ß╗ƒng bß╗ƒi</b>
                  <span>900+ Kh├ích h├áng</span>
                </div>
              </div>

              <div className="trust-divider" />

              <div className="rating-item">
                <b>4.8 Γ¡ÉΓ¡ÉΓ¡ÉΓ¡ÉΓ¡É</b>
                <span>600+ L╞░ß╗út ─æ├ính gi├í</span>
              </div>
            </div>
          </div>

          <div className="stats">
            <div>
              <b>1000+</b>
              <span>Chß╗ù ß╗ƒ chß║Ñt l╞░ß╗úng</span>
            </div>

            <div>
              <b>50+</b>
              <span>─Éiß╗âm ─æß║┐n hß║Ñp dß║½n</span>
            </div>

            <div>
              <b>98%</b>
              <span>Kh├ích h├áng h├ái l├▓ng</span>
            </div>

            <div>
              <b>2000+</b>
              <span>L╞░ß╗út ─æß║╖t th├ánh c├┤ng</span>
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
            <p className="kicker dark">D├ÇNH CHO Bß║áN</p>

            <h2>
              HOMESTAY ─É╞»ß╗óC
              <br />
              <em>Y├èU TH├ìCH</em>
            </h2>
          </div>

          <div className="stays-bottom-block">
            <p>
              Kh├ím ph├í c├íc homestay ─æ╞░ß╗úc nhiß╗üu du kh├ích
              y├¬u th├¡ch v├á lß╗▒a chß╗ìn cho h├ánh tr├¼nh ─æ├íng nhß╗¢
              c├╣ng nhß╗»ng trß║úi nghiß╗çm trß╗ìn vß║╣n
            </p>

            <button
              type="button"
              className="stays-all-btn"
              onClick={() => {
                if (typeof onBrowseHomestays === 'function') {
                  onBrowseHomestays();
                } else {
                  onDeveloping('Xem tß║Ñt cß║ú homestay');
                }
              }}
            >
              <span>Xem tß║Ñt cß║ú</span>
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
                onDeveloping('─Éß║╖t ph├▓ng');
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
                    aria-label="Y├¬u th├¡ch"
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (stayDrag.current.moved) return;
                      onDeveloping('Y├¬u th├¡ch homestay');
                    }}
                  >
                    <Icon name="heart" />
                  </button>
                </div>

                {/* Rectangle blur overlay W 350 H 185 tß╗½ Figma */}
                <div className="stay-blur-overlay" aria-hidden="true" />

                {/* Card info */}
                <div className="stay-info">
                  <div className="stay-title-row">
                    <h3>{stay.name}</h3>
                    <span className="stay-rating-badge">
                      {stay.rating} <span className="star-icon">Γÿà</span>
                    </span>
                  </div>

                  <p>
                    {stay.description || 'Kh├ím ph├í ─æiß╗âm dß╗½ng ch├ón ho├án hß║úo vß╗¢i trß║úi nghiß╗çm nghß╗ë d╞░ß╗íng tiß╗çn nghi v├á ─æß║ºy cß║úm hß╗⌐ng'}
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
                      ─Éß║╖t ph├▓ng
                    </button>
                  </footer>
                </div>
              </article>
            );
          })}


        </div>
      </section>


      {/* =====================================================
          CTA - BANNER S├ôNG BIß╗éN (1440 x 600)
          ===================================================== */}
      <section
        className="cta-section"
        id="offers"
      >
        <img
          className="cta-bg-image"
          src={ctaWaveBanner}
          alt="Banner s├│ng biß╗ân Tripio"
          draggable="false"
        />

        <div className="cta-content">
          <p className="kicker">
            Bß║«T ─Éß║ªU H├ÇNH TR├îNH
          </p>

          <h2>
            ─Éß║╢T <em>HOMESTAY</em> Dß╗ä D├ÇNG V├Ç KH├üM PH├ü
            <br />
            NHIß╗ÇU H╞áN C├ÖNG <em>TRIPIO</em>
          </h2>

          <button
            type="button"
            className="cta-all-btn"
            onClick={() => {
              if (typeof onBrowseHomestays === 'function') {
                onBrowseHomestays();
              } else {
                onDeveloping('─Éß║╖t ph├▓ng');
              }
            }}
          >
            <span>─Éß║╖t ph├▓ng ngay</span>
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
              XU H╞»ß╗ÜNG DU Lß╗èCH
            </p>

            <h2>
              C├üC ─ÉIß╗éM ─Éß║╛N ─ÉANG <em>THß╗èNH H├ÇNH</em>
            </h2>
          </div>

          <div className="carousel-arrows">
            <button
              type="button"
              className={`dest-arrow ${canDestPrev ? 'active' : ''}`}
              onClick={() => handleDestScroll('left')}
              aria-label="─Éiß╗âm ─æß║┐n tr╞░ß╗¢c"
            >
              <Icon name="arrowLeft" />
            </button>

            <button
              type="button"
              className={`dest-arrow ${canDestNext ? 'active' : ''}`}
              onClick={() => handleDestScroll('right')}
              aria-label="─Éiß╗âm ─æß║┐n tiß║┐p theo"
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
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (destDrag.current.moved) return;
                  if (typeof onBrowseHomestays === 'function') {
                    onBrowseHomestays({ search: name });
                  } else {
                    onDeveloping(`─Éiß╗âm ─æß║┐n ${name}`);
                  }
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
                ╞»U ─É├âI C├ÖNG TRIPIO
              </p>

              <h2>
                S─éN NGAY NHß╗«NG{' '}
                <em>KHUYß║╛N M├âI</em>
                {' '}Hß║ñP Dß║¬N NHß║ñT
              </h2>
            </div>
          </div>

          <div
            className="voucher-list"
            aria-label="Danh s├ích ╞░u ─æ├úi"
            ref={voucherListRef}
            onMouseDown={onVoucherMouseDown}
          >
            {[
              {
                img: voucherWeek,
                label: 'Tuß║ºn lß╗à v├áng',
                title: '╞»U ─É├âI TUß║ªN Lß╗ä V├ÇNG',
                desc: 'Giß║úm ─æß║┐n 30% cho ─æ╞ín ─æß║╖t ph├▓ng ─æß║ºu ti├¬n khi bß║ín trß║úi nghiß╗çm v├á ─æß║╖t homestay tr├¬n Tripio',
              },
              {
                img: voucherHotDeal,
                label: 'Summer Hot Deal',
                title: 'SUMMER HOT DEAL ΓÇô SI├èU ╞»U ─É├âI 55%',
                desc: '╞»u ─æ├úi ─æß║╖c biß╗çt m├╣a h├¿: giß║úm ─æß║┐n 55% cho c├íc g├│i nghß╗ë d╞░ß╗íng cao cß║Ñp tß║íi Tripio',
              },
              {
                img: voucherSummer,
                label: 'Summer Essential Sale',
                title: 'SUMMER ESSENTIAL SALE',
                desc: 'Kß╗│ nghß╗ë m├╣a h├¿ trß╗ìn vß║╣n vß╗¢i ╞░u ─æ├úi giß║úm gi├í ─æß╗Öc quyß╗ün d├ánh ri├¬ng cho th├ánh vi├¬n Tripio',
              },
              {
                img: voucherWeek,
                label: 'Cuß╗æi tuß║ºn vui',
                title: '╞»U ─É├âI CUß╗ÉI TUß║ªN VUI Vß║║',
                desc: 'Giß║úm ngay 20% khi ─æß║╖t ph├▓ng v├áo cuß╗æi tuß║ºn ΓÇô ├íp dß╗Ñng cho tß║Ñt cß║ú c├íc homestay tr├¬n Tripio',
              },
              {
                img: voucherHotDeal,
                label: 'Flash Sale',
                title: 'FLASH SALE ΓÇô GIß║óM ─Éß║╛N 40%',
                desc: 'Chß╗¢p ngay c╞í hß╗Öi v├áng: flash sale 24h giß║úm ─æß║┐n 40% to├án bß╗Ö homestay ven biß╗ân',
              },
              {
                img: voucherSummer,
                label: 'Lß╗à tß║┐t',
                title: '╞»U ─É├âI Dß╗èP Lß╗ä Tß║╛T 2025',
                desc: '─Éß║╖t sß╗¢m ΓÇô nghß╗ë ngon: ╞░u ─æ├úi ─æß║╖c biß╗çt dß╗ïp lß╗à Tß║┐t d├ánh cho gia ─æ├¼nh v├á nh├│m bß║ín',
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
                    onClick={() => onDeveloping('L╞░u voucher')}
                  >
                    L╞░u voucher
                  </button>
                </div>

                <button
                  className="voucher-info-btn"
                  type="button"
                  aria-label="Th├┤ng tin ╞░u ─æ├úi"
                  onClick={() => onDeveloping('Th├┤ng tin ╞░u ─æ├úi')}
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
            LU├öN ─Éß╗ÆNG H├ÇNH C├ÖNG Bß║áN
          </p>

          <h2>
            Sß║┤N S├ÇNG GIß║óI ─É├üP THß║«C Mß║«C
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
            onClick={() => onDeveloping('Nhß║»n tin t╞░ vß║Ñn')}
          >
            <span><Icon name="message" /></span>
            <b>Nhß║»n tin t╞░ vß║Ñn</b>
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
            <p className="kicker dark">Cß║¿M NANG DU Lß╗èCH</p>

            <h2>
              Cß║¼P NHß║¼T XU H╞»ß╗ÜNG V├Ç{' '}
              <em>─ÉIß╗éM ─Éß║╛N</em>
            </h2>
          </div>

          <div className="guide-arrows">
            <button
              type="button"
              className={`guide-arrow${canBlogPrev ? ' active' : ''}`}
              aria-label="Tr╞░ß╗¢c"
              onClick={() => handleBlogScroll('left')}
            >
              <Icon name="arrowLeft" />
            </button>

            <button
              type="button"
              className={`guide-arrow${canBlogNext ? ' active' : ''}`}
              aria-label="Tiß║┐p theo"
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
                  <span>30 Th├íng 1, 2026</span>
                </p>

                <h3>{title}</h3>

                <p className="post-desc">
                  Nhß╗»ng kinh nghiß╗çm hß╗»u ├¡ch gi├║p bß║ín dß╗à d├áng
                  t├¼m ─æ╞░ß╗úc kh├┤ng gian l╞░u tr├║ ph├╣ hß╗úp vß╗¢i nhu
                  cß║ºu, ng├ón s├ích v├á phong c├ích du lß╗ïch cß╗ºa m├¼nh
                </p>

                <button
                  type="button"
                  className="post-link"
                  onClick={() => onDeveloping('Cß║⌐m nang du lß╗ïch')}
                >
                  Xem th├¬m ΓåÆ
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
            <h3>─É─éNG K├¥ NHß║¼N TH├öNG TIN</h3>
            <p>
              Lu├┤n ─æ╞░ß╗úc cß║¡p nhß║¡t vß╗ü c├íc lß╗¥i khuy├¬n du lß╗ïch v├á khuyß║┐n m├úi mß╗¢i nhß║Ñt
            </p>
          </div>

          <form
            className="footer-newsletter-form"
            onSubmit={(event) => {
              event.preventDefault();
              onDeveloping('─É─âng k├╜ nhß║¡n th├┤ng tin');
            }}
          >
            <input
              type="email"
              placeholder="Nhß║¡p Email cß╗ºa bß║ín"
              required
            />

            <button type="submit">
              Gß╗¡i ngay
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
              Tripio mang ─æß║┐n giß║úi ph├íp ─æß║╖t homestay
              tiß╗çn lß╗úi, gi├║p bß║ín dß╗à d├áng t├¼m kiß║┐m
              kh├┤ng gian l╞░u tr├║.
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
            <h4>TH├öNG TIN LI├èN Hß╗å</h4>
            <div className="footer-title-bar" />

            <div className="footer-contact-list">
              <div className="footer-contact-item">
                <span className="footer-contact-icon">
                  <Icon name="location" />
                </span>
                <span>
                  140 L├¬ Trß╗ìng Tß║Ñn, Ph╞░ß╗¥ng T├óy Thß║ính,
                  <br />
                  TP. Hß╗ô Ch├¡ Minh
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
            <h4>C├üC CH├ìNH S├üCH</h4>
            <div className="footer-title-bar" />

            <div className="footer-link-list">
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Ch├¡nh s├ích ─æß║╖t ph├▓ng'); }}>
                Ch├¡nh s├ích ─æß║╖t ph├▓ng
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Ch├¡nh s├ích thanh to├ín'); }}>
                Ch├¡nh s├ích thanh to├ín
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Ch├¡nh s├ích hß╗ºy ph├▓ng'); }}>
                Ch├¡nh s├ích hß╗ºy ph├▓ng
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Ch├¡nh s├ích ho├án tiß╗ün'); }}>
                Ch├¡nh s├ích ho├án tiß╗ün
              </a>
              <a href="#policy" onClick={(e) => { e.preventDefault(); onDeveloping('Ch├¡nh s├ích bß║úo mß║¡t'); }}>
                Ch├¡nh s├ích bß║úo mß║¡t
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
                  <small>3.108 l╞░ß╗út th├¡ch</small>
                </div>
              </div>

              <button
                type="button"
                className="footer-fanpage-btn"
                onClick={() => onDeveloping('Th├¡ch fanpage')}
              >
                <Icon name="thumbsUp" />
                <span>Th├¡ch trang</span>
              </button>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>┬⌐ 2026 Copyright TRIPIO. All rights reserved</p>
        </div>
      </footer>

    </div>
  );
}
