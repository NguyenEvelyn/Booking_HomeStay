import React, { useEffect, useMemo, useRef, useState } from "react";
import CustomerNav from "../../../shared/components/CustomerNav.jsx";
import { toast } from "../../../shared/feedback/feedback.js";
import { bookingApi } from "../api/bookingApi.js";
import "./MyBookingsEnhancements.css";
import "./MyBookingsMobileCompact.css";

const money = (v) =>
    `${new Intl.NumberFormat("vi-VN").format(Number(v) || 0)} đ`,
  date = (v) =>
    v
      ? new Intl.DateTimeFormat("vi-VN").format(
          new Date(`${String(v).slice(0, 10)}T00:00:00`),
        )
      : "—",
  dayKey = (v) => String(v || "").slice(0, 10);
const uiStatus = (s) =>
  s === "Hold" ? "PendingPayment" : s === "CheckedOut" ? "Completed" : s;
const labels = {
  PendingPayment: "Chờ thanh toán",
  PaymentFailed: "Thanh toán lỗi",
  Expired: "Hết hạn",
  Confirmed: "Đã xác nhận",
  CheckedIn: "Đang ở",
  CheckoutPendingPayment: "Chờ xác nhận trả phòng",
  Completed: "Hoàn thành",
  Cancelled: "Đã hủy",
  NoShow: "Không đến",
};
const groups = {
    upcoming: ["PendingPayment", "PaymentFailed", "Confirmed"],
    staying: ["CheckedIn", "CheckoutPendingPayment"],
    completed: ["Completed"],
    cancelled: ["Cancelled", "Expired", "NoShow"],
  },
  tabs = [
    ["upcoming", "Sắp tới"],
    ["staying", "Đang ở"],
    ["completed", "Hoàn thành"],
    ["cancelled", "Đã hủy"],
  ];
const daysUntil = (v) =>
  Math.ceil(
    (new Date(`${dayKey(v)}T00:00:00`) - new Date(new Date().toDateString())) /
      86400000,
  );
const paidOf = (x) =>
  Number(
    x.paidAmount ??
      x.payments
        ?.filter(
          (p) => p.transactionType !== "Refund" && p.status === "Success",
        )
        .reduce((s, p) => s + Number(p.amount), 0) ??
      0,
  );
