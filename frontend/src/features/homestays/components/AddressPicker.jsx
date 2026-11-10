import React, { useEffect, useMemo, useRef, useState } from 'react';
import './AddressPicker.css';

const API_ROOT = 'https://provinces.open-api.vn/api/v2';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL && Array.isArray(cached.data)) return cached.data;
    if (cached) localStorage.removeItem(key);
  } catch { /* Storage can be unavailable or contain malformed JSON. */ }
  return null;
}

function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* Keep the picker usable without storage. */ }
}

function normalizeSearch(value = '') {
  return String(value).toLocaleLowerCase('vi')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function SearchSelect({ label, value, placeholder, options, loading, disabled, open, setOpen, query, setQuery, onSelect, id }) {
  const normalizedQuery = normalizeSearch(query);
  const filtered = useMemo(() => options.filter((item) => normalizeSearch(item.name).includes(normalizedQuery)), [options, normalizedQuery]);
  return <label className="address-picker-field">
    <span>{label}</span>
    <div className="address-picker-control">
      <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`}
        disabled={disabled} value={open ? query : value?.name || ''} placeholder={loading ? 'Đang tải…' : placeholder}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)} />
      {open && !disabled && <div id={`${id}-options`} className="address-picker-options" role="listbox" aria-label={label}>
        {loading ? <small>Đang tải…</small> : filtered.length
          ? filtered.map((item) => <button type="button" role="option" aria-selected={item.code === value?.code} key={item.code}
            onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)}>{item.name}</button>)
          : <small>{query ? 'Không tìm thấy kết quả' : 'Chưa có dữ liệu'}</small>}
      </div>}
    </div>
  </label>;
}

export default function AddressPicker({ value = {}, onChange }) {
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [provinceLoading, setProvinceLoading] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);
  const [provinceError, setProvinceError] = useState(false);
  const [wardError, setWardError] = useState(false);
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [provinceQuery, setProvinceQuery] = useState('');
  const [wardQuery, setWardQuery] = useState('');
  const wardRequestId = useRef(0);
  const selectedProvince = provinces.find((province) => String(province.code) === String(value.provinceCode));
  const selectedWard = wards.find((ward) => String(ward.code) === String(value.wardCode));

  const loadProvinces = async (force = false) => {
    if (!force) {
      const cached = readCache('tripio_address_provinces_v2');
      if (cached) { setProvinces(cached); setProvinceError(false); return; }
    }
    setProvinceLoading(true); setProvinceError(false);
    try {
      const response = await fetch(`${API_ROOT}/p/`);
      if (!response.ok) throw new Error('Province list request failed');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Invalid province response');
      setProvinces(data); writeCache('tripio_address_provinces_v2', data);
    } catch { setProvinceError(true); }
    finally { setProvinceLoading(false); }
  };

  const loadWards = async (provinceCode, force = false) => {
    const requestId = ++wardRequestId.current;
    if (!provinceCode) { setWards([]); setWardLoading(false); setWardError(false); return; }
    const key = `tripio_address_wards_v2_${provinceCode}`;
    if (!force) {
      const cached = readCache(key);
      if (cached) { if (requestId === wardRequestId.current) { setWards(cached); setWardError(false); setWardLoading(false); } return; }
    }
    setWardLoading(true); setWardError(false);
    try {
      const response = await fetch(`${API_ROOT}/p/${encodeURIComponent(provinceCode)}?depth=2`);
      if (!response.ok) throw new Error('Ward list request failed');
      const data = await response.json();
      if (!Array.isArray(data.wards)) throw new Error('Invalid ward response');
      writeCache(key, data.wards);
      if (requestId === wardRequestId.current) setWards(data.wards);
    } catch { if (requestId === wardRequestId.current) setWardError(true); }
    finally { if (requestId === wardRequestId.current) setWardLoading(false); }
  };

  useEffect(() => { loadProvinces(); }, []);
  useEffect(() => { if (value.provinceCode) loadWards(value.provinceCode); else setWards([]); }, [value.provinceCode]);

  const emitAddress = (next) => {
    const street = next.street || '';
    const wardName = next.wardName || '';
    const provinceName = next.provinceName || '';
    const fullAddress = [street, wardName, provinceName].filter(Boolean).join(', ');
    onChange({ ...next, fullAddress });
  };

  return <div className="address-picker">
    <div className="address-picker-grid">
      <SearchSelect id="travel-province" label="Tỉnh/Thành phố *" value={selectedProvince || (value.provinceName ? { code: value.provinceCode, name: value.provinceName } : null)}
        placeholder="Chọn tỉnh/thành phố" options={provinces} loading={provinceLoading} disabled={provinceLoading || provinceError}
        open={provinceOpen} setOpen={setProvinceOpen} query={provinceQuery} setQuery={setProvinceQuery}
        onSelect={(province) => { setProvinceOpen(false); setProvinceQuery(''); setWardQuery(''); setWardError(false); if (String(province.code) !== String(value.provinceCode)) { setWards([]); emitAddress({ provinceCode: province.code, provinceName: province.name, wardCode: '', wardName: '', street: value.street || '' }); } else { emitAddress({ ...value, provinceCode: province.code, provinceName: province.name }); } }} />
      <SearchSelect id="travel-ward" label="Phường/Xã *" value={selectedWard || (value.wardName ? { code: value.wardCode, name: value.wardName } : null)}
        placeholder={value.provinceCode ? 'Chọn phường/xã' : 'Chọn tỉnh/thành trước'} options={wards} loading={wardLoading}
        disabled={!value.provinceCode || wardLoading || wardError} open={wardOpen} setOpen={setWardOpen} query={wardQuery} setQuery={setWardQuery}
        onSelect={(ward) => { setWardOpen(false); setWardQuery(''); emitAddress({ ...value, wardCode: ward.code, wardName: ward.name }); }} />
    </div>
    <label className="address-picker-street"><span>Số nhà, tên đường *</span><input autoComplete="address-line1" maxLength={255} value={value.street || ''} placeholder="Số nhà, tên đường" onChange={(event) => emitAddress({ ...value, street: event.target.value })} /></label>
    {(provinceError || wardError) && <p className="address-picker-error" role="alert">Không tải được danh sách địa chỉ, thử lại <button type="button" onClick={() => provinceError ? loadProvinces(true) : loadWards(value.provinceCode, true)}>Thử lại</button></p>}
    <small className="address-picker-attribution">Dữ liệu địa giới hành chính: <a href="https://provinces.open-api.vn/" target="_blank" rel="noreferrer">Province Open API</a></small>
  </div>;
}
