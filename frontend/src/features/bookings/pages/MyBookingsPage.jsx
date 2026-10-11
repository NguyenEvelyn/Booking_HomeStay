import React, { useEffect, useMemo, useRef, useState } from "react";
import CustomerNav from "../../../shared/components/CustomerNav.jsx";
import { toast } from "../../../shared/feedback/feedback.js";
import { bookingApi } from "../api/bookingApi.js";
import "./MyBookingsEnhancements.css";

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
  onAccount,
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
    [query, setQuery] = useState(""),
    [detailLoading, setDetailLoading] = useState(false);
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
                rebook={onHomestays}
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
          rebook={onHomestays}
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
function BookingCard({ item, detail, pay, cancel, review, rebook }) {
  const status = uiStatus(item.status),
    days = daysUntil(item.checkInDate),
    action = (e) => {
      e.stopPropagation();
      if (["PendingPayment", "PaymentFailed"].includes(status)) pay();
      else if (status === "Completed") review();
      else if (groups.cancelled.includes(status)) rebook();
      else detail();
    },
    text = ["PendingPayment", "PaymentFailed"].includes(status)
      ? "Thanh toán ngay"
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
              ["PendingPayment", "PaymentFailed", "CheckedIn"].includes(status)
                ? "primary"
                : ""
            }
            onClick={action}
          >
            {text}
          </button>
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
        </aside>
      </div>
    </article>
  );
}

function BookingDetail({ data, close, cancel, pay, review, rebook }) {
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
            {groups.cancelled.includes(status) && (
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