function useDialog(close) {
  const ref = useRef(null),
    opener = useRef(document.activeElement);
  useEffect(() => {
    const root = ref.current,
      list = () => [
        ...root.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ),
      ],
      key = (e) => {
        if (e.key === "Escape") close();
        if (e.key === "Tab") {
          const a = list(),
            first = a[0],
            last = a.at(-1);
          if (!first) return;
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
    document.addEventListener("keydown", key);
    requestAnimationFrame(() => list()[0]?.focus());
    return () => {
      document.removeEventListener("keydown", key);
      opener.current?.focus?.();
    };
  }, [close]);
  return ref;
}

export default function MyBookingsPage({
  user,
  onHome,
  onHomestays,
  onOpenHomestay,
  onAccount,
  onChangePassword,
  onLogout,
}) {
  const [items, setItems] = useState([]),
    [status, setStatus] = useState(
      () => new URLSearchParams(location.search).get("status") || "upcoming",
    ),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(null),
    [cancel, setCancel] = useState(null),
    [review, setReview] = useState(null),
    [serviceBooking, setServiceBooking] = useState(null),
    [query, setQuery] = useState(""),
    [detailLoading, setDetailLoading] = useState(false);

  const handleRebook = async (booking) => {
    if (!booking) return;
    let homestayId = booking.homestayId;
    let roomTypeId =
      booking.roomTypeId ||
      booking.details?.[0]?.roomTypeId ||
      booking.details?.[0]?.room_type_id;

    if (booking.id && (!homestayId || !roomTypeId)) {
      try {
        const full = await bookingApi.detail(booking.id);
        homestayId = homestayId || full.homestayId;
        roomTypeId = roomTypeId || full.roomTypeId || full.details?.[0]?.roomTypeId;
      } catch {
        // ignore fallback
      }
    }

    if (onOpenHomestay && homestayId) {
      onOpenHomestay(homestayId, {
        roomTypeId: roomTypeId || null,
        adults: booking.adultCount || 2,
        children: booking.childCount || 0,
      });
      return;
    }
    onHomestays?.();
  };
  const load = async () => {
    setLoading(true);
    try {
      const data = await bookingApi.mine();
      setItems(data.items);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const changeStatus = (value) => {
    setStatus(value);
    const url = new URL(location.href);
    url.searchParams.set("status", value);
    history.replaceState(null, "", url);
  };
  const counts = useMemo(
    () =>
      Object.fromEntries(
        tabs.map(([key]) => [
          key,
          items.filter((x) => groups[key].includes(uiStatus(x.status))).length,
        ]),
      ),
    [items],
  );
  const filtered = useMemo(
    () =>
      items
        .filter((x) => groups[status]?.includes(uiStatus(x.status)))
        .filter((x) =>
          `${x.bookingCode} ${x.homestayName}`
            .toLocaleLowerCase("vi")
            .includes(query.trim().toLocaleLowerCase("vi")),
        )
        .sort((a, b) =>
          status === "upcoming"
            ? dayKey(a.checkInDate).localeCompare(dayKey(b.checkInDate))
            : new Date(b.createdAt) - new Date(a.createdAt),
        ),
    [items, status, query],
  );
  const openDetail = async (x) => {
    setDetailLoading(true);
    try {
      setDetail(await bookingApi.detail(x.id));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDetailLoading(false);
    }
  };
  const pay = async (x) => {
    try {
      const result = await bookingApi.retryPayment(x.id);
      location.assign(result.paymentUrl);
    } catch (e) {
      toast.error(e.message);
      load();
    }
  };
  const openReview = (x) => setReview({ booking: x, existing: x.review });
  return (
    <main className="my-bookings-page">
      <CustomerNav
        active="bookings"
        user={user}
        onHome={onHome}
        onHomestays={onHomestays}
        onBookings={() => {}}
        onAccount={onAccount}
        onChangePassword={onChangePassword}
        onLogout={onLogout}
      />
      <section className="my-bookings-shell">
        <header className="booking-page-head">
          <div>
            <small>CHUYẾN ĐI CỦA BẠN</small>
            <h1>Đơn đặt phòng của tôi</h1>
            <p>Theo dõi kỳ lưu trú, thanh toán và trải nghiệm của bạn.</p>
          </div>
          <label className="booking-search">
            <span className="sr-only">Tìm theo mã đơn hoặc tên homestay</span>
            <input
              aria-label="Tìm theo mã đơn hoặc tên homestay"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="⌕  Mã đơn hoặc tên homestay"
            />
          </label>
        </header>
        <nav className="customer-booking-tabs" aria-label="Lọc đơn đặt phòng">
          {tabs.map(([k, v]) => (
            <button
              key={k}
              className={status === k ? "active" : ""}
              onClick={() => changeStatus(k)}
            >
              {v}
              <b>{counts[k]}</b>
            </button>
          ))}
        </nav>
        {error && (
          <p className="customer-booking-error" role="alert">
            ⚠ {error} <button onClick={load}>Thử lại</button>
          </p>
        )}
        {loading ? (
          <div className="customer-booking-skeleton">
            {[1, 2, 3].map((x) => (
              <i key={x} />
            ))}
          </div>
        ) : (
          <div className="customer-booking-list">
            {filtered.map((x) => (
              <BookingCard
                key={x.id}
                item={x}
                detail={() => openDetail(x)}
                pay={() => pay(x)}
                cancel={() => setCancel(x)}
                review={() => openReview(x)}
                rebook={() => handleRebook(x)}
                service={() => setServiceBooking(x)}
              />
            ))}
            {!filtered.length && (
              <Empty status={status} query={query} explore={onHomestays} />
            )}
          </div>
        )}
      </section>
      {detailLoading && (
        <div className="booking-detail-loading" role="status">
          Đang tải chi tiết…
        </div>
      )}
      {detail && (
        <BookingDetail
          data={detail}
          close={() => setDetail(null)}
          cancel={() => {
            setCancel(detail);
            setDetail(null);
          }}
          pay={() => pay(detail)}
          review={() => {
            openReview(detail);
            setDetail(null);
          }}
          rebook={() => handleRebook(detail)}
          refresh={async () => {
            setDetail(await bookingApi.detail(detail.id));
            load();
          }}
        />
      )}{" "}
      {cancel && (
        <CancelDialog
          item={cancel}
          close={() => setCancel(null)}
          reload={load}
        />
      )}{" "}
      {review && (
        <ReviewDialog
          data={review}
          close={() => setReview(null)}
          reload={load}
        />
      )}
      {serviceBooking && <ServiceRequestDialog booking={serviceBooking} close={() => setServiceBooking(null)} reload={load} />}
    </main>
  );
}
function Empty({ status, query, explore }) {
  const copy = {
    upcoming: [
      "Chưa có chuyến đi sắp tới",
      "Khi bạn đặt phòng, hành trình sẽ xuất hiện tại đây.",
    ],
    staying: [
      "Bạn chưa có kỳ lưu trú đang diễn ra",
      "Các chuyến đang ở sẽ được cập nhật tại đây.",
    ],
    completed: [
      "Chưa có chuyến đi hoàn thành",
      "Sau chuyến đi, bạn có thể đánh giá trải nghiệm tại đây.",
    ],
    cancelled: [
      "Chưa có đơn đã hủy",
      "Các đơn hủy hoặc hết hạn sẽ xuất hiện tại đây.",
    ],
  }[status];
  return (
    <div className="customer-booking-empty">
      <b>⌂</b>
      <h2>{query ? "Không tìm thấy đơn phù hợp" : copy[0]}</h2>
      <p>{query ? "Thử tìm bằng mã đơn hoặc tên homestay khác." : copy[1]}</p>
      {status === "upcoming" && !query && (
        <button onClick={explore}>Khám phá chỗ ở</button>
      )}
    </div>
  );
}
function BookingCard({ item, detail, pay, cancel, review, rebook, service }) {
  const status = uiStatus(item.status),
    days = daysUntil(item.checkInDate),
    // An expired hold for a future stay can be paid again; the server re-checks availability.
    payable = ["PendingPayment", "PaymentFailed"].includes(status) || (status === "Expired" && days >= 0),
    action = (e) => {
      e.stopPropagation();
      if (payable) pay();
      else if (status === "Completed") review();
      else if (groups.cancelled.includes(status)) rebook();
      else detail();
    },
    text = payable
      ? status === "Expired" ? "Thanh toán lại" : "Thanh toán ngay"
      : status === "Completed"
        ? "Viết đánh giá"
        : groups.cancelled.includes(status)
          ? "Đặt lại"
          : "Xem chi tiết";
  return (
    <article
      className="customer-booking-card"
      role="button"
      tabIndex="0"
      onClick={detail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          detail();
        }
      }}
    >
      <div
        className="customer-booking-image"
        style={{
          backgroundImage: `url(${item.homestayImage || "/assets/hero.png"})`,
        }}
      />
      <div className="customer-booking-main">
        <div className="booking-card-copy">
          <div className="booking-card-title">
            <h2>{item.homestayName}</h2>
            <p>{item.city || item.province || "Việt Nam"}</p>
          </div>
          <div className="booking-card-meta">
            <b>
              {date(item.checkInDate)} → {date(item.checkOutDate)} ·{" "}
              {item.nights} đêm
            </b>
            <span>
              {item.rooms?.join(" · ") || "Thông tin phòng đang cập nhật"}
            </span>
          </div>
          <div className="booking-card-chips">
            <span className={`customer-status ${status.toLowerCase()}`}>
              {labels[status] || status}
            </span>
            {status === "Confirmed" && (
              <span className="countdown-chip">
                {days === 0
                  ? "Hôm nay nhận phòng"
                  : days > 0
                    ? `Còn ${days} ngày`
                    : "Đã đến ngày nhận phòng"}
              </span>
            )}
            {["PendingPayment", "PaymentFailed"].includes(status) && (
              <span className="hold-chip">Giữ phòng có thời hạn</span>
            )}
          </div>
          <small>Mã đơn {item.bookingCode}</small>
        </div>
        <aside>
          <strong>{money(item.totalAmount)}</strong>
          <button
            className={
              payable || status === "CheckedIn"
                ? "primary"
                : ""
            }
            onClick={action}
          >
            {text}
          </button>
          {["Confirmed", "CheckedIn"].includes(status) && (
            <button className="card-service" onClick={(e) => { e.stopPropagation(); service(); }}>
              {item.activeServiceRequestCount > 0 ? `Yêu cầu đang xử lý (${item.activeServiceRequestCount})` : "Yêu cầu dịch vụ"}
            </button>
          )}
          {["PendingPayment", "Confirmed"].includes(status) && (
            <button
              className="card-cancel"
              onClick={(e) => {
                e.stopPropagation();
                cancel();
              }}
            >
              Hủy đơn
            </button>
          )}
          {status === "Completed" && (
            <button
              className="card-cancel"
              style={{ background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}
              onClick={(e) => {
                e.stopPropagation();
                rebook();
              }}
            >
              Đặt lại
            </button>
          )}
        </aside>
      </div>
    </article>
  );
}

function ServiceRequestDialog({ booking, close, reload }) {
  const ref = useDialog(close);
  const [data, setData] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [cart, setCart] = useState({}), [category, setCategory] = useState("all");
  const [form, setForm] = useState({ requestedFor: "", note: "", doNotDisturb: false });
  const load = async () => { try { setData(await bookingApi.serviceRequests(booking.id)); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); const timer=window.setInterval(load,20000); return()=>window.clearInterval(timer); }, [booking.id]);
  const submit = async (e) => { e.preventDefault(); const choices=Object.entries(cart).filter(([,qty])=>qty>0); if(!choices.length){setError("Vui lòng chọn ít nhất một tiện ích.");return} setBusy(true); setError(""); try { await Promise.all(choices.map(([serviceId,quantity])=>bookingApi.createServiceRequest(booking.id,{...form,serviceId:Number(serviceId),quantity,requestedFor:form.requestedFor?new Date(form.requestedFor).toISOString():null}))); toast.success(`Đã gửi ${choices.length} tiện ích đến Host.`); setCart({}); setForm({requestedFor:"",note:"",doNotDisturb:false}); await load(); await reload(); } catch (x) { setError(x.message); } finally { setBusy(false); } };
  const confirmDone = async (id) => { try { await bookingApi.confirmServiceCompleted(id); toast.success("Đã xác nhận hoàn thành."); await load(); } catch (e) { toast.error(e.message); } };
  const respondProposal = async (id,accepted) => { try { await bookingApi.respondServiceProposal(id,accepted); toast.success(accepted?"Đã chấp nhận đề xuất.":"Đã từ chối đề xuất."); await load(); } catch(e){toast.error(e.message);} };
  const statusText = { Pending:"Chờ Host xác nhận", Approved:"Host đã xác nhận", Rejected:"Host từ chối", ChangeProposed:"Host đề xuất thay đổi", InProgress:"Đang thực hiện", HostCompleted:"Chờ bạn xác nhận", Completed:"Đã hoàn thành", Cancelled:"Đã hủy" };
  const serviceVisual = (service) => {
    const key = `${service.name} ${service.category}`.toLocaleLowerCase("vi");
    if (key.includes("dọn")) return ["M4 18h16M6 18l2-9h8l2 9M9 9V5h6v4", "cleaning"];
    if (key.includes("khăn") || key.includes("giặt")) return ["M5 4h14v16H5zM8 8h8M8 12h8M8 16h5", "laundry"];
    if (key.includes("ga") || key.includes("nệm") || key.includes("giường")) return ["M3 18V8m0 7h18m0 3V9a3 3 0 0 0-3-3h-6v9M3 11h9", "bed"];
    if (key.includes("nước")) return ["M12 3s6 6.4 6 11a6 6 0 1 1-12 0c0-4.6 6-11 6-11Z", "water"];
    if (key.includes("ăn") || key.includes("bbq")) return ["M7 3v8m-3-8v5a3 3 0 0 0 6 0V3m7 0v18m0-18c3 2 3 7 0 9", "food"];
    if (key.includes("xe") || key.includes("đón")) return ["M3 16V8h18v8M5 16v2m14-2v2M7 12h.01M17 12h.01M6 8l2-4h8l2 4", "transport"];
    return ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z", "amenity"];
  };
  const categories = [{key:"all",label:"Tất cả"},...Array.from(new Set((data?.services||[]).map(x=>x.category))).map(key=>({key,label:{Cleaning:"Dọn phòng",Amenity:"Tiện ích",Food:"Ăn uống",Transport:"Di chuyển",Other:"Khác"}[key]||key}))];
  const visibleServices=(data?.services||[]).filter(x=>category==="all"||x.category===category);
  const selectedItems=(data?.services||[]).filter(x=>(cart[x.id]||0)>0);
  const total=selectedItems.reduce((sum,x)=>sum+Number(x.price)*(cart[x.id]||0),0);
  const setQuantity=(id,value)=>setCart(current=>({...current,[id]:Math.max(0,Math.min(20,value))}));
  return <div className="customer-modal-backdrop service-request-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}><section ref={ref} className="customer-action-modal service-request-dialog" role="dialog" aria-modal="true" aria-labelledby="service-request-title"><button className="modal-x" onClick={close}>×</button><small>DỊCH VỤ TRONG KỲ NGHỈ</small><h2 id="service-request-title">Yêu cầu dịch vụ</h2><p>{booking.homestayName} · Mã đơn {booking.bookingCode}</p>
    {!data ? <div className="modal-skeleton" /> : <>
      {data.canRequest && data.services.length > 0 && <form className="service-request-form service-marketplace" onSubmit={submit}><nav className="service-category-tabs" aria-label="Danh mục tiện ích">{categories.map(x=><button type="button" key={x.key} className={category===x.key?'active':''} onClick={()=>setCategory(x.key)}>{x.label}</button>)}</nav><fieldset className="service-choice-fieldset"><legend>Chọn thêm tiện ích</legend><div className="service-choice-grid">{visibleServices.map((x)=>{const[path,tone]=serviceVisual(x),quantity=cart[x.id]||0;return <article key={x.id} className={`service-choice-card ${tone} ${quantity?'selected':''}`}><button type="button" className="service-card-pick" aria-label={`Thêm ${x.name}`} onClick={()=>setQuantity(x.id,quantity?0:1)}><span className="service-choice-art" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={path}/></svg></span><span className="service-choice-copy"><b>{x.name}</b><small>{x.description||'Yêu cầu thêm cho kỳ lưu trú'}</small><strong>{x.price?`${money(x.price)} / ${x.unit}`:'Miễn phí'}</strong></span></button>{quantity>0&&<div className="service-quantity" aria-label={`Số lượng ${x.name}`}><button type="button" aria-label="Giảm số lượng" onClick={()=>setQuantity(x.id,quantity-1)}>−</button><output>{quantity}</output><button type="button" aria-label="Tăng số lượng" onClick={()=>setQuantity(x.id,quantity+1)}>+</button></div>}</article>})}</div></fieldset>{selectedItems.length>0&&<div className="service-cart-summary"><div><span>Đã chọn {selectedItems.length} tiện ích</span><strong>{money(total)}</strong></div><p>{selectedItems.map(x=>`${x.name} × ${cart[x.id]}`).join(' · ')}</p></div>}<div className="service-form-row single"><label><span>Thời gian mong muốn cho các tiện ích</span><input type="datetime-local" value={form.requestedFor} onChange={(e)=>setForm({...form,requestedFor:e.target.value})}/></label></div><label><span>Ghi chú chung cho Host</span><textarea maxLength="1000" rows="3" value={form.note} onChange={(e)=>setForm({...form,note:e.target.value})} placeholder="Ví dụ: vui lòng chuẩn bị trước 14:00…"/></label><label className="service-check"><input type="checkbox" checked={form.doNotDisturb} onChange={(e)=>setForm({...form,doNotDisturb:e.target.checked})}/><span>Không vào phòng khi tôi vắng mặt</span></label><button className="service-submit" disabled={busy||!selectedItems.length}>{busy?"Đang gửi…":`Gửi ${selectedItems.length||''} tiện ích đến Host`}</button></form>}
      {!data.canRequest&&<p className="service-unavailable">Trạng thái đơn hiện tại chưa hỗ trợ gửi thêm yêu cầu.</p>}
      <div className="service-history"><h3>Yêu cầu của tôi</h3>{data.requests.map((x)=><article key={x.id}><div><strong>{x.title} × {x.quantity}</strong><span className={`service-status ${x.status.toLowerCase()}`}>{statusText[x.status] || x.status}</span></div><small>{x.requestedFor ? `Mong muốn: ${new Date(x.requestedFor).toLocaleString("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"})} · ` : ""}{money(x.approvedAmount ?? x.estimatedAmount)}</small>{x.hostResponse&&<p>Phản hồi Host: {x.hostResponse}</p>}{x.status==="ChangeProposed"&&<div className="service-proposal-actions"><button onClick={()=>respondProposal(x.id,true)}>Chấp nhận</button><button onClick={()=>respondProposal(x.id,false)}>Từ chối</button></div>}{x.status==="HostCompleted"&&<button className="service-confirm-done" onClick={()=>confirmDone(x.id)}>✓ Xác nhận hoàn tất</button>}</article>)}{!data.requests.length&&<p>Chưa có yêu cầu nào cho kỳ lưu trú này.</p>}</div>
    </>}{error&&<p className="modal-error">{error}</p>}</section></div>;
}

function BookingDetail({ data, close, cancel, pay, review, rebook, refresh }) {
  const ref = useDialog(close),
    status = uiStatus(data.status),
    [contact, setContact] = useState({
      contactName: data.contactName || "",
      phone: data.contactPhone || "",
      email: data.contactEmail || "",
      guestName: data.guestName || data.contactName || "",
      contactNameEditCount: data.contactNameEditCount || 0,
    }),
    [editingContact, setEditingContact] = useState(false),
    paid = paidOf(data),
    due = Math.max(0, Number(data.totalAmount) - paid),
    nights = data.details?.[0]?.numberOfNights || 1,
    freeDeadline = new Date(
      `${dayKey(data.checkInDate)}T${String(data.checkInTime || "14:00").slice(0, 5)}:00`,
    );
  freeDeadline.setHours(freeDeadline.getHours() - 48);
  const free = new Date() < freeDeadline,
    canEditContact = status === "PendingPayment" || (status === "Confirmed" && daysUntil(data.checkInDate) > 0) || ["CheckedIn", "CheckoutPendingPayment"].includes(status),
    showArrival =
      ["Confirmed", "CheckedIn", "CheckoutPendingPayment"].includes(status) &&
      daysUntil(data.checkInDate) <= 1,
    copy = async (value, label) => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success(label);
      } catch {
        toast.error(`Hãy chọn và sao chép: ${value}`);
      }
    },
    map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address || data.homestayName)}`,
    primary =
      status === "PendingPayment"
        ? ["Thanh toán ngay", pay]
        : status === "Confirmed"
          ? ["Chỉ đường", () => window.open(map, "_blank", "noopener")]
          : status === "Completed"
            ? ["Viết đánh giá", review]
            : groups.cancelled.includes(status)
              ? ["Đặt lại", rebook]
              : null;
  return (
    <div
      className="customer-modal-backdrop booking-detail-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={ref}
        className="customer-booking-detail"
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết đơn ${data.bookingCode}`}
      >
        <header>
          <div>
            <span className={`customer-status ${status.toLowerCase()}`}>
              {labels[status] || status}
            </span>
            <p>
              Mã đơn <b>{data.bookingCode}</b>{" "}
              <button
                onClick={() => copy(data.bookingCode, "Đã sao chép mã đơn")}
              >
                Sao chép
              </button>
            </p>
            <h1>{data.homestayName}</h1>
          </div>
          <button className="modal-x" onClick={close} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="booking-detail-layout">
          <div className="booking-detail-main">
            {status === "PendingPayment" && (
              <HoldBanner expires={data.holdExpiresAt} />
            )}{" "}
            {status === "CheckoutPendingPayment" && (
              <div className="state-banner info">
                <b>Chủ nhà sẽ kiểm tra phòng và xác nhận</b>
                <span>
                  Khoản cọc sẽ được hoàn theo chính sách sau khi hoàn tất kiểm
                  tra.
                </span>
              </div>
            )}
            <NoShowPanel data={data} status={status} refresh={refresh} />
            {groups.cancelled.includes(status) && status !== "NoShow" && (
              <div className="state-banner danger">
                <b>Đơn đã hủy</b>
                <span>
                  Đã hoàn {money(data.refundedAmount)} · dự kiến 3–5 ngày làm
                  việc.
                </span>
              </div>
            )}
            {showArrival && (
              <div className="arrival-box">
                <small>MÃ NHẬN PHÒNG</small>
                <strong>
                  {String(data.bookingCode)
                    .replace(/\D/g, "")
                    .slice(-6)
                    .padStart(6, "0")
                    .replace(/(.{3})/, "$1 ")}
                </strong>
                <span>Đưa mã này cho chủ nhà khi đến nơi</span>
              </div>
            )}
            {showArrival && (
              <div className="state-banner success">
                <b>Hướng dẫn nhận phòng</b>
                <span>
                  Liên hệ chủ nhà khi đến nơi và xuất trình mã nhận phòng ở
                  trên.
                </span>
              </div>
            )}
            <DetailCard title="Thông tin lưu trú">
              <div className="stay-grid">
                <Info
                  label="Nhận phòng"
                  value={date(data.checkInDate)}
                  sub={`Từ ${String(data.checkInTime).slice(0, 5)}`}
                />
                <Info
                  label="Trả phòng"
                  value={date(data.checkOutDate)}
                  sub={`Trước ${String(data.checkOutTime).slice(0, 5)}`}
                />
                <Info label="Thời gian" value={`${nights} đêm`} />
                <Info
                  label="Số khách"
                  value={`${data.adultCount + data.childCount} người`}
                />
                <Info
                  label="Loại phòng"
                  value={data.details
                    ?.map(
                      (x) =>
                        `${x.roomTypeName}${x.roomNumber ? ` · ${x.roomNumber}` : ""}`,
                    )
                    .join(", ")}
                />
                <Info
                  label="Yêu cầu đặc biệt"
                  value={data.customerNote || "Không có"}
                />
              </div>
            </DetailCard>
            <DetailCard
              title="Người liên hệ"
              action={canEditContact && (
                <button className="contact-edit-button" onClick={() => setEditingContact(true)}>
                  Chỉnh sửa
                </button>
              )}
            >
              <div className="contact-grid">
                <Info label="Họ tên người liên hệ" value={contact.contactName} />
                <Info label="Số điện thoại" value={formatPhone(contact.phone)} />
                <Info label="Email" value={contact.email || "Chưa có"} />
                <Info label="Khách nhận phòng" value={contact.guestName === contact.contactName ? "Giống người liên hệ" : contact.guestName} />
              </div>
            </DetailCard>
            <DetailCard title="Thông tin homestay">
              <div className="homestay-detail">
                <img
                  src={data.homestayImage || "/assets/hero.png"}
                  alt={data.homestayName}
                />
                <div>
                  <b>{data.homestayName}</b>
                  <p>{data.address}</p>
                  <p>Chủ nhà: {data.hostName}</p>
                  <p>
                    Số điện thoại:{" "}
                    <strong>{data.hostPhone || "Chưa cập nhật"}</strong>
                  </p>
                </div>
              </div>
              <div className="inline-actions">
                <a href={map} target="_blank" rel="noopener noreferrer">
                  Chỉ đường
                </a>
                <button
                  onClick={() => copy(data.address, "Đã sao chép địa chỉ")}
                >
                  Sao chép địa chỉ
                </button>
                <button
                  onClick={() =>
                    copy(data.hostPhone || "", "Đã sao chép số điện thoại")
                  }
                  disabled={!data.hostPhone}
                >
                  Liên hệ chủ nhà
                </button>
              </div>
            </DetailCard>
            <DetailCard title="Chính sách">
              <ul className="policy-list">
                <li>
                  Hủy miễn phí trước {freeDeadline.toLocaleString("vi-VN")}.
                </li>
                <li>
                  Sau thời hạn, phí hủy theo chính sách và không vượt số tiền đã
                  thanh toán.
                </li>
                <li>
                  Nhận phòng từ {String(data.checkInTime).slice(0, 5)}, trả
                  phòng trước {String(data.checkOutTime).slice(0, 5)}.
                </li>
                <li>Tiền cọc: {money(data.depositAmount)}.</li>
              </ul>
            </DetailCard>
            <DetailCard title="Tiến trình đơn">
              <Timeline
                status={status}
                cancelled={groups.cancelled.includes(status)}
                paid={paid > 0}
              />
            </DetailCard>
          </div>
          <aside className="payment-card">
            <h2>Thanh toán</h2>
            <Price
              l={`Giá phòng (${nights} đêm)`}
              v={data.roomAmount || data.subtotal}
            />
            <Price l="Phí dịch vụ" v={data.serviceFee} />
            {Number(data.discountAmount) > 0 && (
              <Price l="Voucher" v={-data.discountAmount} green />
            )}
            <Price l="Tổng cộng" v={data.totalAmount} total />
            <hr />
            <Price l="Đã thanh toán" v={paid} />
            {due > 0 && !groups.cancelled.includes(status) && (
              <Price l="Còn phải thanh toán" v={due} due />
            )}
            {Number(data.depositAmount) > 0 && (
              <Price l="Tiền cọc" v={data.depositAmount} />
            )}{" "}
            {groups.cancelled.includes(status) && (
              <Price l="Đã hoàn lại" v={data.refundedAmount} green />
            )}
            <div className="detail-actions">
              {primary && (
                <button className="primary" onClick={primary[1]}>
                  {primary[0]}
                </button>
              )}
              {status === "Confirmed" && (
                <>
                  <button
                    onClick={() =>
                      copy(data.hostPhone || "", "Đã sao chép số điện thoại")
                    }
                  >
                    Liên hệ chủ nhà
                  </button>
                </>
              )}
              {["PendingPayment", "Confirmed"].includes(status) && (
                <button className="danger" onClick={cancel}>
                  Hủy đơn
                </button>
              )}
              {status === "Completed" && (
                <>
                  <button onClick={rebook}>Đặt lại</button>
                  <button onClick={() => window.print()}>Tải hóa đơn</button>
                </>
              )}
              {status === "Confirmed" && (
                <small>
                  {free
                    ? `Hủy miễn phí đến ${freeDeadline.toLocaleString("vi-VN")}`
                    : "Đã quá hạn hủy miễn phí"}
                </small>
              )}
              {status === "CheckedIn" && (
                <small>
                  Trả phòng online đang ẩn vì backend chưa hỗ trợ yêu cầu từ
                  khách.
                </small>
              )}
            </div>
          </aside>
        </div>
        {primary && (
          <div className="mobile-primary">
            <button onClick={primary[1]}>{primary[0]}</button>
          </div>
        )}
      </section>
      {editingContact && (
        <ContactDialog
          bookingId={data.id}
          status={status}
          value={contact}
          close={() => setEditingContact(false)}
          saved={(next) => {
            setContact(next);
            setEditingContact(false);
            toast.success("Đã cập nhật người liên hệ");
          }}
        />
      )}
    </div>
  );
}
const formatPhone = (value = "") => {
  const phone = value.replace(/[\s.()-]/g, "").replace(/^\+84/, "0");
  return /^0\d{9}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : value || "Chưa cập nhật";
};

