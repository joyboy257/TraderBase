-- Create notifications table for user-facing alerts (e.g., brokerage deactivation)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- e.g., 'brokerage_deactivated'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert notifications (used by webhook handlers via service client)
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Index for unread count query
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, read) WHERE read = false;
