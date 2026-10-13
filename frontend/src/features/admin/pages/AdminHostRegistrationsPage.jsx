import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/adminApi.js';
import { confirmDialog, promptDialog, toast } from '../../../shared/feedback/feedback.js';
import '../styles/admin-host-registrations.css';

const statusLabels = {
  Pending: 'Chờ duyệt',
  Approved: 'Đã duyệt làm Host',
  Rejected: 'Bị từ chối',
};

const dateStr = (value) =>
  value
    ? new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh',
      }).format(new Date(value))
    : '—';

export default function AdminHostRegistrationsPage({ currentUser }) {
  const p = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({
    page: Number(p.get('page')) || 1,
    pageSize: 20,
    search: p.get('search') || '',
    status: p.get('status') || 'Pending',
  });
  const [draftSearch, setDraftSearch] = useState(p.get('search') || '');
  const [data, setData] = useState({ items: [], total: 0, totalPages: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    const q = new URLSearchParams(location.search);
    q.set('adminTab', 'host-registrations');
    Object.entries(filters).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    history.replaceState({}, '', `${location.pathname}?${q}`);

    adminApi
      .hostRegistrations(filters)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filters]);

  useEffect(() => {
    const close = (e) => e.key === 'Escape' && setSelected(null);
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  const change = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));

  const handleApprove = async (item) => {
    const ok = await confirmDialog({
      title: 'Duyệt đăng ký làm Host?',
      message: `Bạn có chắc muốn phê duyệt cho "${item.userName}" (${item.userEmail}) từ Khách hàng lên làm Host? Tài khoản sẽ được cấp toàn bộ quyền quản trị homestay và kinh doanh.`,
      confirmText: '✓ Phê duyệt làm Host',
    });
    if (!ok) return;

    try {
      const res = await adminApi.approveHostRegistration(item.id);
      toast.success(res.message);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleReject = async (item) => {
    const reason = await promptDialog({
      title: 'Từ chối đơn đăng ký làm Host',
      message: `Nhập lý do từ chối hồ sơ đăng ký của "${item.userName}". Lý do sẽ được thông báo để khách hàng biết nội dung cần chỉnh sửa.`,
      label: 'Lý do từ chối',
      placeholder: 'VD: Số CCCD không hợp lệ hoặc thông tin tài khoản không trùng khớp...',
      confirmText: 'Từ chối hồ sơ',
      variant: 'danger',
      maxLength: 500,
    });
    if (reason === null) return;

    try {
      const res = await adminApi.rejectHostRegistration(item.id, reason);
      toast.success(res.message);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <section className="admin-card">
      <div className="admin-section-head">
        <div>
          <small>KIỂM DUYỆT ĐĂNG KÝ HOST</small>
          <h2>Duyệt đăng ký từ Khách hàng lên Host</h2>
          <p>
            {data.pendingCount > 0
              ? `Hiện có ${data.pendingCount} hồ sơ đăng ký từ Khách hàng đang chờ duyệt.`
              : 'Quản lý và xét duyệt các hồ sơ đăng ký đối tác Chủ nhà (Host).'}
          </p>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="host-reg-tabs">
        <button
          type="button"
          className={`tab-btn ${filters.status === 'Pending' ? 'active' : ''}`}
          onClick={() => change('status', 'Pending')}
        >
          ⏳ Chờ duyệt {data.pendingCount > 0 && <span className="tab-badge">{data.pendingCount}</span>}
        </button>
        <button
          type="button"
          className={`tab-btn ${filters.status === '' ? 'active' : ''}`}
          onClick={() => change('status', '')}
        >
          📋 Tất cả
        </button>
        <button
          type="button"
          className={`tab-btn ${filters.status === 'Approved' ? 'active' : ''}`}
          onClick={() => change('status', 'Approved')}
        >
          🟢 Đã duyệt làm Host
        </button>
        <button
          type="button"
          className={`tab-btn ${filters.status === 'Rejected' ? 'active' : ''}`}
          onClick={() => change('status', 'Rejected')}
        >
          🔴 Bị từ chối
        </button>
      </div>

      {/* Search Bar */}
      <form
        className="host-reg-search-form"
        onSubmit={(e) => {
          e.preventDefault();
          change('search', draftSearch);
        }}
      >
        <div className="search-input-wrapper">
          <input
            type="text"
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            placeholder="Tìm theo tên khách hàng, email, số điện thoại, CCCD…"
          />
          <button type="submit">Tìm kiếm</button>
        </div>
      </form>

      {error && (
        <p className="admin-error" role="alert">
          ⚠ {error}
        </p>
      )}

      {loading ? (
        <div className="admin-skeleton">
          {[1, 2, 3, 4, 5].map((x) => (
            <i key={x} />
          ))}
        </div>
      ) : data.items.length ? (
        <div className="admin-table-scroll">
          <table className="host-reg-table">
            <thead>
              <tr>
                <th>Khách hàng đăng ký</th>
                <th>CCCD / Hộ chiếu</th>
                <th>Số điện thoại</th>
                <th>Tài khoản nhận tiền</th>
                <th>Homestay kèm theo</th>
                <th>Ngày nộp</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((x) => {
                const isPending = x.status === 'Pending';
                let homestayPreview = null;
                if (x.homestayData) {
                  try {
                    homestayPreview = JSON.parse(x.homestayData);
                  } catch {}
                }

                return (
                  <tr key={x.id} className={isPending ? 'pending-row' : ''}>
                    <td>
                      <div className="applicant-cell">
                        <span className="applicant-avatar">
                          {x.userAvatar ? (
                            <img src={x.userAvatar} alt={x.userName} />
                          ) : (
                            x.userName?.[0] || 'U'
                          )}
                        </span>
                        <div>
                          <strong>{x.userName}</strong>
                          <small>{x.userEmail}</small>
                          <span className="current-role-badge">Hiện tại: {x.userCurrentRole}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cccd-text">{x.idCardNumber || '—'}</span>
                    </td>
                    <td>{x.phoneNumber || '—'}</td>
                    <td>
                      {x.bankName ? (
                        <div className="bank-info-cell">
                          <strong>{x.bankName}</strong>
                          <small>{x.bankAccountNumber} ({x.bankAccountName})</small>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {homestayPreview ? (
                        <div className="homestay-preview-cell">
                          <strong>{homestayPreview.homestayName}</strong>
                          <small>{homestayPreview.district}, {homestayPreview.province}</small>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Chưa có homestay</span>
                      )}
                    </td>
                    <td>
                      <small>{dateStr(x.createdAt)}</small>
                    </td>
                    <td>
                      <span className={`status-pill ${x.status.toLowerCase()}`}>
                        {statusLabels[x.status] || x.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-action-btns">
                        {isPending && currentUser.role === 'Admin' ? (
                          <>
                            <button
                              type="button"
                              className="btn-approve-host"
                              onClick={() => handleApprove(x)}
                              title="Duyệt cấp quyền Host ngay"
                            >
                              ✓ Duyệt Host
                            </button>
                            <button
                              type="button"
                              className="btn-reject-host"
                              onClick={() => handleReject(x)}
                              title="Từ chối đơn đăng ký này"
                            >
                              ✕ Từ chối
                            </button>
                            <button
                              type="button"
                              className="btn-view-detail"
                              onClick={() => setSelected(x)}
                            >
                              Chi tiết
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-view-detail"
                            onClick={() => setSelected(x)}
                          >
                            Xem hồ sơ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">
          <b>✍</b>
          <h3>Không có hồ sơ nào</h3>
          <p>
            {filters.status === 'Pending'
              ? 'Hiện tại không có yêu cầu đăng ký làm Host nào đang chờ duyệt.'
              : 'Không tìm thấy hồ sơ phù hợp với bộ lọc.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      <div className="admin-pagination">
        <button
          disabled={filters.page <= 1}
          onClick={() => setFilters((x) => ({ ...x, page: x.page - 1 }))}
        >
          ← Trang trước
        </button>
        <span>
          Trang {filters.page} / {Math.max(1, data.totalPages)}
        </span>
        <button
          disabled={filters.page >= data.totalPages}
          onClick={() => setFilters((x) => ({ ...x, page: x.page + 1 }))}
        >
          Trang sau →
        </button>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <HostRegistrationDrawer
          item={selected}
          editable={currentUser.role === 'Admin'}
          close={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </section>
  );
}

function HostRegistrationDrawer({ item, editable, close, onApprove, onReject }) {
  const isPending = item.status === 'Pending';
  let homestay = null;
  if (item.homestayData) {
    try {
      homestay = JSON.parse(item.homestayData);
    } catch {}
  }

  return (
    <div
      className="admin-drawer-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <aside
        className="admin-drawer host-reg-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-title"
      >
        <header>
          <div>
            <small>ĐƠN ĐĂNG KÝ LÀM HOST</small>
            <h2 id="reg-title">{item.userName}</h2>
            <div style={{ marginTop: '4px' }}>
              <span className={`status-pill ${item.status.toLowerCase()}`}>
                {statusLabels[item.status] || item.status}
              </span>
            </div>
          </div>
          <button onClick={close} aria-label="Đóng hồ sơ">
            ✕
          </button>
        </header>

        {item.rejectionReason && (
          <div className="reg-error-box">
            <strong>Lý do từ chối:</strong>
            <p>{item.rejectionReason}</p>
          </div>
        )}

        {/* Section 1: Thông tin người đăng ký */}
        <div className="reg-section">
          <h3>1. Thông tin Khách hàng đăng ký</h3>
          <dl className="reg-dl">
            <dt>Họ và tên</dt>
            <dd><strong>{item.userName}</strong></dd>
            <dt>Email</dt>
            <dd>{item.userEmail}</dd>
            <dt>Số điện thoại</dt>
            <dd><strong>{item.phoneNumber || 'Chưa cung cấp'}</strong></dd>
            <dt>Số CCCD / Hộ chiếu</dt>
            <dd><span className="reg-cccd">{item.idCardNumber || 'Chưa cung cấp'}</span></dd>
            <dt>Vai trò hiện tại</dt>
            <dd>{item.userCurrentRole}</dd>
            <dt>Ngày nộp hồ sơ</dt>
            <dd>{dateStr(item.createdAt)}</dd>
          </dl>
        </div>

        {/* Section 2: Tài khoản nhận tiền */}
        <div className="reg-section">
          <h3>2. Tài khoản Ngân hàng nhận doanh thu</h3>
          <dl className="reg-dl">
            <dt>Ngân hàng</dt>
            <dd><strong>{item.bankName || '—'}</strong></dd>
            <dt>Số tài khoản</dt>
            <dd><strong>{item.bankAccountNumber || '—'}</strong></dd>
            <dt>Tên chủ tài khoản</dt>
            <dd><strong>{item.bankAccountName || '—'}</strong></dd>
          </dl>
        </div>

        {/* Section 3: Homestay đăng ký kèm theo (nếu có) */}
        {homestay && (
          <div className="reg-section">
            <h3>3. Chỗ nghỉ đăng ký khởi tạo</h3>
            <dl className="reg-dl">
              <dt>Tên chỗ nghỉ</dt>
              <dd><strong>{homestay.homestayName}</strong></dd>
              <dt>Địa chỉ</dt>
              <dd>{[homestay.addressLine, homestay.ward, homestay.district, homestay.province].filter(Boolean).join(', ')}</dd>
              <dt>Loại phòng dự kiến</dt>
              <dd>{homestay.roomTypeName} ({new Intl.NumberFormat('vi-VN').format(homestay.roomBasePrice || 0)} đ/đêm)</dd>
            </dl>

            {homestay.images && homestay.images.length > 0 && (
              <div className="reg-gallery">
                {homestay.images.map((img, i) => (
                  <img key={i} src={img} alt={`Ảnh ${i + 1}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sticky Actions */}
        {editable && (
          <footer className="reg-drawer-actions">
            {isPending ? (
              <>
                <button
                  type="button"
                  className="btn-approve-main"
                  onClick={() => onApprove(item)}
                >
                  ✓ Duyệt cấp quyền Host
                </button>
                <button
                  type="button"
                  className="btn-reject-main"
                  onClick={() => onReject(item)}
                >
                  ✕ Từ chối đơn đăng ký
                </button>
              </>
            ) : item.status === 'Approved' ? (
              <p style={{ color: '#059669', fontWeight: 600, fontSize: '13px' }}>
                ✓ Tài khoản đã được phê duyệt làm Host.
              </p>
            ) : (
              <p style={{ color: '#dc2626', fontWeight: 600, fontSize: '13px' }}>
                ✕ Đơn đăng ký đã bị từ chối.
              </p>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
