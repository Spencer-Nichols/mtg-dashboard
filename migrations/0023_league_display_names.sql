-- League cards keep the real card name (for prices and binder import) plus the printed Star Trek name to show.

ALTER TABLE league_cards ADD COLUMN display_name text;
