ALTER TABLE user_profiles ADD COLUMN whats_new_seen jsonb NOT NULL DEFAULT '{}'::jsonb;
