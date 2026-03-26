-- Add onboarding state columns to profiles
-- Enables first-visit wizard and post-wizard next-action banner
-- Defaults ensure existing rows are unaffected; new users start with onboarding incomplete

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_path TEXT CHECK (onboarding_path IN ('trader', 'copier')),
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER NOT NULL DEFAULT 0;

-- Index for fast lookup during onboarding check
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_complete
ON public.profiles(onboarding_complete)
WHERE onboarding_complete = FALSE;
