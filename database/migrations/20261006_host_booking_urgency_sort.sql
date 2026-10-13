-- Supports host booking urgency/status filtering through the existing
-- bookings.homestay_id -> homestays.host_id relationship.
CREATE INDEX IF NOT EXISTS ix_bookings_homestay_status_check_in
    ON bookings (homestay_id, status, check_in_date);

CREATE INDEX IF NOT EXISTS ix_bookings_homestay_check_out
    ON bookings (homestay_id, check_out_date);
