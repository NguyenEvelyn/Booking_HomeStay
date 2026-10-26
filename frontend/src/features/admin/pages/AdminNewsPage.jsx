import React, { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../api/adminApi.js';
import { confirmDialog, toast } from '../../../shared/feedback/feedback.js';
import { csvCell } from '../../../shared/utils/csv.js';
import { NEWS_CATEGORIES, categoryLabel, contentBlocks } from '../../news/newsContent.js';
import '../styles/admin-news.css';

const statusLabel = { Draft: 'Bản nháp', Published: 'Đã đăng', Hidden: 'Đã ẩn' };
const local = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—';
const inputDate = (value) => { if (!value) return ''; const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const emptyPost = () => ({ title: '', slug: '', summary: '', content: '', coverImageUrl: '', category: 'CamNang', status: 'Draft', isFeatured: false, publishedAt: '' });

// Admin › Tin tức: write/publish posts and see newsletter subscribers.
export default function AdminNewsPage({ currentUser }) {
  const [view, setView] = useState('posts');
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPost());
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subscribers, setSubscribers] = useState({ items: [], active: 0 });
  const canDelete = currentUser?.role === 'Admin';

  const load = async () => {
    setLoading(true);
    try { setItems((await adminApi.news(filters)).items || []); } catch (error) { toast.error(error.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (view === 'posts') load(); }, [filters.status, filters.category, view]);
  useEffect(() => { if (view === 'subscribers') adminApi.newsletterSubscribers().then(setSubscribers).catch((error) => toast.error(error.message)); }, [view]);

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const open = (post) => {
    setEditing(post || {});
    setPreview(false);
    setForm(post ? { ...post, slug: post.slug || '', coverImageUrl: post.coverImageUrl || '', publishedAt: inputDate(post.publishedAt) } : emptyPost());
  };
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { change('coverImageUrl', (await adminApi.uploadNewsCover(file)).url); } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, slug: form.slug.trim() || null, coverImageUrl: form.coverImageUrl || null,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null };
      const result = editing.id ? await adminApi.updateNews(editing.id, payload) : await adminApi.createNews(payload);
      toast.success(result.message);
      setEditing(null);
      load();
    } catch (error) { toast.error(error.message); } finally { setBusy(false); }
  };
  const setStatus = async (post, status) => {
    try { toast.success((await adminApi.setNewsStatus(post.id, status)).message); load(); } catch (error) { toast.error(error.message); }
  };
  const remove = async (post) => {
    if (!(await confirmDialog({ title: `Xóa bài “${post.title}”?`, message: 'Bài viết bị xóa vĩnh viễn. Muốn tạm gỡ khỏi trang, hãy chọn Ẩn.', confirmText: 'Xóa bài', variant: 'danger' }))) return;
    try { toast.success((await adminApi.deleteNews(post.id)).message); load(); } catch (error) { toast.error(error.message); }
  };
  const exportSubscribers = () => {
    const rows = [['Email', 'Trạng thái', 'Nguồn', 'Ngày đăng ký'], ...subscribers.items.map((x) => [x.email, x.status === 'Active' ? 'Đang nhận' : 'Đã hủy', x.source, local(x.createdAt)])];
    const blob = new Blob([`﻿${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `tripio-newsletter-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(link.href);
  };
  const blocks = useMemo(() => contentBlocks(form.content), [form.content]);

  return (
    <section className="admin-card admin-news">
      <div className="admin-section-head">
        <div><small>NỘI DUNG</small><h2>Tin tức & cẩm nang</h2><p>Bài “Đã đăng” hiện ở trang chủ (6 bài mới nhất) và trang Tin tức. Bài hẹn giờ chỉ hiện khi tới ngày đăng.</p></div>
        {view === 'posts' && <button type="button" onClick={() => open(null)}>+ Viết bài mới</button>}
      </div>

      <div className="news-admin-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === 'posts'} className={view === 'posts' ? 'active' : ''} onClick={() => setView('posts')}>Bài viết</button>
        <button type="button" role="tab" aria-selected={view === 'subscribers'} className={view === 'subscribers' ? 'active' : ''} onClick={() => setView('subscribers')}>Người đăng ký nhận tin</button>
      </div>

      {view === 'posts' && <>
        <form className="admin-filters open" onSubmit={(event) => { event.preventDefault(); load(); }}>
          <label>Trạng thái<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Tất cả</option>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Danh mục<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
            <option value="">Tất cả</option>{NEWS_CATEGORIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
          <label>Tìm theo tiêu đề<input value={filters.search} placeholder="Nhập rồi nhấn Enter" onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        </form>
        {loading ? <p>Đang tải…</p> : items.length === 0 ? <p className="admin-empty">Chưa có bài viết nào. Bấm “Viết bài mới” để bắt đầu.</p> : (
          <div className="admin-table-scroll"><table><thead><tr><th>Bài viết</th><th>Danh mục</th><th>Trạng thái</th><th>Ngày đăng</th><th>Lượt xem</th><th></th></tr></thead><tbody>
            {items.map((post) => <tr key={post.id}>
              <td><div className="news-admin-title">{post.coverImageUrl ? <img src={post.coverImageUrl} alt="" /> : <i aria-hidden="true" />}<div><b>{post.title}</b><small>/{post.slug}</small>{post.authorName && <small>Tác giả: {post.authorName}</small>}</div></div></td>
              <td>{categoryLabel(post.category)}{post.isFeatured && <small>★ Nổi bật</small>}</td>
              <td><span className={`admin-status ${post.status.toLowerCase()}`}>{statusLabel[post.status] || post.status}</span></td>
              <td><small>{local(post.publishedAt)}</small></td>
              <td>{post.viewCount}</td>
              <td className="news-admin-actions">
                <button className="admin-link" type="button" onClick={() => open(post)}>Sửa</button>
                {post.status !== 'Published' && <button className="admin-link" type="button" onClick={() => setStatus(post, 'Published')}>Đăng</button>}
                {post.status === 'Published' && <button className="admin-link" type="button" onClick={() => setStatus(post, 'Hidden')}>Ẩn</button>}
                {canDelete && <button className="admin-link danger" type="button" onClick={() => remove(post)}>Xóa</button>}
              </td>
            </tr>)}
          </tbody></table></div>
        )}
      </>}

      {view === 'subscribers' && <>
        <div className="news-admin-subhead"><p><b>{subscribers.active}</b> email đang nhận tin · {subscribers.items.length} lượt đăng ký</p>
          <button type="button" className="admin-link" disabled={!subscribers.items.length} onClick={exportSubscribers}>Xuất CSV</button></div>
        {subscribers.items.length === 0 ? <p className="admin-empty">Chưa có ai đăng ký nhận tin.</p> : (
          <div className="admin-table-scroll"><table><thead><tr><th>Email</th><th>Trạng thái</th><th>Nguồn</th><th>Ngày đăng ký</th></tr></thead><tbody>
            {subscribers.items.map((x) => <tr key={x.id}><td>{x.email}</td><td>{x.status === 'Active' ? 'Đang nhận' : 'Đã hủy'}</td><td>{x.source === 'footer' ? 'Footer' : 'Trang chủ'}</td><td>{local(x.createdAt)}</td></tr>)}
          </tbody></table></div>
        )}
      </>}

      {editing && (
        <div className="admin-modal" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
          <section className="news-editor">
            <form onSubmit={save}>
              <header><div><small>BÀI VIẾT</small><h2>{editing.id ? 'Sửa bài viết' : 'Viết bài mới'}</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Đóng">×</button></header>
              <div className="property-form">
                <label className="wide">Tiêu đề <em>{form.title.length}/150</em><input required maxLength={150} value={form.title} onChange={(event) => change('title', event.target.value)} /></label>
                <label>Đường dẫn (để trống = tự tạo từ tiêu đề)<input maxLength={120} placeholder="vd: da-lat-mua-thap-diem" value={form.slug} onChange={(event) => change('slug', event.target.value)} /></label>
                <label>Danh mục<select value={form.category} onChange={(event) => change('category', event.target.value)}>{NEWS_CATEGORIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
                <label className="wide">Tóm tắt (hiện ở thẻ bài và đầu bài) <em>{form.summary.length}/300</em><textarea required rows="2" maxLength={300} value={form.summary} onChange={(event) => change('summary', event.target.value)} /></label>
                <label className="wide">Ảnh bìa (JPG/PNG/WEBP, dưới 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(event.target.files?.[0])} />
                  {form.coverImageUrl && <span className="news-editor-cover"><img src={form.coverImageUrl} alt="Ảnh bìa" /><button type="button" className="admin-link" onClick={() => change('coverImageUrl', '')}>Bỏ ảnh</button></span>}</label>
                <div className="wide news-editor-content">
                  <div className="news-editor-content-head"><span>Nội dung <em>Dòng trống = đoạn mới · bắt đầu dòng bằng “## ” = tiêu đề phụ</em></span>
                    <button type="button" className="admin-link" onClick={() => setPreview(!preview)}>{preview ? 'Soạn thảo' : 'Xem trước'}</button></div>
                  {preview
                    ? <div className="news-editor-preview">{blocks.length ? blocks.map((block, index) => block.type === 'heading' ? <h3 key={index}>{block.text}</h3> : <p key={index}>{block.text}</p>) : <p className="muted">Chưa có nội dung.</p>}</div>
                    : <textarea required rows="12" maxLength={20000} value={form.content} onChange={(event) => change('content', event.target.value)} />}
                </div>
                <label>Trạng thái<select value={form.status} onChange={(event) => change('status', event.target.value)}>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Ngày đăng (để trống = ngay khi đăng)<input type="datetime-local" value={form.publishedAt} onChange={(event) => change('publishedAt', event.target.value)} /></label>
                <label className="wide news-editor-check"><input type="checkbox" checked={form.isFeatured} onChange={(event) => change('isFeatured', event.target.checked)} /> Bài nổi bật (ưu tiên đầu trang Tin tức, tối đa 3 bài)</label>
              </div>
              <footer><button type="button" className="secondary" onClick={() => setEditing(null)}>Hủy</button><button disabled={busy}>{busy ? 'Đang lưu…' : form.status === 'Published' ? 'Lưu & đăng' : 'Lưu bài'}</button></footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
