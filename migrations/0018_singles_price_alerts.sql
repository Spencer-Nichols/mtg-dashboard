-- Price alerts for wishlist singles, mirroring the sealed_wishlist / sealed_atl_notifications setup

ALTER TABLE wishlist_singles
  ADD COLUMN target_price numeric;

ALTER TABLE notification_preferences
  ADD COLUMN email_singles_alerts boolean NOT NULL DEFAULT false;

CREATE TABLE wishlist_atl_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_name text NOT NULL,
  notified_price numeric NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  is_atl boolean NOT NULL DEFAULT false
);

CREATE INDEX wishlist_atl_notifications_card_name_idx ON wishlist_atl_notifications (card_name);
CREATE INDEX wishlist_atl_notifications_user_id_idx ON wishlist_atl_notifications (user_id);
