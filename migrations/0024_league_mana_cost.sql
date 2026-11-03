-- Mana cost shown in the trade modal. NULL means not looked up yet; '' means the card has no cost (lands).

ALTER TABLE league_cards ADD COLUMN mana_cost text;
