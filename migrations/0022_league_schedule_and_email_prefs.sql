-- League: next game date per season, and per-type league email preferences.
-- league_email_prefs holds { "<email type>": false } for types a user turned off; missing keys mean on.

ALTER TABLE league_seasons ADD COLUMN next_game_at timestamptz;
ALTER TABLE league_seasons ADD COLUMN next_game_note text;

ALTER TABLE notification_preferences ADD COLUMN league_email_prefs jsonb NOT NULL DEFAULT '{}';