function ContactDialog({ bookingId, status, value, close, saved }) {
  const ref = useDialog(close);
  const lockedNames = ["CheckedIn", "CheckoutPendingPayment"].includes(status);
  const [form, setForm] = useState({
    contactName: value.contactName,
    phone: value.phone,
    email: value.email || "",
    otherGuest: value.guestName !== value.contactName,
    guestName: value.guestName,
  });
  const [busy, setBusy] = useState(false), [serverError, setServerError] = useState("");
  const compactPhone = form.phone.replace(/[\s.()-]/g, "");
  const errors = {
    contactName: form.contactName.trim().length < 2 ? "Họ tên người liên hệ phải có ít nhất 2 ký tự" : "",
    phone: /^(0\d{9}|\+84\d{9})$/.test(compactPhone) ? "" : "Số điện thoại chưa đúng, vui lòng nhập 10 số bắt đầu bằng 0",
    email: !form.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "" : "Email chưa đúng định dạng",
    guestName: form.otherGuest && form.guestName.trim().length < 2 ? "Họ tên khách nhận phòng phải có ít nhất 2 ký tự" : "",
  };
  const payload = { contactName: form.contactName.trim(), phone: compactPhone, email: form.email.trim() || null, guestName: form.otherGuest ? form.guestName.trim() : form.contactName.trim() };
  const initial = { contactName: value.contactName, phone: value.phone.replace(/[\s.()-]/g, ""), email: value.email || null, guestName: value.guestName };
  const changed = JSON.stringify(payload) !== JSON.stringify(initial);
  const valid = !Object.values(errors).some(Boolean);
  const update = (key) => (e) => { setForm((x) => ({ ...x, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value })); setServerError(""); };
  const save = async () => {
    if (!changed || !valid || busy) return;
    setBusy(true); setServerError("");
    try { const result = await bookingApi.updateContact(bookingId, payload); saved(result.contact); }
    catch (error) { setServerError(error.message || "Không thể cập nhật người liên hệ."); }
    finally { setBusy(false); }
  };
  const field = (name, label, props = {}) => <label className={errors[name] ? "field-invalid" : ""}><span>{label}</span><input {...props} value={form[name]} onChange={update(name)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined}/>{errors[name] && <small id={`${name}-error`}>{errors[name]}</small>}</label>;
  return <div className="customer-modal-backdrop contact-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
    <section ref={ref} className="customer-action-modal contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title">
      <button className="modal-x" onClick={close} aria-label="Đóng">×</button>
      <small>THÔNG TIN ĐƠN ĐẶT PHÒNG</small><h2 id="contact-dialog-title">Chỉnh sửa người liên hệ</h2>
      {lockedNames && <p className="contact-lock-note">Đã nhận phòng nên không thể đổi tên khách.</p>}
      <div className="contact-form">
        {field("contactName", "Họ tên người liên hệ", { disabled: lockedNames, required: true })}
        {field("phone", "Số điện thoại", { inputMode: "tel", required: true, placeholder: "0901 234 567" })}
        {field("email", "Email", { type: "email", placeholder: "email@example.com" })}
        <label className="other-guest-check"><input type="checkbox" checked={form.otherGuest} disabled={lockedNames} onChange={update("otherGuest")}/><span>Tôi đặt giúp người khác</span></label>
        {form.otherGuest && field("guestName", "Họ tên khách nhận phòng", { disabled: lockedNames, required: true })}
      </div>
      {serverError && <div className="modal-error" role="alert">⚠ {serverError} <button onClick={save} disabled={busy}>Thử lại</button></div>}
      <footer><button onClick={close}>Hủy</button><button className="primary" onClick={save} disabled={!changed || !valid || busy}>{busy ? "Đang lưu..." : "Lưu thay đổi"}</button></footer>
    </section>
  </div>;
}
const timeLabel = (v) =>
  v ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "—";
