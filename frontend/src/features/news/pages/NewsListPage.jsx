import React, { useEffect, useState } from 'react';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import CustomerFooter from '../../../shared/components/CustomerFooter.jsx';
import { newsApi } from '../api/newsApi.js';
import { NEWS_CATEGORIES, categoryLabel, newsDate } from '../newsContent.js';
import '../styles/news.css';

const fallbackCover = '/assets/figma/blog-1.jpg';

// Public list of published posts ("Tin tức & cẩm nang"), filterable by category.
export default function NewsListPage({ user, onHome, onHomestays, onBookings, onFavorites, onAccount, onChangePassword, onLogout, onDeveloping, accountLinks, onOpenPost }) {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, pageSize: 9 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    newsApi.list({ category, page, pageSize: 9 })
      .then((data) => { if (active) setResult(data); })
      .catch((err) => { if (active) setError(err.message || 'Không tải được bài viết.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, page]);

  const pageCount = Math.max(1, Math.ceil(result.total / (result.pageSize || 9)));
  const [lead, ...rest] = page === 1 ? result.items : [null, ...result.items];

  return (
    <div className="news-page">
      <CustomerNav active="news" user={user} onHome={onHome} onHomestays={onHomestays} onBookings={onBookings} onFavorites={onFavorites}
        onAccount={onAccount} onChangePassword={onChangePassword} onLogout={onLogout} {...accountLinks} />
      <header className="news-hero">
        <small>CẨM NANG DU LỊCH</small>
        <h1>Tin tức & cẩm nang từ Tripio</h1>
        <p>Điểm đến, mẹo đặt phòng và ưu đãi mới nhất cho chuyến đi của bạn.</p>
      </header>

      <main className="news-shell">
        <div className="news-filters" role="tablist" aria-label="Danh mục bài viết">
          {[{ value: '', label: 'Tất cả' }, ...NEWS_CATEGORIES].map((item) => (
            <button key={item.value || 'all'} type="button" role="tab" aria-selected={category === item.value} className={category === item.value ? 'active' : ''}
              onClick={() => { setCategory(item.value); setPage(1); }}>{item.label}</button>
          ))}
        </div>

        {loading && <p className="news-state">Đang tải bài viết…</p>}
        {!loading && error && <p className="news-state error">{error}</p>}
        {!loading && !error && result.items.length === 0 && <p className="news-state">Chưa có bài viết nào trong mục này.</p>}

        {!loading && !error && lead && (
          <button type="button" className="news-lead" onClick={() => onOpenPost(lead.slug)}>
            <img src={lead.coverImageUrl || fallbackCover} alt="" />
            <span>
              <em>{categoryLabel(lead.category)}{lead.isFeatured ? ' · Nổi bật' : ''}</em>
              <b>{lead.title}</b>
              <small>{lead.summary}</small>
              <i>{newsDate(lead.publishedAt)}</i>
            </span>
          </button>
        )}

        {!loading && !error && rest.length > 0 && (
          <div className="news-grid">
            {rest.map((post) => (
              <button type="button" key={post.id} className="news-card" onClick={() => onOpenPost(post.slug)}>
                <img src={post.coverImageUrl || fallbackCover} alt="" loading="lazy" />
                <span>
                  <em>{categoryLabel(post.category)}</em>
                  <b>{post.title}</b>
                  <small>{post.summary}</small>
                  <i>{newsDate(post.publishedAt)}</i>
                </span>
              </button>
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <nav className="news-pager" aria-label="Phân trang">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Trước</button>
            <span>Trang {page} / {pageCount}</span>
            <button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Sau →</button>
          </nav>
        )}
      </main>
      <CustomerFooter onHome={onHome} onDeveloping={onDeveloping} />
    </div>
  );
}
