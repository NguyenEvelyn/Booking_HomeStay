import React, { useState, useRef, useEffect } from 'react';

export default function GuestPickerDropdown({
  value = { adults: 2, children: 0, rooms: 1 },
  onChange,
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const adults = value.adults ?? 2;
  const children = value.children ?? 0;
  const rooms = value.rooms ?? 1;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const update = (field, newVal) => {
    if (typeof onChange === 'function') {
      onChange({
        adults,
        children,
        rooms,
        [field]: newVal,
      });
    }
  };

  const getDisplayText = () => {
    const parts = [];
    parts.push(`${adults} người lớn`);
    if (children > 0) {
      parts.push(`${children} trẻ em`);
    }
    parts.push(`${rooms} phòng`);
    return parts.join(' · ');
  };

  return (
    <div className={`search-guest-field ${className}`} ref={containerRef}>
      <label className="search-field-label">Khách và phòng</label>

      <button
        type="button"
        className={`search-guest-trigger ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="search-guest-text">{getDisplayText()}</span>
        <i className="search-guest-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </i>
      </button>

      {isOpen && (
        <div className="search-guest-popup" role="dialog" aria-label="Chọn số khách và phòng">
          {/* Người lớn */}
          <div className="guest-popup-row">
            <div>
              <div className="guest-popup-title">Người lớn</div>
              <div className="guest-popup-sub">18 tuổi trở lên</div>
            </div>
            <div className="guest-stepper">
              <button
                type="button"
                className={`stepper-btn ${adults <= 1 ? 'disabled' : ''}`}
                disabled={adults <= 1}
                onClick={() => update('adults', Math.max(1, adults - 1))}
                aria-label="Giảm người lớn"
              >
                –
              </button>
              <span className="stepper-value">{adults}</span>
              <button
                type="button"
                className="stepper-btn"
                disabled={adults >= 30}
                onClick={() => update('adults', Math.min(30, adults + 1))}
                aria-label="Tăng người lớn"
              >
                +
              </button>
            </div>
          </div>

          {/* Trẻ em */}
          <div className="guest-popup-row">
            <div>
              <div className="guest-popup-title">Trẻ em</div>
              <div className="guest-popup-sub">0 - 17 tuổi</div>
            </div>
            <div className="guest-stepper">
              <button
                type="button"
                className={`stepper-btn ${children <= 0 ? 'disabled' : ''}`}
                disabled={children <= 0}
                onClick={() => update('children', Math.max(0, children - 1))}
                aria-label="Giảm trẻ em"
              >
                –
              </button>
              <span className="stepper-value">{children}</span>
              <button
                type="button"
                className="stepper-btn"
                disabled={children >= 10}
                onClick={() => update('children', Math.min(10, children + 1))}
                aria-label="Tăng trẻ em"
              >
                +
              </button>
            </div>
          </div>

          {/* Phòng */}
          <div className="guest-popup-row">
            <div>
              <div className="guest-popup-title">Phòng</div>
            </div>
            <div className="guest-stepper">
              <button
                type="button"
                className={`stepper-btn ${rooms <= 1 ? 'disabled' : ''}`}
                disabled={rooms <= 1}
                onClick={() => update('rooms', Math.max(1, rooms - 1))}
                aria-label="Giảm phòng"
              >
                –
              </button>
              <span className="stepper-value">{rooms}</span>
              <button
                type="button"
                className="stepper-btn"
                disabled={rooms >= 10}
                onClick={() => update('rooms', Math.min(10, rooms + 1))}
                aria-label="Tăng phòng"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            className="guest-popup-apply"
            onClick={() => setIsOpen(false)}
          >
            Áp dụng
          </button>
        </div>
      )}
    </div>
  );
}
