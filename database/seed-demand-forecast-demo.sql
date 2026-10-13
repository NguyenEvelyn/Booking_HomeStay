-- Synthetic booking history for the demand-forecasting module.
--
-- This data is for demonstrations and academic evaluation only. Every generated
-- row is identifiable by the DFDEMO- booking-code prefix and the [SYNTHETIC]
-- customer note. Do not present it as real customer activity.
--
-- Requirements:
--   * PostgreSQL / Neon schema from current-schema.sql
--   * At least one Approved homestay with one Active room type
--
-- The script is idempotent: rerunning it does not duplicate bookings.

BEGIN;

INSERT INTO users (
    full_name, email, password_hash, role, status,
    email_verified_at, created_at, updated_at
)
VALUES (
    'Demand Forecast Demo Customer',
    'demand.forecast.demo@tripio.invalid',
    NULL,
    'Customer',
    'Active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;

-- Generate 24 complete months. Monthly volume contains:
--   * a small upward trend;
--   * a summer peak (May-August);
--   * a smaller year-end peak (November-December).
-- This creates enough observations for the model threshold and backtest without
-- inserting fake recommendation events, reviews, invoices, or payments.
WITH RECURSIVE
eligible_types AS (
    SELECT
        h.homestay_id,
        rt.room_type_id,
        rt.base_price,
        row_number() OVER (ORDER BY h.province, h.homestay_id, rt.room_type_id) AS ordinal
    FROM homestays h
    JOIN LATERAL (
        SELECT candidate.room_type_id, candidate.base_price
        FROM room_types candidate
        WHERE candidate.homestay_id = h.homestay_id
          AND candidate.status = 'Active'
        ORDER BY candidate.room_type_id
        LIMIT 1
    ) rt ON TRUE
    WHERE h.status = 'Approved'
),
type_count AS (
    SELECT count(*)::integer AS value FROM eligible_types
),
months AS (
    SELECT
        generate_series(0, 23) AS month_index,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '24 months'
            + generate_series(0, 23) * INTERVAL '1 month')::date AS month_start
),
month_targets AS (
    SELECT
        month_index,
        month_start,
        (8
         + floor(month_index / 6.0)::integer
         + CASE
             WHEN extract(month FROM month_start) BETWEEN 5 AND 8 THEN 8
             WHEN extract(month FROM month_start) IN (11, 12) THEN 4
             ELSE 0
           END) AS booking_count
    FROM months
),
seed_plan AS (
    SELECT
        target.month_index,
        target.month_start,
        item AS item_index,
        ('DFDEMO-' || to_char(target.month_start, 'YYYYMM') || '-'
            || lpad(item::text, 3, '0'))::varchar(30) AS booking_code,
        target.month_start + (2 + ((item * 3 + target.month_index) % 21))::integer AS check_in_date,
        1 + ((item + target.month_index) % 3) AS nights,
        types.homestay_id,
        types.room_type_id,
        types.base_price
    FROM month_targets target
    CROSS JOIN type_count total
    CROSS JOIN LATERAL generate_series(1, target.booking_count) item
    JOIN eligible_types types
      ON types.ordinal = 1 + ((item + target.month_index - 2) % total.value)
    WHERE total.value > 0
),
demo_customer AS (
    SELECT user_id
    FROM users
    WHERE email = 'demand.forecast.demo@tripio.invalid'
)
INSERT INTO bookings (
    booking_code, customer_id, homestay_id, check_in_date, check_out_date,
    adult_count, child_count, subtotal, discount_amount, service_fee, tax_amount,
    total_amount, room_amount, deposit_amount, payment_status,
    pricing_snapshot, policy_snapshot, review_create_until, review_edit_until,
    commission_rate, status, customer_note, created_at, updated_at
)
SELECT
    plan.booking_code,
    customer.user_id,
    plan.homestay_id,
    plan.check_in_date,
    plan.check_in_date + plan.nights,
    1 + (plan.item_index % 3),
    CASE WHEN plan.item_index % 4 = 0 THEN 1 ELSE 0 END,
    plan.base_price * plan.nights,
    0,
    0,
    0,
    plan.base_price * plan.nights,
    plan.base_price * plan.nights,
    round(plan.base_price * plan.nights * 0.3, 2),
    'Paid',
    jsonb_build_object('source', 'synthetic-demand-forecast-demo', 'version', 1),
    jsonb_build_object('source', 'synthetic-demand-forecast-demo'),
    plan.check_in_date + plan.nights + 30,
    plan.check_in_date + plan.nights + 37,
    0.1,
    'CheckedOut',
    '[SYNTHETIC] Dữ liệu mô phỏng cho đồ án dự báo nhu cầu',
    (plan.check_in_date - 14)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh',
    (plan.check_in_date + plan.nights)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM seed_plan plan
