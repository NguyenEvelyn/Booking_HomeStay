import React, { useMemo, useState } from 'react';
import { toast } from '../../../shared/feedback/feedback.js';
import { calculateTaxSimulation, defaultTaxSimulation, readTaxSimulation, saveTaxSimulation } from '../../../shared/utils/taxSimulation.js';
import './AdminTaxSimulationPage.css';

const money = value => `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} đ`;
const percent = value => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value) || 0)}%`;

export default function AdminTaxSimulationPage() {
  const [rule, setRule] = useState(readTaxSimulation);
  const [sampleRevenue, setSampleRevenue] = useState(2000000);
  const result = useMemo(() => calculateTaxSimulation(sampleRevenue, rule), [sampleRevenue, rule]);
  const change = (key, value) => setRule(old => ({ ...old, [key]: value }));
  const save = event => {
    event.preventDefault();
    const next = saveTaxSimulation(rule);
    setRule(next);
    toast.success('Đã lưu quy tắc thuế mô phỏng.');
  };
  const reset = () => {
    const next = saveTaxSimulation(defaultTaxSimulation);
    setRule(next);
    toast.success('Đã khôi phục cấu hình mô phỏng mặc định.');
  };

  return <div className="tax-admin-page">
    <section className="tax-demo-banner" role="note">
      <span aria-hidden="true">i</span>
      <div><strong>Chế độ mô phỏng nghiệp vụ</strong><p>Số liệu chỉ phục vụ demo Tripio, không phải kết quả kê khai hoặc tư vấn thuế thực tế.</p></div>
      <em>{rule.active ? 'Đang áp dụng' : 'Đã tạm dừng'}</em>
    </section>

    <div className="tax-admin-grid">
      <form className="admin-card tax-rule-card" onSubmit={save}>
        <header><div><small>QUY TẮC CÓ PHIÊN BẢN</small><h2>Cấu hình khấu trừ mô phỏng</h2></div><label className="tax-switch"><input type="checkbox" checked={rule.active} onChange={e => change('active', e.target.checked)}/><span/><b>{rule.active ? 'Bật' : 'Tắt'}</b></label></header>
        <div className="tax-form-grid">
          <label><span>Mã phiên bản</span><input required value={rule.version} onChange={e => change('version', e.target.value)} /></label>
          <label><span>Hiệu lực từ</span><input required type="date" value={rule.effectiveFrom} onChange={e => change('effectiveFrom', e.target.value)} /></label>
          <label><span>VAT host cá nhân cư trú</span><div><input type="number" min="0" max="100" step="0.1" value={rule.residentIndividualVatRate} onChange={e => change('residentIndividualVatRate', e.target.value)} /><b>%</b></div></label>
          <label><span>TNCN host cá nhân cư trú</span><div><input type="number" min="0" max="100" step="0.1" value={rule.residentIndividualPitRate} onChange={e => change('residentIndividualPitRate', e.target.value)} /><b>%</b></div></label>
          <label><span>Phí nền tảng Tripio</span><div><input type="number" min="0" max="100" step="0.1" value={rule.platformFeeRate} onChange={e => change('platformFeeRate', e.target.value)} /><b>%</b></div></label>
          <label><span>VAT trên phí Tripio</span><div><input type="number" min="0" max="100" step="0.1" value={rule.platformFeeVatRate} onChange={e => change('platformFeeVatRate', e.target.value)} /><b>%</b></div></label>
        </div>
        <aside><strong>Host doanh nghiệp</strong><span>Tripio không khấu trừ VAT/TNCN; host tự kê khai. Phí nền tảng vẫn được tính theo cấu hình trên.</span></aside>
        <footer><button type="button" className="tax-secondary" onClick={reset}>Khôi phục mặc định</button><button type="submit">Lưu quy tắc mô phỏng</button></footer>
      </form>

      <section className="admin-card tax-preview-card">
        <header><div><small>XEM TRƯỚC KẾT QUẢ</small><h2>Booking mẫu</h2></div><span className="tax-version">{rule.version}</span></header>
        <label className="tax-revenue-input"><span>Doanh thu gộp của host</span><input type="number" min="0" step="10000" value={sampleRevenue} onChange={e => setSampleRevenue(e.target.value)} /></label>
        <dl>
          <div><dt>Customer thanh toán</dt><dd>{money(result.grossRevenue)}</dd></div>
          <div><dt>Phí Tripio ({percent(rule.platformFeeRate)})</dt><dd>− {money(result.platformFeeNet)}</dd></div>
          <div><dt>VAT phí Tripio</dt><dd>− {money(result.platformFeeVat)}</dd></div>
          <div><dt>VAT host ({percent(rule.residentIndividualVatRate)})</dt><dd>− {money(result.hostVatWithheld)}</dd></div>
          <div><dt>TNCN host ({percent(rule.residentIndividualPitRate)})</dt><dd>− {money(result.hostPitWithheld)}</dd></div>
          <div className="tax-preview-total"><dt>Host thực nhận</dt><dd>{money(result.hostNetPayout)}</dd></div>
        </dl>
        <p>Snapshot: khi booking thanh toán, hệ thống demo giữ nguyên mã phiên bản và các tỷ lệ tại thời điểm đó.</p>
      </section>
    </div>

    <section className="admin-card tax-flow-card">
      <header><div><small>LUỒNG ĐƠN GIẢN</small><h2>Tiền được phân bổ như thế nào?</h2></div></header>
      <div><article><b>1</b><span><strong>Customer thanh toán</strong><small>Chỉ thấy giá phòng, phụ thu và phí dành cho khách.</small></span></article><i>→</i><article><b>2</b><span><strong>Tripio thu hộ</strong><small>Chụp snapshot và tách phí, VAT, TNCN.</small></span></article><i>→</i><article><b>3</b><span><strong>Đối soát Host</strong><small>Host thấy doanh thu gộp, khấu trừ và thực nhận.</small></span></article></div>
    </section>
  </div>;
}