// datetime-local value in the viewer's local time.
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

// Late arrival announcement (keeps the room past the no-show grace period) and the no-show outcome/dispute.
function NoShowPanel({ data, status, refresh }) {
  const [mode, setMode] = useState(null),
    [arrival, setArrival] = useState(""),
    [note, setNote] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const canAnnounce = status === "Confirmed" && daysUntil(data.checkInDate) <= 1 && daysUntil(data.checkInDate) >= 0;
  const run = async (action, success) => {
    setBusy(true);
    try {
      const result = await action();
      toast.success(result?.message || success);
      setMode(null);
      await refresh?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (status === "NoShow" && data.noShow) {
    const n = data.noShow;
    return (
      <div className="state-banner danger">
        <b>Đơn được ghi nhận không đến nhận phòng</b>
        <span>
          Đã thanh toán {money(n.paidAmount)} · chủ nhà giữ lại {money(n.retainedAmount)} · hoàn lại {money(n.refundAmount)}.
        </span>
        {n.disputeStatus === "Pending" && <span>Khiếu nại của bạn đang được quản trị viên xem xét.</span>}
        {n.disputeStatus === "Accepted" && <span>Khiếu nại đã được chấp nhận. {n.resolutionNote}</span>}
        {n.disputeStatus === "Rejected" && <span>Khiếu nại chưa được chấp nhận. {n.resolutionNote}</span>}
        {n.canDispute && mode !== "dispute" && (
          <button type="button" onClick={() => setMode("dispute")}>Khiếu nại (trong 48 giờ)</button>
        )}
        {mode === "dispute" && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => bookingApi.disputeNoShow(data.id, reason.trim()), "Đã gửi khiếu nại."); }}>
            <textarea required minLength={10} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: tôi đã đến lúc 21:00 nhưng không liên lạc được chủ nhà / tôi đã báo đến muộn…" />
            <button disabled={busy}>Gửi khiếu nại</button>
            <button type="button" onClick={() => setMode(null)}>Hủy</button>
          </form>
        )}
      </div>
    );
  }
  if (!canAnnounce) return null;
  const openForm = () => {
    const base = data.expectedArrivalAt ? new Date(data.expectedArrivalAt) : new Date(Date.now() + 2 * 3600000);
    setArrival(localInput(base));
    setNote(data.lateArrivalNote || "");
    setMode("late");
  };
  return (
    <div className="state-banner info">
      <b>{data.expectedArrivalAt ? `Bạn đã báo sẽ đến lúc ${timeLabel(data.expectedArrivalAt)}` : "Bạn sẽ đến muộn?"}</b>
      <span>
        {data.expectedArrivalAt
          ? "Chủ nhà sẽ giữ phòng cho bạn đến giờ đã báo."
          : "Báo giờ đến dự kiến để chủ nhà giữ phòng, tránh bị ghi nhận không đến."}
      </span>
      {mode !== "late" && (
        <button type="button" onClick={openForm}>{data.expectedArrivalAt ? "Đổi giờ đến" : "Tôi sẽ đến muộn"}</button>
      )}
      {mode === "late" && (
        <form onSubmit={(e) => {
          e.preventDefault();
          run(() => bookingApi.announceLateArrival(data.id, { expectedArrivalAt: new Date(arrival).toISOString(), note: note.trim() || null }), "Đã báo đến muộn.");
        }}>
          <label>Giờ đến dự kiến<input required type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} /></label>
          <label>Ghi chú cho chủ nhà<input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: chuyến bay bị hoãn" /></label>
          <button disabled={busy}>Xác nhận</button>
          <button type="button" onClick={() => setMode(null)}>Hủy</button>
        </form>
      )}
    </div>
  );
}

