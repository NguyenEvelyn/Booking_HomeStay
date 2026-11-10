// The booking in progress, shared by the "dates & guests" and "guest details" screens. It lives in
// memory only: leaving the flow and coming back starts a fresh selection, as on the web.
let draft = null;

export function setBookingDraft(value) { draft = value; }
export function getBookingDraft() { return draft; }
export function clearBookingDraft() { draft = null; }

// Body shared by /bookings/quote and /bookings/vnpay, so both price exactly the same stay.
export function stayPayload(d) {
  return {
    roomTypeId: d.room.id,
    checkInDate: d.checkIn,
    checkOutDate: d.checkOut,
    adultCount: d.adults,
    childCount: d.tallChildren + d.smallChildren,
    tallChildren: d.tallChildren,
    smallChildren: d.smallChildren,
    quantity: d.quantity,
    paymentOption: d.paymentOption,
    customerNote: null,
    dayUseHours: null,
    voucherCode: null
  };
}
