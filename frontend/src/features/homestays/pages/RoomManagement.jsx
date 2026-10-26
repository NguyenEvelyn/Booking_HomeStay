import React, { useEffect, useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import './RoomManagement.css';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';

const money = v => `${new Intl.NumberFormat('vi-VN').format(v || 0)}đ`;
// Sentinel room type id: the room is saved together with a new room type created from the inline fields.
const NEW_TYPE = '__new__';
const emptyNewType = { name: '', basePrice: '', baseCapacity: 2, maxCapacity: 2, bedType: '', roomSize: '', description: '' };
const empty = { homestayId: '', roomTypeId: '', roomNumber: '', floorNumber: '', status: 'Available', note: '', images: [], newType: emptyNewType };
const defaultTypeId = homestay => homestay?.roomTypes?.[0]?.id || NEW_TYPE;
const statusLabel = { Available: 'Còn trống', Occupied: 'Đang sử dụng', Cleaning: 'Đang dọn', Maintenance: 'Bảo trì', Inactive: 'Ngưng hoạt động' };
const cleanLabel = { Clean: 'Sạch sẵn sàng', NeedCleaning: 'Cần dọn', InProgress: 'Đang dọn', Inspection: 'Chờ kiểm tra' };
const emptyChecklist = { linenChanged: false, bathroomCleaned: false, amenitiesRestocked: false, equipmentChecked: false, note: '' };

function RoomImage({ room, large = false }) {
  if (room.thumbnailUrl) {
    return (
      <div className={`room-table-image ${large ? 'large' : ''}`}>
        <img src={room.thumbnailUrl} alt={`Ảnh phòng ${room.roomNumber}`} loading="lazy" />
        <small>{room.images.length} ảnh</small>
      </div>
    );
  }
  return (
    <span className={`room-placeholder ${large ? 'large' : ''}`}>
      <HostIcon name="bed" size={large ? 32 : 20} color="#8da0b8" />
      <small>Chưa có ảnh</small>
    </span>
  );
}

export default function RoomManagement({ data, run }) {
  const [search, setSearch] = useState('');
  const [stay, setStay] = useState('');
  const [view, setView] = useState('table');
  const [filterOpen, setFilterOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [cleaningRoom, setCleaningRoom] = useState(null);
  const [checklist, setChecklist] = useState(emptyChecklist);

  useEffect(() => {
    if (!stay && data.homestays.length) {
      setStay(String(data.homestays[0].id));
    } else if (stay && !data.homestays.some(x => String(x.id) === stay)) {
      setStay(data.homestays[0] ? String(data.homestays[0].id) : '');
    }
  }, [data.homestays, stay]);

  useEffect(() => {
    if (imageError) toast.error(imageError);
  }, [imageError]);

  const activeHomestay = data.homestays.find(x => String(x.id) === stay);
  const roomsOfStay = useMemo(() => data.items.filter(x => String(x.homestayId) === stay), [data.items, stay]);
  const list = useMemo(() => roomsOfStay.filter(x => (`${x.roomNumber} ${x.roomTypeName}`).toLowerCase().includes(search.toLowerCase())), [roomsOfStay, search]);
  const formStay = data.homestays.find(x => String(x.id) === String(form.homestayId));
  const types = formStay?.roomTypes || [];
  const availableCount = roomsOfStay.filter(x => x.status === 'Available').length;
  const occupiedCount = roomsOfStay.filter(x => x.status === 'Occupied').length;
  const attentionCount = roomsOfStay.filter(x => ['Cleaning', 'Maintenance'].includes(x.status)).length;

  const EmptyState = ({ short = false }) => (
    <div className="room-empty" role="status">
      <span className="room-empty-icon"><HostIcon name="bed" size={24} /></span>
      <b>{search ? 'Không tìm thấy phòng phù hợp' : 'Cơ sở này chưa có phòng'}</b>
      <p>{search ? `Thử đổi từ khóa “${search}” hoặc xóa bộ lọc tìm kiếm.` : (short ? 'Thêm phòng đầu tiên để bắt đầu quản lý.' : 'Hãy thêm phòng đầu tiên cùng bộ ảnh và trạng thái vận hành.')}</p>
      {!search && <button type="button" onClick={openAdd}><HostIcon name="plus" size={15} /> Thêm phòng</button>}
    </div>
  );

  const choose = selected => {
    const picked = [...selected];
    const valid = picked.filter(x => ['image/jpeg', 'image/png', 'image/webp'].includes(x.type) && x.size > 0 && x.size <= 8_000_000);
    setImageError(valid.length !== picked.length ? 'Một số file bị bỏ qua. Chỉ nhận JPG, PNG, WEBP dưới 8 MB.' : '');
    setFiles(old => [...old, ...valid.map(file => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 10));
  };

  const openAdd = () => {
    const target = activeHomestay || data.homestays[0];
    setForm({ ...empty, homestayId: target?.id || '', roomTypeId: target ? defaultTypeId(target) : '' });
    setFiles([]);
    setImageError('');
    setModal('add');
  };

  const openEdit = x => {
    setForm({ ...x, homestayId: x.homestayId, roomTypeId: x.roomTypeId, floorNumber: x.floorNumber || '' });
    setFiles([]);
    setImageError('');
    setModal('edit');
  };

  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setImageError('');
    const adding = modal === 'add';
    const payload = {
      roomNumber: form.roomNumber,
      floorNumber: form.floorNumber ? +form.floorNumber : null,
      status: form.status,
      note: form.note
    };

    const creatingType = adding && form.roomTypeId === NEW_TYPE;
    if (creatingType && Number(form.newType.maxCapacity) < Number(form.newType.baseCapacity)) {
      setBusy(false);
      toast.error('Sức chứa tối đa phải lớn hơn hoặc bằng sức chứa tiêu chuẩn.');
      return;
    }

    const result = await run(async () => {
      let roomTypeId = form.roomTypeId;
      if (creatingType) {
        const t = form.newType;
        const baseCapacity = Number(t.baseCapacity);
        const maxCapacity = Number(t.maxCapacity);
        const created = await homestayApi.addRoomType(form.homestayId, {
          name: t.name.trim(),
          description: t.description.trim() || `${t.name.trim()} cho ${baseCapacity} khách`,
          basePrice: Number(t.basePrice),
          maxAdults: maxCapacity,
          maxChildren: 0,
          bedType: t.bedType.trim(),
          roomSize: t.roomSize ? Number(t.roomSize) : null,
          baseCapacity,
          maxCapacity,
          extraGuestAllowed: maxCapacity > baseCapacity
        });
        roomTypeId = created.id;
        // A retry after a failed room save must reuse this room type instead of creating a duplicate.
        setForm(current => ({ ...current, roomTypeId: String(created.id) }));
      }
      const saved = adding
        ? await homestayApi.addRoom(form.homestayId, roomTypeId, payload)
        : await homestayApi.updateRoom(form.homestayId, form.id, payload);
      const roomId = adding ? saved.id : form.id;
      if (adding) {
        setForm(current => ({ ...current, id: roomId }));
        setModal('edit');
      }
      if (files.length) {
        await homestayApi.uploadRoomImages(form.homestayId, roomId, files.map(x => x.file));
      }
      setFiles([]);
      return { message: creatingType ? `Đã tạo loại phòng “${form.newType.name.trim()}” và thêm phòng.` : adding ? 'Đã thêm phòng và bộ ảnh riêng.' : 'Đã cập nhật phòng và ảnh.' };
    }, false);

    setBusy(false);
    if (result) setModal(null);
    else setImageError('Không thể lưu bộ ảnh. Phòng vẫn được lưu để bạn thử lại.');
  };

  const removeSavedImage = image =>
    run(() => homestayApi.deleteRoomImage(form.homestayId, form.id, image.id), false).then(result => {
      if (result) setForm(current => ({ ...current, images: current.images.filter(x => x.id !== image.id) }));
    });

  const remove = async x => {
    const ok = await confirmDialog({
      title: `Xóa phòng ${x.roomNumber}?`,
      message: 'Phòng sẽ bị xóa khỏi danh sách quản lý. Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa phòng',
      variant: 'danger'
    });
    if (ok) await run(() => homestayApi.deleteRoom(x.homestayId, x.id), false);
  };

  const startCleaning = async room => {
    setBusy(true);
    const result = await run(() => homestayApi.updateRoomCleaning(room.homestayId, room.id, { action: 'start' }), false);
    setBusy(false);
    if (result) toast.success(result.message);
  };

  const openCleaningChecklist = room => { setCleaningRoom(room); setChecklist(emptyChecklist); };
  const completeCleaning = async event => {
    event.preventDefault();
    if (!checklist.linenChanged || !checklist.bathroomCleaned || !checklist.amenitiesRestocked || !checklist.equipmentChecked) {
      toast.error('Vui lòng hoàn tất đủ 4 mục kiểm tra trước khi bàn giao phòng.'); return;
    }
    setBusy(true);
    const result = await run(() => homestayApi.updateRoomCleaning(cleaningRoom.homestayId, cleaningRoom.id, { action: 'complete', ...checklist }), false);
    setBusy(false);
    if (result) { setCleaningRoom(null); toast.success(result.message); }
  };

  const CleaningStatus = ({ room }) => {
    const state = room.cleaningStatus || (room.status === 'Cleaning' ? 'NeedCleaning' : room.status === 'Occupied' ? 'Occupied' : 'Clean');
    const next = room.nextBooking;
    return <div className="room-cleaning-state"><span className={`clean-status clean-${String(state).toLowerCase()}`}>{state === 'Occupied' ? 'Đang ở' : cleanLabel[state] || '—'}</span>{next&&<small>Khách tiếp theo: {new Date(`${next.checkInDate}T00:00:00`).toLocaleDateString('vi-VN')}</small>}</div>;
  };

  const CleaningActions = ({ room }) => {
    const state = room.cleaningStatus || (room.status === 'Cleaning' ? 'NeedCleaning' : 'Clean');
    if (room.status === 'Cleaning' && state === 'NeedCleaning') return <button type="button" className="cleaning-primary" disabled={busy} onClick={() => startCleaning(room)}><HostIcon name="clock" size={14}/><span>Bắt đầu dọn</span></button>;
    if (room.status === 'Cleaning' && state === 'InProgress') return <button type="button" className="cleaning-primary finish" onClick={() => openCleaningChecklist(room)}><HostIcon name="checkCircle" size={14}/><span>Hoàn tất dọn</span></button>;
    return <button type="button" aria-label={`Sửa phòng ${room.roomNumber}`} onClick={() => openEdit(room)}><HostIcon name="edit" size={14}/><span>Sửa</span></button>;
  };

  return (
    <section className="room-management" aria-labelledby="room-management-title">
      <div className="room-property-picker">
        <div className="room-property-picker-head">
          <small>CHỌN CƠ SỞ HOMESTAY</small>
          <h3>Phòng được quản lý riêng theo từng cơ sở</h3>
        </div>
        <div className="room-property-tabs" role="tablist" aria-label="Chọn cơ sở Homestay">
          {data.homestays.map(x => {
            const rooms = data.items.filter(r => r.homestayId === x.id);
            const availableCount = rooms.filter(r => r.status === 'Available').length;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={stay === String(x.id)}
                key={x.id}
                className={stay === String(x.id) ? 'active' : ''}
                onClick={() => { setStay(String(x.id)); setSearch(''); }}
              >
                <span>{x.name}</span>
                <small>{rooms.length} phòng · {availableCount} phòng trống</small>
              </button>
            );
          })}
        </div>
      </div>

      <header className="room-management-header">
        <div className="room-heading">
          <small className="room-eyebrow">QUẢN LÝ VẬN HÀNH</small>
          <h2 id="room-management-title">{activeHomestay ? `Phòng tại ${activeHomestay.name}` : 'Danh sách phòng'}</h2>
          <p>Hiển thị các phòng thuộc cơ sở đang chọn. Mỗi phòng có số hiệu và bộ ảnh riêng biệt.</p>
        </div>
        <button hidden type="button" className="mobile-filter-trigger" onClick={() => setFilterOpen(true)} aria-expanded={filterOpen} aria-controls="room-mobile-filters"><HostIcon name="filter" size={17}/><span>Bộ lọc</span></button>
        {filterOpen && <button hidden type="button" className="mobile-filter-scrim" aria-label="Đóng bộ lọc" onClick={() => setFilterOpen(false)}/>}
        <div id="room-mobile-filters" className={`room-toolbar mobile-filter-sheet ${filterOpen ? 'mobile-open' : ''}`} role="search" aria-label="Công cụ quản lý phòng">
          <div hidden className="mobile-filter-heading"><div><small>BỘ LỌC</small><b>Công cụ quản lý phòng</b></div><button type="button" onClick={() => setFilterOpen(false)} aria-label="Đóng bộ lọc"><HostIcon name="close" size={18}/></button></div>
          <label className="room-search-field">
            <span className="sr-only">Tìm phòng</span>
            <HostIcon name="search" size={18} />
            <input
              placeholder="Tìm mã phòng, loại phòng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa từ khóa tìm kiếm"><HostIcon name="close" size={15} /></button>}
          </label>
          <div className="room-view-toggle" role="group" aria-label="Kiểu hiển thị">
            <button type="button" aria-pressed={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              <HostIcon name="list" size={14} />
              <span>Bảng</span>
            </button>
            <button type="button" aria-pressed={view === 'grid'} className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              <HostIcon name="grid" size={14} />
              <span>Lưới</span>
            </button>
          </div>
          <button type="button" className="room-add-button" onClick={openAdd}>
            <HostIcon name="plus" size={15} />
            <span>Thêm phòng</span>
          </button>
        </div>
      </header>

      <div className="room-kpis">
        <article>
          <span className="room-kpi-icon"><HostIcon name="bed" size={20} /></span>
          <div><small>TỔNG PHÒNG</small><b>{roomsOfStay.length}</b><p>Trong cơ sở đang chọn</p></div>
        </article>
        <article>
          <span className="room-kpi-icon available"><HostIcon name="checkCircle" size={20} /></span>
          <div><small>CÒN TRỐNG</small><b>{availableCount}</b><p>Sẵn sàng nhận khách</p></div>
        </article>
        <article>
          <span className="room-kpi-icon occupied"><HostIcon name="users" size={20} /></span>
          <div><small>ĐANG SỬ DỤNG</small><b>{occupiedCount}</b><p>Phòng đang có khách</p></div>
        </article>
        <article>
          <span className="room-kpi-icon attention"><HostIcon name="alertCircle" size={20} /></span>
          <div><small>CẦN XỬ LÝ</small><b>{attentionCount}</b><p>Dọn phòng hoặc bảo trì</p></div>
        </article>
      </div>

      <div className="room-results-bar" aria-live="polite">
        <p><b>{list.length}</b> phòng {search ? `phù hợp với “${search}”` : `tại ${activeHomestay?.name || 'cơ sở đang chọn'}`}</p>
        <span>{view === 'table' ? 'Chế độ bảng' : 'Chế độ lưới'}</span>
      </div>

      <div hidden className="mobile-room-list" aria-label={`Danh sách phòng tại ${activeHomestay?.name || 'Homestay'}`}>
        {list.map(x => (
          <article key={x.id} className={`mobile-room-card is-${x.status.toLowerCase()}`}>
            <RoomImage room={x}/>
            <div className="mobile-room-body">
              <header><span className={`room-status status-${x.status.toLowerCase()}`}><i aria-hidden="true"/>{statusLabel[x.status] || x.status}</span></header>
              <h3>{x.roomNumber}</h3><strong>{x.roomTypeName}</strong>
              <p><span>{x.floorNumber ? `Tầng ${x.floorNumber}` : 'Chưa đặt tầng'}</span><i>·</i><span>Tối đa {x.maxAdults + x.maxChildren} khách</span></p>
              <CleaningStatus room={x}/>
            </div>
            <footer><span><small>GIÁ TIÊU CHUẨN</small><b>{money(x.basePrice)}<em>/đêm</em></b></span><div className="room-actions"><CleaningActions room={x}/><button type="button" className="delete" aria-label={`Xóa phòng ${x.roomNumber}`} onClick={() => remove(x)}><HostIcon name="trash" size={15}/><span>Xóa</span></button></div></footer>
          </article>
        ))}
        {!list.length && <EmptyState short/>}
      </div>

      {view === 'table' ? (
        <div className="rooms-table-wrap">
          <table className="rooms-table">
            <caption className="sr-only">Danh sách phòng tại {activeHomestay?.name || 'Homestay'}</caption>
            <thead>
              <tr>
                <th scope="col">MÃ PHÒNG</th>
                <th scope="col">ẢNH RIÊNG</th>
                <th scope="col">LOẠI PHÒNG</th>
                <th scope="col">TẦNG/KHU</th>
                <th scope="col">SỨC CHỨA</th>
                <th scope="col">GIÁ TIÊU CHUẨN</th>
                <th scope="col">TRẠNG THÁI</th>
                <th scope="col">VỆ SINH</th>
                <th scope="col">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {list.map(x => (
                <tr key={x.id}>
                  <td><b>{x.roomNumber}</b></td>
                  <td><RoomImage room={x} /></td>
                  <td>{x.roomTypeName}</td>
                  <td>{x.floorNumber ? `Tầng ${x.floorNumber}` : '—'}</td>
                  <td>{x.maxAdults + x.maxChildren} khách</td>
                  <td><b>{money(x.basePrice)}</b></td>
                  <td><span className={`room-status status-${x.status.toLowerCase()}`}><i aria-hidden="true" />{statusLabel[x.status] || x.status}</span></td>
                  <td><CleaningStatus room={x}/></td>
                  <td>
                    <div className="room-actions">
                      <CleaningActions room={x}/>
                      <button type="button" className="delete" aria-label={`Xóa phòng ${x.roomNumber}`} onClick={() => remove(x)}>
                        <HostIcon name="trash" size={14} />
                        <span>Xóa</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <EmptyState />}
        </div>
      ) : (
        <div className="room-card-grid">
          {list.map(x => (
            <article className="room-card" key={x.id}>
              <RoomImage room={x} large />
              <div className="room-card-body">
                <div>
                  <span className={`room-status status-${x.status.toLowerCase()}`}><i aria-hidden="true" />{statusLabel[x.status] || x.status}</span>
                  <small title={activeHomestay?.name}>{activeHomestay?.name}</small>
                </div>
                <h3>{x.roomNumber} · {x.roomTypeName}</h3>
                <p>{x.floorNumber ? `Tầng ${x.floorNumber}` : 'Chưa đặt tầng'} · Tối đa {x.maxAdults + x.maxChildren} khách</p>
                <CleaningStatus room={x}/>
                <footer>
                  <b>{money(x.basePrice)}<small>/đêm</small></b>
                  <div className="room-actions">
                    <CleaningActions room={x}/>
                    <button type="button" className="delete" aria-label={`Xóa phòng ${x.roomNumber}`} onClick={() => remove(x)}>
                      <HostIcon name="trash" size={14} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </footer>
              </div>
            </article>
          ))}
          {!list.length && <EmptyState short />}
        </div>
      )}

      {modal && (
        <div className="room-modal" role="dialog" aria-modal="true" aria-labelledby="room-modal-title" onMouseDown={e => e.target === e.currentTarget && setModal(null)}>
          <form onSubmit={save}>
            <header>
              <div>
                <small>{modal === 'add' ? 'TẠO PHÒNG MỚI' : 'CẬP NHẬT PHÒNG'}</small>
                <h2 id="room-modal-title">{modal === 'add' ? 'Thêm phòng mới' : `Sửa phòng ${form.roomNumber}`}</h2>
              </div>
              <button type="button" className="room-modal-close" onClick={() => setModal(null)} aria-label="Đóng">
                <HostIcon name="close" size={20} />
              </button>
            </header>

            <div className="room-form-grid">
              <label>
                Homestay
                <select
                  disabled={modal === 'edit'}
                  required
                  value={form.homestayId}
                  onChange={e => {
                    const h = data.homestays.find(x => String(x.id) === e.target.value);
                    setForm({ ...form, homestayId: e.target.value, roomTypeId: h ? defaultTypeId(h) : '' });
                  }}
                >
                  <option value="">Chọn Homestay</option>
                  {data.homestays.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>

              <label>
                Loại phòng
                <select
                  disabled={modal === 'edit'}
                  required
                  value={form.roomTypeId}
                  onChange={e => setForm({ ...form, roomTypeId: e.target.value })}
                >
                  <option value="">{types.length ? 'Chọn loại phòng' : 'Chưa có loại phòng'}</option>
                  {types.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                  {modal === 'add' && form.homestayId && <option value={NEW_TYPE}>+ Tạo loại phòng mới…</option>}
                </select>
              </label>

              {modal === 'add' && form.roomTypeId === NEW_TYPE && (() => {
                const t = form.newType;
                const setType = patch => setForm(current => ({ ...current, newType: { ...current.newType, ...patch } }));
                return (
                  <fieldset className="room-new-type wide">
                    <legend>Loại phòng mới</legend>
                    <p>{types.length
                      ? 'Loại phòng mới sẽ được tạo cùng lúc với phòng này.'
                      : `${formStay?.name || 'Homestay này'} chưa có loại phòng nào. Khai báo loại phòng (giá, sức chứa) trước — phòng ${form.roomNumber || 'mới'} sẽ thuộc loại này. Bạn có thể chỉnh chi tiết sau ở mục Loại phòng.`}</p>
                    <div className="room-new-type-grid">
                      <label className="wide">Tên loại phòng<input required maxLength="100" placeholder="VD: Phòng đôi hướng biển" value={t.name} onChange={e => setType({ name: e.target.value })} /></label>
                      <label>Giá / đêm (đ)<input required type="number" min="1000" step="1000" placeholder="VD: 800000" value={t.basePrice} onChange={e => setType({ basePrice: e.target.value })} /></label>
                      <label>Loại giường<input required maxLength="50" placeholder="VD: 1 giường đôi" value={t.bedType} onChange={e => setType({ bedType: e.target.value })} /></label>
                      <label>Sức chứa tiêu chuẩn<input required type="number" min="1" max="30" value={t.baseCapacity} onChange={e => setType({ baseCapacity: e.target.value })} /><small>Số khách đã gồm trong giá</small></label>
                      <label>Sức chứa tối đa<input required type="number" min={t.baseCapacity || 1} max="30" value={t.maxCapacity} onChange={e => setType({ maxCapacity: e.target.value })} /><small>Tính cả khách ở thêm</small></label>
                      <label>Diện tích (m²)<input type="number" min="1" placeholder="VD: 25" value={t.roomSize} onChange={e => setType({ roomSize: e.target.value })} /></label>
                      <label className="wide">Mô tả ngắn<input maxLength="300" placeholder="Để trống sẽ tự tạo từ tên và sức chứa" value={t.description} onChange={e => setType({ description: e.target.value })} /></label>
                    </div>
                  </fieldset>
                );
              })()}

              <label>
                Mã/số phòng
                <input
                  required
                  placeholder="VD: P101, Villa A1..."
                  value={form.roomNumber}
                  onChange={e => setForm({ ...form, roomNumber: e.target.value })}
                />
              </label>

              <label>
                Tầng / khu vực
                <input
                  type="number"
                  placeholder="VD: 1, 2..."
                  value={form.floorNumber}
                  onChange={e => setForm({ ...form, floorNumber: e.target.value })}
                />
              </label>

              <label>
                Trạng thái phòng
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="Available">Còn trống</option>
                  <option value="Occupied">Đang sử dụng</option>
                  <option value="Cleaning">Đang dọn</option>
                  <option value="Maintenance">Bảo trì</option>
                  <option value="Inactive">Ngưng hoạt động</option>
                </select>
              </label>

              <label className="wide">
                Ghi chú nội bộ
                <textarea
                  rows="3"
                  placeholder="View hướng biển, gần sảnh, ban công thoáng..."
                  value={form.note || ''}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                />
              </label>
            </div>

            <section className="room-image-editor">
              <header>
                <div>
                  <b>Ảnh riêng của phòng {form.roomNumber || 'mới'}</b>
                  <small>Ảnh đầu tiên sẽ là ảnh đại diện của phòng trong danh sách</small>
                </div>
              </header>
              <div className="room-image-list">
                {(form.images || []).map(x => (
                  <figure key={x.id}>
                    <img src={x.url} alt={`Ảnh phòng ${form.roomNumber || 'mới'}`} />
                    <button type="button" onClick={() => removeSavedImage(x)} aria-label="Xóa ảnh">
                      <HostIcon name="close" size={14} />
                    </button>
                    {x.isThumbnail && <b>Đại diện</b>}
                  </figure>
                ))}
                {files.map((x, i) => (
                  <figure key={x.preview}>
                    <img src={x.preview} alt={`Ảnh mới ${i + 1} của phòng ${form.roomNumber || 'mới'}`} />
                    <button type="button" onClick={() => setFiles(files.filter((_, n) => n !== i))} aria-label="Xóa ảnh">
                      <HostIcon name="close" size={14} />
                    </button>
                    <small>Mới tải</small>
                  </figure>
                ))}
                <label className="room-image-add">
                  <HostIcon name="camera" size={24} color="#0b4ae6" />
                  <span>Thêm ảnh</span>
                  <input
                    className="room-file-input"
                    multiple
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => choose(e.target.files)}
                  />
                </label>
              </div>
            </section>

            <footer>
              <button type="button" className="btn-cancel" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn-save" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu phòng'}</button>
            </footer>
          </form>
        </div>
      )}
      {cleaningRoom && <div className="room-modal cleaning-modal" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setCleaningRoom(null)}><form onSubmit={completeCleaning} role="dialog" aria-modal="true" aria-labelledby="cleaning-title"><header><div><small>BÀN GIAO PHÒNG</small><h2 id="cleaning-title">Hoàn tất dọn phòng {cleaningRoom.roomNumber}</h2><p>Kiểm tra đủ các hạng mục trước khi chuyển phòng sang sẵn sàng.</p></div><button type="button" className="room-modal-close" onClick={()=>setCleaningRoom(null)} aria-label="Đóng"><HostIcon name="close" size={20}/></button></header><div className="cleaning-checklist">{[['linenChanged','Đã thay ga, gối và khăn'],['bathroomCleaned','Đã vệ sinh phòng tắm'],['amenitiesRestocked','Đã bổ sung nước và vật dụng'],['equipmentChecked','Đã kiểm tra thiết bị trong phòng']].map(([key,label])=><label key={key}><input type="checkbox" checked={checklist[key]} onChange={e=>setChecklist(old=>({...old,[key]:e.target.checked}))}/><span><HostIcon name="checkCircle" size={18}/>{label}</span></label>)}<label className="cleaning-note"><span>Ghi chú bàn giao (tùy chọn)</span><textarea rows="3" value={checklist.note} onChange={e=>setChecklist(old=>({...old,note:e.target.value}))} placeholder="Đồ thất lạc, thiết bị cần theo dõi..."/></label></div><footer><button type="button" className="secondary" onClick={()=>setCleaningRoom(null)}>Để sau</button><button type="submit" disabled={busy}>{busy?'Đang cập nhật...':'Xác nhận sạch & sẵn sàng'}</button></footer></form></div>}
    </section>
  );
}