function HoldBanner({ expires }) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expires) - new Date()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(
      () =>
        setLeft(
          Math.max(0, Math.floor((new Date(expires) - new Date()) / 1000)),
        ),
      1000,
    );
    return () => clearInterval(id);
  }, [expires]);
  return (
    <div className="state-banner warning">
      <b>
        Thanh toán trong {String(Math.floor(left / 60)).padStart(2, "0")}:
        {String(left % 60).padStart(2, "0")} để giữ phòng
      </b>
      <span>Phòng sẽ tự động được nhả khi hết thời gian giữ.</span>
    </div>
  );
}
function DetailCard({ title, action, children }) {
  return (
    <section className="detail-card">
      <div className="detail-card-head"><h2>{title}</h2>{action}</div>
      {children}
    </section>
  );
}
function Info({ label, value, sub }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value || "—"}</b>
      {sub && <span>{sub}</span>}
    </div>
  );
}
function Price({ l, v, total, green, due }) {
  return (
    <p
      className={`${total ? "price-total " : ""}${green ? "green " : ""}${due ? "due" : ""}`}
    >
      <span>{l}</span>
      <b>{money(v)}</b>
    </p>
  );
}
function Timeline({ status, cancelled, paid }) {
  if (cancelled)
    return (
      <div className="booking-timeline-vertical">
        <span className="done">
          <i />
          Đã đặt
        </span>
        <span className="cancelled">
          <i />
          Đã hủy
        </span>
      </div>
    );
  const steps = [
      ["Đã đặt", true],
      ["Đã thanh toán", paid],
      [
        "Đã xác nhận",
        [
          "Confirmed",
          "CheckedIn",
          "CheckoutPendingPayment",
          "Completed",
        ].includes(status),
      ],
      [
        "Đã nhận phòng",
        ["CheckedIn", "CheckoutPendingPayment", "Completed"].includes(status),
      ],
      ["Hoàn thành", status === "Completed"],
    ],
    last = Math.max(0, steps.map((x) => x[1]).lastIndexOf(true));
  return (
    <div className="booking-timeline-vertical">
      {steps.map(([x, done], i) => (
        <span
          key={x}
          className={`${done ? "done " : ""}${i === last ? "current" : ""}`}
        >
          <i />
          {x}
        </span>
      ))}
    </div>
  );
}

