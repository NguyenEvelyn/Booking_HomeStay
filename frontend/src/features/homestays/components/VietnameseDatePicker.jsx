import React, { useEffect, useRef, useState } from 'react';
import './VietnameseDatePicker.css';

const toIsoDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseIsoDate = (value) => value ? new Date(`${value}T00:00:00`) : null;
const formatVietnameseDate = (value) => {
  const date = parseIsoDate(value);
  return date ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '';
};

export default function VietnameseDatePicker({ value, onChange, label = 'Ngày sinh *' }) {
  const initial = parseIsoDate(value) || new Date();
  const [open, setOpen] = useState(false);
  const [choosingYear, setChoosingYear] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const rootRef = useRef(null);
  const today = new Date();
  const firstWeekday = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysCount = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysCount }, (_, index) => index + 1)];
  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(visibleMonth);
  const maxMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearOptions = Array.from({ length: Math.max(1, today.getFullYear() - 1900 + 1) }, (_, index) => today.getFullYear() - index);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  useEffect(() => {
    if (value) { const date = parseIsoDate(value); setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }
  }, [value]);

  const chooseDay = (day) => {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    if (date > today) return;
    onChange(toIsoDate(date));
    setOpen(false);
  };

  return <div className="vi-date-picker" ref={rootRef}>
    <label htmlFor="primary-guest-birth-date">{label}</label>
    <div className="vi-date-picker-input-row">
      <input id="primary-guest-birth-date" type="text" inputMode="none" readOnly aria-haspopup="dialog" aria-expanded={open}
        value={formatVietnameseDate(value)} placeholder="dd/mm/yyyy" onClick={() => setOpen((current) => !current)} />
      <button type="button" aria-label="Mở lịch chọn ngày sinh" aria-expanded={open} onClick={() => setOpen((current) => !current)}>▦</button>
    </div>
    {open && <div className="vi-date-picker-popover" role="dialog" aria-label="Chọn ngày sinh">
      <header><button type="button" aria-label="Tháng trước" disabled={visibleMonth.getFullYear() <= 1900 && visibleMonth.getMonth() === 0} onClick={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>‹</button><button className="vi-date-picker-month-title" type="button" onClick={() => setChoosingYear((current) => !current)} aria-label="Chọn năm">{monthLabel}</button><button type="button" aria-label="Tháng sau" disabled={visibleMonth >= maxMonth} onClick={() => setVisibleMonth((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>›</button></header>
      {choosingYear ? <div className="vi-date-picker-year-list" role="listbox" aria-label="Chọn năm sinh">{yearOptions.map((year) => <button type="button" role="option" aria-selected={year === visibleMonth.getFullYear()} key={year} onClick={() => { setVisibleMonth((date) => new Date(year, date.getMonth(), 1)); setChoosingYear(false); }}>{year}</button>)}</div> : <><div className="vi-date-picker-grid vi-date-picker-weekdays">{['T2','T3','T4','T5','T6','T7','CN'].map((day) => <b key={day}>{day}</b>)}</div>
      <div className="vi-date-picker-grid">{cells.map((day, index) => day ? <button type="button" key={day} disabled={new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day) > today} aria-pressed={value === toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))} onClick={() => chooseDay(day)}>{day}</button> : <span key={`blank-${index}`} />)}</div></>}
    </div>}
  </div>;
}