CROSS JOIN demo_customer customer
ON CONFLICT (booking_code) DO NOTHING;

WITH
eligible_types AS (
    SELECT
        h.homestay_id,
        rt.room_type_id,
        rt.base_price,
        row_number() OVER (ORDER BY h.province, h.homestay_id, rt.room_type_id) AS ordinal
    FROM homestays h
    JOIN LATERAL (
        SELECT candidate.room_type_id, candidate.base_price
        FROM room_types candidate
        WHERE candidate.homestay_id = h.homestay_id
          AND candidate.status = 'Active'
        ORDER BY candidate.room_type_id
        LIMIT 1
    ) rt ON TRUE
    WHERE h.status = 'Approved'
),
type_count AS (
    SELECT count(*)::integer AS value FROM eligible_types
),
months AS (
    SELECT
        generate_series(0, 23) AS month_index,
        (date_trunc('month', CURRENT_DATE) - INTERVAL '24 months'
            + generate_series(0, 23) * INTERVAL '1 month')::date AS month_start
),
month_targets AS (
    SELECT
        month_index,
        month_start,
        (8
         + floor(month_index / 6.0)::integer
         + CASE
             WHEN extract(month FROM month_start) BETWEEN 5 AND 8 THEN 8
             WHEN extract(month FROM month_start) IN (11, 12) THEN 4
             ELSE 0
           END) AS booking_count
    FROM months
),
seed_plan AS (
    SELECT
        target.month_index,
        item AS item_index,
        ('DFDEMO-' || to_char(target.month_start, 'YYYYMM') || '-'
            || lpad(item::text, 3, '0'))::varchar(30) AS booking_code,
        1 + ((item + target.month_index) % 3) AS nights,
        types.room_type_id,
        types.base_price
    FROM month_targets target
    CROSS JOIN type_count total
    CROSS JOIN LATERAL generate_series(1, target.booking_count) item
    JOIN eligible_types types
      ON types.ordinal = 1 + ((item + target.month_index - 2) % total.value)
    WHERE total.value > 0
)
INSERT INTO booking_details (
    booking_id, room_type_id, room_id, quantity, price_per_night,
    number_of_nights, extra_fee, line_total, guest_name, note
)
SELECT
    booking.booking_id,
    plan.room_type_id,
    NULL,
    1,
    plan.base_price,
    plan.nights,
    0,
    plan.base_price * plan.nights,
    'Khách mô phỏng',
    '[SYNTHETIC] Demand forecast demo'
FROM seed_plan plan
JOIN bookings booking ON booking.booking_code = plan.booking_code
WHERE NOT EXISTS (
    SELECT 1 FROM booking_details detail WHERE detail.booking_id = booking.booking_id
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code LIKE 'DFDEMO-%') THEN
        RAISE EXCEPTION 'Không tạo được dữ liệu: cần ít nhất một homestay Approved có room type Active.';
    END IF;
END $$;

COMMIT;

-- Verification query: the forecast should see 24 months and more than 20 bookings.
SELECT
    date_trunc('month', check_in_date)::date AS month,
    count(*) AS bookings,
    sum(detail.quantity * detail.number_of_nights) AS room_nights,
    sum(booking.total_amount) AS revenue
FROM bookings booking
JOIN booking_details detail ON detail.booking_id = booking.booking_id
WHERE booking.booking_code LIKE 'DFDEMO-%'
GROUP BY 1
ORDER BY 1;

-- Optional cleanup (run manually when demo data is no longer needed):
-- DELETE FROM bookings WHERE booking_code LIKE 'DFDEMO-%';
-- DELETE FROM users
-- WHERE email = 'demand.forecast.demo@tripio.invalid'
--   AND NOT EXISTS (SELECT 1 FROM bookings WHERE customer_id = users.user_id);
