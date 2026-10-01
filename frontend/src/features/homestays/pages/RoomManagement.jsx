import React, { useEffect, useMemo, useState } from 'react';
import { homestayApi } from '../api/homestayApi.js';
import HostIcon from './HostIcon.jsx';
import './RoomManagement.css';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';

const money = v => `${new Intl.NumberFormat('vi-VN').format(v || 0)}đ`;
const empty = { homestayId: '', roomTypeId: '', roomNumber: '', floorNumber: '', status: 'Available', note: '', images: [] };
const statusLabel = { Available: 'Còn trống', Occupied: 'Đang sử dụng', Cleaning: 'Đang dọn', Maintenance: 'Bảo trì', Inactive: 'Ngưng hoạt động' };
const cleanLabel = { Available: 'Sạch sẽ', Occupied: 'Đang ở', Cleaning: 'Cần dọn', Maintenance: 'Bảo trì', Inactive: '—' };

function RoomImage({ room, large = false }) {
  if (room.thumbnailUrl) {
    return (
      <div className={`room-table-image ${large ? 'large' : ''}`}>
        <img src={room.thumbnailUrl} alt={`Phòng ${room.roomNumber}`} />
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
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState('');

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

  const choose = selected => {
    const picked = [...selected];
    const valid = picked.filter(x => ['image/jpeg', 'image/png', 'image/webp'].includes(x.type) && x.size > 0 && x.size <= 8_000_000);
    setImageError(valid.length !== picked.length ? 'Một số file bị bỏ qua. Chỉ nhận JPG, PNG, WEBP dưới 8 MB.' : '');
    setFiles(old => [...old, ...valid.map(file => ({ file, preview: URL.createObjectURL(file) }))].slice(0, 10));
  };

  const openAdd = () => {
    const target = activeHomestay || data.homestays[0];
    setForm({ ...empty, homestayId: target?.id || '', roomTypeId: target?.roomTypes?.[0]?.id || '' });
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

    const result = await run(async () => {
      const saved = adding
        ? await homestayApi.addRoom(form.homestayId, form.roomTypeId, payload)
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
      return { message: adding ? 'Đã thêm phòng và bộ ảnh riêng.' : 'Đã cập nhật phòng và ảnh.' };
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

  return (
    <section className="room-management">
      <div className="room-property-picker">
        <div className="room-property-picker-head">
          <small>CHỌN CƠ SỞ HOMESTAY</small>
          <h3>Phòng được quản lý riêng theo từng cơ sở</h3>
        </div>
        <div className="room-property-tabs">
          {data.homestays.map(x => {
            const rooms = data.items.filter(r => r.homestayId === x.id);
            const availableCount = rooms.filter(r => r.status === 'Available').length;
            return (
              <button
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
        <div>
          <small>QUẢN LÝ VẬN HÀNH</small>
          <h2>{activeHomestay ? `Phòng tại ${activeHomestay.name}` : 'Danh sách phòng'}</h2>
          <p>Hiển thị các phòng thuộc cơ sở đang chọn. Mỗi phòng có số hiệu và bộ ảnh riêng biệt.</p>
        </div>
        <div className="room-toolbar">
          <input
            placeholder="Tìm mã phòng, loại phòng..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="room-view-toggle">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
              <HostIcon name="list" size={14} />
              <span>Bảng</span>
            </button>
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              <HostIcon name="grid" size={14} />
              <span>Lưới</span>
            </button>
          </div>
          <button className="room-add-button" onClick={openAdd}>
            <HostIcon name="plus" size={15} />
            <span>Thêm phòng</span>
          </button>
        </div>
      </header>

      <div className="room-kpis">
        <article>
          <small>TỔNG PHÒNG</small>
          <b>{roomsOfStay.length}</b>
        </article>
        <article>
          <small>CÒN TRỐNG</small>
          <b>{roomsOfStay.filter(x => x.status === 'Available').length}</b>
        </article>
        <article>
          <small>ĐANG SỬ DỤNG</small>
          <b>{roomsOfStay.filter(x => x.status === 'Occupied').length}</b>
        </article>
        <article>
          <small>CẦN XỬ LÝ (DỌN/BẢO TRÌ)</small>
          <b>{roomsOfStay.filter(x => ['Cleaning', 'Maintenance'].includes(x.status)).length}</b>
        </article>
      </div>

      {view === 'table' ? (
        <div className="rooms-table-wrap">
          <table className="rooms-table">
            <thead>
              <tr>
                <th>MÃ PHÒNG</th>
                <th>ẢNH RIÊNG</th>
                <th>LOẠI PHÒNG</th>
                <th>TẦNG/KHU</th>
                <th>SỨC CHỨA</th>
                <th>GIÁ TIÊU CHUẨN</th>
                <th>TRẠNG THÁI</th>
                <th>VỆ SINH</th>
                <th>THAO TÁC</th>
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
                  <td><span className={`room-status status-${x.status.toLowerCase()}`}>{statusLabel[x.status] || x.status}</span></td>
                  <td><span className={`clean-status clean-${x.status.toLowerCase()}`}>{cleanLabel[x.status] || '—'}</span></td>
                  <td>
                    <div className="room-actions">
                      <button title="Sửa phòng và ảnh" onClick={() => openEdit(x)}>
                        <HostIcon name="edit" size={14} />
                      </button>
                      <button className="delete" title="Xóa phòng" onClick={() => remove(x)}>
                        <HostIcon name="trash" size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.length && <p className="room-empty">Homestay này chưa có phòng hoặc không tìm thấy phòng phù hợp với từ khóa.</p>}
        </div>
      ) : (
        <div className="room-card-grid">
          {list.map(x => (
            <article className="room-card" key={x.id}>
              <RoomImage room={x} large />
              <div className="room-card-body">
                <div>
                  <span className={`room-status status-${x.status.toLowerCase()}`}>{statusLabel[x.status] || x.status}</span>
                  <small>{activeHomestay?.name}</small>
                </div>
                <h3>{x.roomNumber} · {x.roomTypeName}</h3>
                <p>{x.floorNumber ? `Tầng ${x.floorNumber}` : 'Chưa đặt tầng'} · Tối đa {x.maxAdults + x.maxChildren} khách</p>
                <footer>
                  <b>{money(x.basePrice)}<small>/đêm</small></b>
                  <div className="room-actions">
                    <button title="Sửa phòng" onClick={() => openEdit(x)}>
                      <HostIcon name="edit" size={14} />
                    </button>
                    <button className="delete" title="Xóa phòng" onClick={() => remove(x)}>
                      <HostIcon name="trash" size={14} />
                    </button>
                  </div>
                </footer>
              </div>
            </article>
          ))}
          {!list.length && <p className="room-empty">Homestay này chưa có phòng hoặc không tìm thấy phòng phù hợp.</p>}
        </div>
      )}

      {modal && (
        <div className="room-modal" onMouseDown={e => e.target === e.currentTarget && setModal(null)}>
          <form onSubmit={save}>
            <header>
              <div>
                <small>{modal === 'add' ? 'TẠO PHÒNG MỚI' : 'CẬP NHẬT PHÒNG'}</small>
                <h2>{modal === 'add' ? 'Thêm phòng mới' : `Sửa phòng ${form.roomNumber}`}</h2>
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
                    setForm({ ...form, homestayId: e.target.value, roomTypeId: h?.roomTypes?.[0]?.id || '' });
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
                  <option value="">Chọn loại phòng</option>
                  {types.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>

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
                    <img src={x.url} alt="" />
                    <button type="button" onClick={() => removeSavedImage(x)} aria-label="Xóa ảnh">
                      <HostIcon name="close" size={14} />
                    </button>
                    {x.isThumbnail && <b>Đại diện</b>}
                  </figure>
                ))}
                {files.map((x, i) => (
                  <figure key={x.preview}>
                    <img src={x.preview} alt="" />
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
    </section>
  );
}
