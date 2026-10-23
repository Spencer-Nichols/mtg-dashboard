-- wishlist_atl_notifications shipped in 0018 without RLS or explicit grants, which
-- left it readable by anyone via the anon key (confirmed live, fixing immediately).
-- Written only by the cron via the service-role client, so users only need SELECT
-- on their own rows.

ALTER TABLE wishlist_atl_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wishlist ATL notifications"
  ON wishlist_atl_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT
  ON public.wishlist_atl_notifications
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.wishlist_atl_notifications
  TO service_role;
