ALTER TABLE room_types
  ADD COLUMN IF NOT EXISTS extra_child_fee NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS child_max_age INTEGER NOT NULL DEFAULT 11;

ALTER TABLE room_types DROP CONSTRAINT IF EXISTS room_types_capacity_policy_check;
ALTER TABLE room_types ADD CONSTRAINT room_types_capacity_policy_check CHECK (
  base_capacity >= 1 AND max_capacity >= base_capacity
  AND extra_guest_fee >= 0 AND extra_child_fee >= 0
  AND child_max_age BETWEEN 0 AND 17
);

-- max_adults/max_children remain only for backward-compatible reads.
-- New booking decisions must use base_capacity/max_capacity.
