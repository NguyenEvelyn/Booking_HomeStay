import React, { useEffect, useRef, useState } from 'react';
import HostIcon from './HostIcon.jsx';

export function NumberStepper({ value, min = 0, max = 99, step = 1, onChange, disabled = false, ariaLabel = '' }) {
  const current = Number(value) || 0;

  const handleDecrement = () => {
    if (disabled || current <= min) return;
    onChange(Math.max(min, current - step));
  };

  const handleIncrement = () => {
    if (disabled || current >= max) return;
    onChange(Math.min(max, current + step));
  };

  return (
    <div className="number-stepper" aria-label={ariaLabel}>
      <button
        type="button"
        className="number-stepper__btn number-stepper__btn--minus"
        onClick={handleDecrement}
        disabled={disabled || current <= min}
        aria-label="Giảm"
      >
        <HostIcon name="minus" size={14} />
      </button>
      <div className="number-stepper__val">{current}</div>
      <button
        type="button"
        className="number-stepper__btn number-stepper__btn--plus"
        onClick={handleIncrement}
        disabled={disabled || current >= max}
        aria-label="Tăng"
      >
        <HostIcon name="plus" size={14} />
      </button>
    </div>
  );
}

export function BookingActionMenu({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="action-menu-wrapper" ref={menuRef}>
      <button
        type="button"
        className="btn-action-menu"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <HostIcon name="moreVertical" size={15} />
        <span>Thao tác</span>
        <HostIcon name="chevronDown" size={12} />
      </button>

      {open && (
        <div className="action-dropdown-popover">
          <div className="action-dropdown-title">THAO TÁC</div>
          <div className="action-dropdown-list">
            {actions.map((act, idx) => (
              <React.Fragment key={idx}>
                {act.danger && <div className="action-dropdown-divider" />}
                <button
                  type="button"
                  className={`action-dropdown-item ${act.danger ? 'danger' : ''} ${act.disabled ? 'disabled' : ''}`}
                  disabled={act.disabled}
                  onClick={() => {
                    if (act.disabled) return;
                    setOpen(false);
                    act.handler();
                  }}
                >
                  {act.icon && (
                    <span className="action-dropdown-icon">
                      <HostIcon name={act.icon} size={15} color={act.danger ? '#dc2626' : '#475569'} />
                    </span>
                  )}
                  <span>{act.label}</span>
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