function CancelDialog({ item, close, reload }) {
  const ref = useDialog(close),
    [quote, setQuote] = useState(null),
    [reason, setReason] = useState(""),
    [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    bookingApi
      .cancellationQuote(item.id)
      .then(setQuote)
      .catch((e) => setError(e.message));
  }, [item.id]);
  const reasons = [
      "Thay đổi kế hoạch",
      "Tìm được chỗ ở khác",
      "Giá cao hơn dự tính",
      "Lý do cá nhân",
      "Khác",
    ],
    submit = async () => {
      if (!reason || busy) return;
      setBusy(true);
      try {
        await bookingApi.cancel(
          item.id,
          reason === "Khác" ? note.trim() || reason : reason,
        );
        toast.success("Đã hủy đơn. Chúng tôi đã báo cho chủ nhà.");
        close();
        reload();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
    refund = quote?.refundAmount ?? 0,
    free = Number(quote?.cancellationFee || 0) === 0;
  return (
    <div
      className="customer-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={ref}
        className="customer-action-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Hủy đơn ${item.bookingCode}`}
      >
        <button className="modal-x" onClick={close} aria-label="Đóng">
          ×
        </button>
        <small>YÊU CẦU HỦY</small>
        <h2>Hủy đơn {item.bookingCode}</h2>
        <p>
          {item.homestayName} · {date(item.checkInDate)} →{" "}
          {date(item.checkOutDate)} · {item.nights || "—"} đêm
        </p>
        {quote ? (
          <>
            <div className="cancel-quote">
              <Price l="Đã thanh toán" v={quote.paidAmount ?? paidOf(item)} />
              <Price l="Phí hủy theo chính sách" v={quote.cancellationFee} />
              <Price l="Số tiền được hoàn" v={refund} total green />
            </div>
            <div className={`cancel-policy ${free ? "free" : "fee"}`}>
              <b>
                {free ? "Bạn được hủy miễn phí" : "Đơn đã qua hạn hủy miễn phí"}
              </b>
              <span>{quote.policy}</span>
              {refund > 0 && (
                <span>Tiền hoàn về tài khoản trong 3 đến 5 ngày làm việc.</span>
              )}
            </div>
          </>
        ) : (
          !error && <div className="modal-skeleton" />
        )}
        <fieldset>
          <legend>Lý do hủy</legend>
          {reasons.map((x) => (
            <label key={x}>
              <input
                type="radio"
                name="cancel-reason"
                value={x}
                checked={reason === x}
                onChange={() => setReason(x)}
              />
              <span>{x}</span>
            </label>
          ))}
        </fieldset>
        {reason === "Khác" && (
          <label>
            Ghi chú
            <textarea
              autoFocus
              maxLength="500"
              rows="3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Cho chúng tôi biết lý do của bạn"
            />
          </label>
        )}
        {error && (
          <p className="modal-error" role="alert">
            ⚠ {error}
          </p>
        )}
        <footer>
          <button onClick={close}>Giữ đơn</button>
          <button
            className="danger"
            disabled={
              !quote || !reason || busy || (reason === "Khác" && !note.trim())
            }
            onClick={submit}
          >
            {busy ? "Đang hủy..." : "Xác nhận hủy"}
          </button>
        </footer>
      </section>
    </div>
  );
}
function ReviewDialog({ data, close, reload }) {
  const ref = useDialog(close),
    old = data.existing,
    [rating, setRating] = useState(old?.rating || 5),
    [comment, setComment] = useState(old?.comment || ""),
    [criteria, setCriteria] = useState({
      cleanlinessRating: old?.cleanlinessRating || 5,
      locationRating: old?.locationRating || 5,
      hostRating: old?.hostRating || 5,
      valueRating: old?.valueRating || 5,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = {
          bookingId: data.booking.id,
          rating,
          comment,
          ...criteria,
        },
        r = old
          ? await bookingApi.updateReview(old.id, payload)
          : await bookingApi.createReview(payload);
      toast.success(r.message);
      close();
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="customer-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <section
        ref={ref}
        className="review-dialog"
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-x" onClick={close} aria-label="Đóng">
          ×
        </button>
        <small>CHIA SẺ TRẢI NGHIỆM</small>
        <h2>{data.booking.homestayName}</h2>
        <div className="rating-picker">
          {[1, 2, 3, 4, 5].map((x) => (
            <button
              aria-label={`${x} sao`}
              key={x}
              onClick={() => setRating(x)}
            >
              {x <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        <label>
          Nhận xét <span>{comment.length}/1000</span>
          <textarea
            maxLength="1000"
            rows="5"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <div className="criteria-grid">
          {[
            ["cleanlinessRating", "Sạch sẽ"],
            ["locationRating", "Vị trí"],
            ["hostRating", "Chủ nhà"],
            ["valueRating", "Giá trị"],
          ].map(([k, v]) => (
            <label key={k}>
              {v}
              <select
                value={criteria[k]}
                onChange={(e) =>
                  setCriteria({ ...criteria, [k]: +e.target.value })
                }
              >
                {[5, 4, 3, 2, 1].map((x) => (
                  <option key={x} value={x}>
                    {x} sao
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {error && <p className="modal-error">⚠ {error}</p>}
        <footer>
          <button onClick={close}>Hủy</button>
          <button disabled={busy} className="primary" onClick={save}>
            {busy ? "Đang lưu…" : old ? "Cập nhật đánh giá" : "Gửi đánh giá"}
          </button>
        </footer>
      </section>
    </div>
  );
}
