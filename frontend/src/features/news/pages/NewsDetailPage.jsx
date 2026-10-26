import React, { useEffect, useState } from 'react';
import CustomerNav from '../../../shared/components/CustomerNav.jsx';
import CustomerFooter from '../../../shared/components/CustomerFooter.jsx';
import { toast } from '../../../shared/feedback/feedback.js';
import { newsApi } from '../api/newsApi.js';
import { categoryLabel, contentBlocks, newsDate, readingMinutes } from '../newsContent.js';
import '../styles/news.css';

const fallbackCover = '/assets/figma/blog-2.jpg';

// One published post. Content is plain text split into paragraphs/sub-headings (never rendered as HTML).
export default function NewsDetailPage({ slug, user, onHome, onHomestays, onBookings, onFavorites, onAccount, onChangePassword, onLogout, onDeveloping, accountLinks, onOpenPost, onNewsList }) {
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setPost(null); setError('');
    newsApi.detail(slug)
      .then((data) => { if (active) setPost(data); })
      .catch((err) => { if (active) setError(err.message || 'Không tìm thấy bài viết.'); });
    window.scrollTo(0, 0);
    return () => { active = false; };
  }, [slug]);

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?news=${encodeURIComponent(slug)}`;
    try { await navigator.clipboard?.writeText(url); toast.success('Đã sao chép liên kết bài viết.'); } catch { toast.info(url); }
  };

  return (
    <div className="news-page">
      <CustomerNav active="news" user={user} onHome={onHome} onHomestays={onHomestays} onBookings={onBookings} onFavorites={onFavorites}
        onAccount={onAccount} onChangePassword={onChangePassword} onLogout={onLogout} {...accountLinks} />
      <main className="news-article-shell">
        <nav className="news-breadcrumb" aria-label="Đường dẫn trang">
          <button type="button" onClick={onHome}>Trang chủ</button><span>›</span>
          <button type="button" onClick={onNewsList}>Tin tức</button>
          {post && <><span>›</span><b>{categoryLabel(post.category)}</b></>}
        </nav>

        {error && <div className="news-state error"><p>{error}</p><button type="button" onClick={onNewsList}>Về danh sách bài viết</button></div>}
        {!post && !error && <p className="news-state">Đang tải bài viết…</p>}

        {post && (
          <article className="news-article">
            <header>
              <em>{categoryLabel(post.category)}</em>
              <h1>{post.title}</h1>
              <p className="news-article-summary">{post.summary}</p>
              <div className="news-article-meta">
                <span>{newsDate(post.publishedAt)}</span><span>·</span><span>{readingMinutes(post.content)} phút đọc</span>
                <span>·</span><span>{post.viewCount} lượt xem</span>
                <button type="button" onClick={share}>Chia sẻ</button>
              </div>
            </header>
            <img className="news-article-cover" src={post.coverImageUrl || fallbackCover} alt={post.title} />
            <div className="news-article-body">
              {contentBlocks(post.content).map((block, index) => block.type === 'heading'
                ? <h2 key={index}>{block.text}</h2>
                : <p key={index}>{block.text}</p>)}
            </div>
            <aside className="news-article-cta">
              <b>Sẵn sàng cho chuyến đi?</b>
              <span>Tìm homestay phù hợp và săn ưu đãi đang diễn ra trên Tripio.</span>
              <button type="button" onClick={onHomestays}>Tìm homestay →</button>
            </aside>
          </article>
        )}

        {post?.related?.length > 0 && (
          <section className="news-related">
            <h2>Bài viết liên quan</h2>
            <div className="news-grid">
              {post.related.map((item) => (
                <button type="button" key={item.id} className="news-card" onClick={() => onOpenPost(item.slug)}>
                  <img src={item.coverImageUrl || fallbackCover} alt="" loading="lazy" />
                  <span><em>{categoryLabel(item.category)}</em><b>{item.title}</b><small>{item.summary}</small><i>{newsDate(item.publishedAt)}</i></span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
      <CustomerFooter onHome={onHome} onDeveloping={onDeveloping} />
    </div>
  );
}
