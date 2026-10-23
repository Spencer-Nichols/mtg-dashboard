-- Deck Ideas: pasted Moxfield lists priced from Scryfall.
-- Totals cover every card in the list; binder ownership is computed at read time, not stored.
-- deck_idea_history is written only by the refresh-prices cron via the service-role client (one row per deck per day).

CREATE TABLE deck_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_identity text,
  source_url text,
  cheapest_total numeric,
  exact_total numeric,
  unpriced_count integer NOT NULL DEFAULT 0,
  priced_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deck_ideas_user_id_idx ON deck_ideas (user_id);

CREATE TABLE deck_idea_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES deck_ideas(id) ON DELETE CASCADE,
  board text NOT NULL DEFAULT 'main' CHECK (board IN ('commander', 'main', 'sideboard')),
  qty integer NOT NULL CHECK (qty > 0),
  name text NOT NULL,
  set_code text,
  collector_number text,
  foil_type text NOT NULL DEFAULT 'none' CHECK (foil_type IN ('none', 'foil', 'etched')),
  scryfall_id uuid,
  type_line text,
  image_url text,
  exact_price numeric,
  cheapest_scryfall_id uuid,
  cheapest_set_code text,
  cheapest_collector_number text,
  cheapest_foil_type text CHECK (cheapest_foil_type IN ('none', 'foil', 'etched')),
  cheapest_price numeric,
  cheapest_checked_at timestamptz,
  UNIQUE NULLS NOT DISTINCT (deck_id, board, name, set_code, collector_number, foil_type)
);

CREATE INDEX deck_idea_cards_deck_id_idx ON deck_idea_cards (deck_id);

CREATE TABLE deck_idea_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES deck_ideas(id) ON DELETE CASCADE,
  date date NOT NULL,
  cheapest_total numeric,
  exact_total numeric,
  UNIQUE (deck_id, date)
);

ALTER TABLE deck_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_idea_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_idea_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own deck ideas"
  ON deck_ideas
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage cards in their own deck ideas"
  ON deck_idea_cards
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM deck_ideas d WHERE d.id = deck_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM deck_ideas d WHERE d.id = deck_id AND d.user_id = auth.uid()));

CREATE POLICY "Users can view history for their own deck ideas"
  ON deck_idea_history
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM deck_ideas d WHERE d.id = deck_id AND d.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_ideas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_idea_cards TO authenticated;
GRANT SELECT ON public.deck_idea_history TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_ideas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_idea_cards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deck_idea_history TO service_role;
