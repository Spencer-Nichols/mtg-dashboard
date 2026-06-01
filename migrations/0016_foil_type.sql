-- Migration: replace foil boolean with foil_type enum
-- Run AFTER deploying the new code

ALTER TABLE binder_cards ADD COLUMN foil_type text NOT NULL DEFAULT 'none';

UPDATE binder_cards SET foil_type = CASE WHEN foil = true THEN 'foil' ELSE 'none' END;

ALTER TABLE binder_cards DROP COLUMN foil;
