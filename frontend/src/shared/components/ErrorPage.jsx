import React from 'react';
import '../styles/error.css';

const errors = {
  400: { title: 'Yêu cầu không hợp lệ', text: 'Yêu cầu của bạn chưa đúng hoặc còn thiếu thông tin.' },
  401: { title: 'Bạn chưa đăng nhập', text: 'Vui lòng đăng nhập để tiếp tục sử dụng nội dung này.' },
  403: { title: 'Không có quyền truy cập', text: 'Bạn không được phép truy cập vào nội dung này.' },
  404: { title: 'Không tìm thấy trang', text: 'Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.' },
  500: { title: 'Lỗi hệ thống', text: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.' }
};

export default function ErrorPage({ code = 404, onHome }) {
  const error = errors[code] || errors[404];
  return <main className="error-page">
    <a className="error-logo" href="/">tripio</a>
    <section className="error-card">
      <p className="error-code">{code}</p>
      <h1>{error.title}</h1>
      <p>{error.text}</p>
      <div className="error-actions">
        <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : onHome()}>← Quay lại</button>
        <button className="error-home" type="button" onClick={onHome}>Về trang chủ</button>
      </div>
    </section>
  </main>;
}
