-- Migration: user_photos table for photo grid management
-- Run this in your Supabase SQL editor

-- Create user_photos table
CREATE TABLE IF NOT EXISTS public.user_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast sorting
CREATE INDEX IF NOT EXISTS idx_user_photos_user_id ON public.user_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_sort_order ON public.user_photos(user_id, sort_order);

-- RLS: users can only manage their own photos
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own photos" ON public.user_photos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own photos" ON public.user_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own photos" ON public.user_photos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos" ON public.user_photos
  FOR DELETE USING (auth.uid() = user_id);
