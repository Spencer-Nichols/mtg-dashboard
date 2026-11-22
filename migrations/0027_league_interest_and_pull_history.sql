-- League: players flag other players' cards they want ("interested"), and a price history for pulled cards.
-- Interest rows are only read by the server, so no read policy: the owner and the marker see them through the app.

CREATE TABLE league_interests (
  season_id uuid NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  id text NOT NULL,
  member_id text NOT NULL,
  owner_id text NOT NULL,
  card_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY (season_id, id)
);

ALTER TABLE league_interests ENABLE ROW LEVEL SECURITY;

-- One row per printing per price refresh. date uses the same 'YYYY-MM-DDTHH' buckets as the wishlist history.
CREATE TABLE league_card_history (
  card_key text NOT NULL,
  date text NOT NULL,
  price numeric,
  foil_price numeric,
  PRIMARY KEY (card_key, date)
);

ALTER TABLE league_card_history ENABLE ROW LEVEL SECURITY;
