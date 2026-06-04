-- Change date column to text on both card history tables to support time-bucketed keys
-- Binder uses 12h buckets (e.g. "2026-06-04T12"), wishlist uses 4h buckets (e.g. "2026-06-04T08")
-- Existing date-only rows remain valid and sort correctly alongside new bucketed rows

ALTER TABLE binder_card_history
  DROP CONSTRAINT IF EXISTS binder_card_history_user_id_display_name_date_key,
  ALTER COLUMN date TYPE text USING date::text;

ALTER TABLE binder_card_history
  ADD CONSTRAINT binder_card_history_user_id_display_name_date_key UNIQUE (user_id, display_name, date);

ALTER TABLE wishlist_card_history
  DROP CONSTRAINT IF EXISTS wishlist_card_history_user_id_card_name_date_key,
  ALTER COLUMN date TYPE text USING date::text;

ALTER TABLE wishlist_card_history
  ADD CONSTRAINT wishlist_card_history_user_id_card_name_date_key UNIQUE (user_id, card_name, date);
