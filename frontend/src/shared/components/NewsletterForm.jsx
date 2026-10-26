import React, { useState } from 'react';
import { apiClient } from '../api/apiClient.js';
import { toast } from '../feedback/feedback.js';

// "Đăng ký nhận thông tin" form used by the home page and the shared customer footer.
// The API answers the same message for new and existing emails.
export default function NewsletterForm({ source = 'home', className = 'footer-newsletter-form' }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const result = await apiClient('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email: email.trim(), source }) });
      toast.success(result.message || 'Cảm ơn bạn đã đăng ký!');
      setEmail('');
    } catch (error) {
      toast.error(error.message || 'Chưa đăng ký được, vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className={className} onSubmit={submit}>
      <input type="email" placeholder="Nhập Email của bạn" required maxLength={254} autoComplete="email" aria-label="Email nhận thông tin"
        value={email} onChange={(event) => setEmail(event.target.value)} />
      <button type="submit" disabled={sending}>{sending ? 'Đang gửi…' : 'Gửi ngay'}</button>
    </form>
  );
}
