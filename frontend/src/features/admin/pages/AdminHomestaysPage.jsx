import React, { useEffect, useState } from 'react';
import { adminApi } from '../api/adminApi.js';
import { confirmDialog, promptDialog, toast } from '../../../shared/feedback/feedback.js';
import '../styles/admin-homestays.css';

const labels = {
  Pending: 'Chờ duyệt',
  Approved: 'Đang hoạt động',
  Rejected: 'Bị từ chối',
  Suspended: 'Bị ẩn/khóa',
  Draft: 'Bản nháp',
};

const money = (value) =>
  value == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(value)} đ`;

const rating = (value) =>
  value == null ? 'Chưa có' : `${Number(value).toFixed(1)} ★`;

export default function AdminHomestaysPage({ currentUser }) {
  const p = new URLSearchParams(location.search);
  const [filters, setFilters] = useState({
    page: Number(p.get('page')) || 1,
    pageSize: 20,
    search: p.get('search') || '',
    status: p.get('status') || '',
    city: p.get('city') || '',
    hostId: p.get('hostId') || '',
    minRating: p.get('minRating') || '',
    sort: p.get('sort') || 'updatedAt_desc',
  });
  const [draftSearch, setDraftSearch] = useState(p.get('search') || '');
  const [data, setData] = useState({ items: [], total: 0, totalPages: 0 });
  const [options, setOptions] = useState({ cities: [], hosts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const loadPendingCount = () => {
    adminApi.overview()
      .then((res) => {
        if (res?.pendingHomestays != null) {
          setPendingCount(res.pendingHomestays);
        }
      })
      .catch(() => {});
  };

  const load = () => {
    setLoading(true);
    setError('');
    const q = new URLSearchParams(location.search);
    q.set('adminTab', 'homestays');
    Object.entries(filters).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    history.replaceState({}, '', `${location.pathname}?${q}`);
    adminApi
      .homestays(filters)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    loadPendingCount();
  }, [filters]);

  useEffect(() => {
    adminApi.homestayFilters().then(setOptions).catch(() => {});
    loadPendingCount();
  }, []);

  useEffect(() => {
    const close = (e) => e.key === 'Escape' && setDetail(null);
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  const change = (key, value) =>
    setFilters((x) => ({ ...x, [key]: value, page: 1 }));

  const open = async (id) => {
    try {
      const res = await adminApi.homestayDetail(id);
      setDetail(res);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const decide = async (item, action) => {
    let reason = '';
    if (action === 'approve') {
      const ok = await confirmDialog({
        title: 'Phê duyệt đăng ký Homestay?',
        message: `Bạn có chắc chắn muốn phê duyệt "${item.name}" của Host ${item.hostName}? Sau khi duyệt, Homestay sẽ xuất hiện trên hệ thống tìm kiếm và có thể nhận đặt phòng ngay.`,
        confirmText: '✓ Phê duyệt ngay',
      });
      if (!ok) return;
    } else if (action === 'restore') {
      const ok = await confirmDialog({
        title: 'Khôi phục Homestay?',
        message: `Homestay "${item.name}" sẽ hiển thị trở lại và có thể nhận booking mới.`,
        confirmText: 'Khôi phục',
      });
      if (!ok) return;
    } else {
      reason = await promptDialog({
        title: action === 'reject' ? 'Từ chối đăng ký Homestay' : 'Ẩn/khóa Homestay',
        message:
          action === 'reject'
            ? `Vui lòng nhập lý do từ chối hồ sơ "${item.name}". Lý do sẽ hiển thị cho Host để họ chỉnh sửa lại hồ sơ.`
            : `${item.activeBookingCount || 0} đơn đã xác nhận/đang ở vẫn được giữ nguyên. Homestay sẽ không nhận đơn mới.`,
        label: 'Lý do xử lý',
        confirmText: action === 'reject' ? 'Từ chối hồ sơ' : 'Ẩn Homestay',
        variant: 'danger',
        maxLength: 500,
      });
      if (reason === null) return;
    }

    try {
      const result = await adminApi.decideHomestay(item.id, action, reason);
      toast.success(result.message);
      setDetail(null);
      load();
      loadPendingCount();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const feature = async (item) => {
    const next = !item.isFeatured;
    const ok = await confirmDialog({
      title: next ? 'Đặt Homestay là Nổi bật?' : 'Bỏ nhãn Nổi bật?',
      message: next
        ? 'Homestay sẽ được ưu tiên ở danh sách khám phá và trang chủ.'
        : 'Homestay trở về thứ tự hiển thị thông thường.',
      confirmText: next ? 'Đặt Nổi bật' : 'Bỏ Nổi bật',
    });
    if (!ok) return;
    try {
      const result = await adminApi.setHomestayFeatured(item.id, next);
      toast.success(result.message);
      setDetail((x) => (x ? { ...x, isFeatured: next } : x));
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const isPendingView = filters.status === 'Pending';

  return (
    <section className="admin-card">
      {/* Header section */}
      <div className="admin-section-head">
        <div>
          <small>KIỂM DUYỆT NIÊM YẾT</small>
          <h2>{isPendingView ? 'Hồ sơ đăng ký Homestay chờ duyệt' : 'Quản lý & Duyệt Homestay'}</h2>
          <p>
            {isPendingView
              ? `Có ${data.total} hồ sơ homestay đang chờ ban quản trị kiểm duyệt và phê duyệt.`
              : `${data.total} homestay toàn hệ thống phù hợp với bộ lọc.`}
          </p>
        </div>
        <button
          className="admin-filter-toggle"
          onClick={() => setFilterOpen((x) => !x)}
          aria-expanded={filterOpen}
        >
          🔍 Bộ lọc nâng cao
        </button>
      </div>

      {/* Quick Status Tabs Controller */}
      <div className="homestay-status-tabs">
        <button
          type="button"
          className={`tab-status-btn ${filters.status === 'Pending' ? 'active' : ''}`}
          onClick={() => change('status', 'Pending')}
        >
          ⏳ Chờ duyệt {pendingCount > 0 && <span className="tab-badge-pulse">{pendingCount}</span>}
        </button>
        <button
          type="button"
          className={`tab-status-btn ${filters.status === '' ? 'active' : ''}`}
          onClick={() => change('status', '')}
        >
          📋 Tất cả
        </button>
        <button
          type="button"
          className={`tab-status-btn ${filters.status === 'Approved' ? 'active' : ''}`}
          onClick={() => change('status', 'Approved')}
        >
          🟢 Đang hoạt động
        </button>
        <button
          type="button"
          className={`tab-status-btn ${filters.status === 'Rejected' ? 'active' : ''}`}
          onClick={() => change('status', 'Rejected')}
        >
          🔴 Bị từ chối
        </button>
        <button
          type="button"
          className={`tab-status-btn ${filters.status === 'Suspended' ? 'active' : ''}`}
          onClick={() => change('status', 'Suspended')}
        >
          🔒 Bị ẩn/khóa
        </button>
      </div>

      {/* Banner for Pending Queue */}
      {isPendingView && (
        <div className="review-queue-notice">
          <div className="notice-icon">🛡️</div>
          <div className="notice-body">
            <strong>Hàng đợi kiểm duyệt đăng ký homestay mới:</strong>
            <p>
              Kiểm tra thông tin chủ nhà, hình ảnh thực tế (tối thiểu 3 ảnh), loại phòng và nội quy lưu trú trước khi phê duyệt cho phép kinh doanh trên hệ thống.
            </p>
          </div>
        </div>
      )}

      {/* Advanced Filters Form */}
      <form
        className={`admin-filters homestay-filters ${filterOpen ? 'open' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          change('search', draftSearch);
        }}
      >
        <label className="user-search">
          Tìm kiếm
          <div>
            <input
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              placeholder="Tên homestay hoặc thành phố…"
            />
            <button type="submit">Tìm</button>
          </div>
        </label>
        <label>
          Trạng thái
          <select value={filters.status} onChange={(e) => change('status', e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Thành phố / Tỉnh
          <select value={filters.city} onChange={(e) => change('city', e.target.value)}>
            <option value="">Tất cả thành phố</option>
            {options.cities.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chủ nhà (Host)
          <select value={filters.hostId} onChange={(e) => change('hostId', e.target.value)}>
            <option value="">Tất cả chủ nhà</option>
            {options.hosts.map((x) => (
              <option key={x.id} value={x.id}>
                {x.fullName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Điểm đánh giá
          <select value={filters.minRating} onChange={(e) => change('minRating', e.target.value)}>
            <option value="">Tất cả</option>
            <option value="4">Từ 4 sao</option>
            <option value="3">Từ 3 sao</option>
            <option value="2">Từ 2 sao</option>
          </select>
        </label>
        <label>
          Sắp xếp
          <select value={filters.sort} onChange={(e) => change('sort', e.target.value)}>
            <option value="updatedAt_desc">Cần xử lý trước</option>
            <option value="createdAt_desc">Mới đăng ký nhất</option>
            <option value="rating_desc">Điểm đánh giá cao nhất</option>
            <option value="name_asc">Tên A–Z</option>
          </select>
        </label>
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
          <table className="admin-homestays-table">
            <thead>
              <tr>
                <th>Homestay</th>
                <th>Chủ nhà</th>
                <th>Vị trí</th>
                <th>Giá từ</th>
                <th>Đánh giá</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((x) => {
                const isPending = x.status === 'Pending';
                return (
                  <tr key={x.id} className={isPending ? 'row-pending' : ''}>
                    <td>
                      <b>
                        {x.isFeatured && <span className="featured-badge">★ Nổi bật</span>}{' '}
                        {x.name}
                      </b>
                      <small>
                        {x.roomTypeCount} hạng phòng · {x.addressLine}
                      </small>
                    </td>
                    <td>
                      <strong>{x.hostName}</strong>
                    </td>
                    <td>{x.province}</td>
                    <td>
                      <span className="price-tag">{money(x.minPrice)}</span>
                    </td>
                    <td>
                      {rating(x.averageRating)}
                      <small>{x.reviewCount} đánh giá</small>
                    </td>
                    <td>
                      <span className={`admin-status ${x.status.toLowerCase()}`}>
                        {labels[x.status] || x.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="admin-row-actions">
                        {isPending && currentUser.role === 'Admin' ? (
                          <>
                            <button
                              type="button"
                              className="btn-quick-approve"
                              onClick={() => decide(x, 'approve')}
                              title="Duyệt ngay hồ sơ này"
                            >
                              ✓ Duyệt
                            </button>
                            <button
                              type="button"
                              className="btn-quick-reject"
                              onClick={() => decide(x, 'reject')}
                              title="Từ chối hồ sơ này"
                            >
                              ✕ Từ chối
                            </button>
                            <button
                              type="button"
                              className="btn-open-detail"
                              onClick={() => open(x.id)}
                            >
                              Xem hồ sơ
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-open-detail"
                            onClick={() => open(x.id)}
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
          <b>⌂</b>
          <h3>Không tìm thấy Homestay nào</h3>
          <p>
            {isPendingView
              ? 'Hiện tại không có hồ sơ đăng ký homestay nào đang chờ duyệt.'
              : 'Hãy thay đổi bộ lọc hoặc từ khóa tìm kiếm.'}
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

      {/* Drawer inspect/review modal */}
      {detail && (
        <HomestayDrawer
          item={detail}
          editable={currentUser.role === 'Admin'}
          close={() => setDetail(null)}
          decide={decide}
          feature={feature}
        />
      )}
    </section>
  );
}

function HomestayDrawer({ item, editable, close, decide, feature }) {
  const isPending = item.status === 'Pending';
  const hasMinImages = (item.images?.length || 0) >= 3;
  const hasRooms = (item.roomTypes?.length || 0) > 0;

  return (
    <div
      className="admin-drawer-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <aside
        className="admin-drawer homestay-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="homestay-title"
      >
        <header>
          <div>
            <small>HỒ SƠ ĐĂNG KÝ HOMESTAY</small>
            <h2 id="homestay-title">{item.name}</h2>
            <div className="drawer-badges">
              {item.isFeatured && <span className="featured-badge">★ Nổi bật</span>}
              <span className={`admin-status ${item.status.toLowerCase()}`}>
                {labels[item.status] || item.status}
              </span>
            </div>
          </div>
          <button onClick={close} aria-label="Đóng hồ sơ">
            ✕
          </button>
        </header>

        {/* Warning if suspended with active bookings */}
        {item.status === 'Suspended' && item.activeBookingCount > 0 && (
          <p className="admin-warning">
            ⚠ Homestay đang bị ẩn nhưng vẫn có {item.activeBookingCount} đơn đã xác nhận hoặc đang lưu trú cần tiếp tục phục vụ.
          </p>
        )}

        {/* Rejection Reason display if previously rejected */}
        {item.rejectionReason && (
          <div className="admin-error-box">
            <strong>Lý do từ chối trước đó:</strong>
            <p>{item.rejectionReason}</p>
          </div>
        )}

        {/* Criteria Checklist for Pending Homestays */}
        {isPending && (
          <div className="approval-checklist-card">
            <h4>Tiêu chuẩn xét duyệt hồ sơ niêm yết:</h4>
            <div className="checklist-grid">
              <div className={`checklist-item ${hasMinImages ? 'valid' : 'warning'}`}>
                <span className="check-icon">{hasMinImages ? '✓' : '⚠'}</span>
                <div>
                  <strong>Hình ảnh chỗ nghỉ:</strong>
                  <span>{item.images?.length || 0} ảnh {hasMinImages ? '(Đạt tiêu chuẩn ≥ 3 ảnh)' : '(Ít hơn 3 ảnh)'}</span>
                </div>
              </div>
              <div className={`checklist-item ${hasRooms ? 'valid' : 'invalid'}`}>
                <span className="check-icon">{hasRooms ? '✓' : '✕'}</span>
                <div>
                  <strong>Loại phòng kinh doanh:</strong>
                  <span>{item.roomTypes?.length || 0} hạng phòng sẵn sàng đón khách</span>
                </div>
              </div>
              <div className="checklist-item valid">
                <span className="check-icon">✓</span>
                <div>
                  <strong>Thông tin Chủ nhà:</strong>
                  <span>{item.hostName} ({item.hostEmail})</span>
                </div>
              </div>
              <div className="checklist-item valid">
                <span className="check-icon">✓</span>
                <div>
                  <strong>Địa chỉ rõ ràng:</strong>
                  <span>{[item.district, item.province].filter(Boolean).join(', ')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Grid */}
        <dl>
          <dt>Chủ nhà (Host)</dt>
          <dd>
            <strong>{item.hostName}</strong>
            <br />
            <small>{item.hostEmail}</small>
          </dd>
          <dt>Địa chỉ chỗ nghỉ</dt>
          <dd>
            {[item.addressLine, item.ward, item.district, item.province]
              .filter(Boolean)
              .join(', ')}
          </dd>
          <dt>Đánh giá & Khách hàng</dt>
          <dd>
            {rating(item.averageRating)} · {item.reviewCount} lượt đánh giá
          </dd>
          <dt>Tiện ích đăng ký</dt>
          <dd>{item.amenities?.join(', ') || 'Chưa cập nhật tiện ích'}</dd>
        </dl>

        <div className="drawer-description-block">
          <h4>Giới thiệu Homestay:</h4>
          <p className="drawer-description">{item.description}</p>
        </div>

        {/* Gallery */}
        <div className="drawer-section-heading">
          <h4>Hình ảnh thực tế ({item.images?.length || 0} ảnh)</h4>
        </div>
        <div className="admin-gallery">
          {item.images?.map((x, i) => (
            <figure key={i} className={x.isThumbnail ? 'is-cover-thumb' : ''}>
              <img src={x.imageUrl} alt={x.caption || `Ảnh ${item.name}`} />
              <figcaption>
                {x.isThumbnail && <span className="cover-tag">Ảnh chính · </span>}
                {x.caption || `Ảnh #${i + 1}`}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Room Types */}
        <section className="room-review-list">
          <h3>Hạng phòng & Bảng giá niêm yết</h3>
          {item.roomTypes?.map((x) => (
            <article key={x.id}>
              <div>
                <b>{x.name}</b>
                <small>
                  {x.description} · {x.roomCount} phòng sẵn có · Tối đa {x.maxAdults + x.maxChildren} khách
                </small>
              </div>
              <strong>{money(x.basePrice)} / đêm</strong>
            </article>
          ))}
        </section>

        {/* Footer Actions */}
        {editable && (
          <footer className="drawer-actions">
            {isPending && (
              <>
                <button
                  type="button"
                  className="btn-primary-approve"
                  onClick={() => decide(item, 'approve')}
                >
                  ✓ Phê duyệt hồ sơ đăng ký
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => decide(item, 'reject')}
                >
                  ✕ Từ chối (Nêu lý do)
                </button>
              </>
            )}
            {item.status === 'Approved' && (
              <>
                <button type="button" onClick={() => feature(item)}>
                  {item.isFeatured ? 'Bỏ Nổi bật' : '★ Đặt Nổi bật'}
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => decide(item, 'suspend')}
                >
                  Tạm ngưng / Ẩn homestay
                </button>
              </>
            )}
            {item.status === 'Suspended' && (
              <button
                type="button"
                className="btn-primary-approve"
                onClick={() => decide(item, 'restore')}
              >
                Khôi phục hoạt động
              </button>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
