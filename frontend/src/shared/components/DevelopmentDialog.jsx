import React from 'react';

export default function DevelopmentDialog({ open, feature, onClose }) {
  if (!open) return null;

  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="development-dialog" role="dialog" aria-modal="true" aria-labelledby="development-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="dialog-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
      <div className="dialog-icon">⌛</div>
      <p className="kicker">TRIPIO THÔNG BÁO</p>
      <h2 id="development-title">Tính năng đang phát triển</h2>
      <p>{feature ? `Chức năng “${feature}”` : 'Chức năng này'} đang được hoàn thiện. Vui lòng quay lại sau nhé!</p>
      <button className="dialog-primary" type="button" onClick={onClose}>Quay lại</button>
    </section>
  </div>;
}
