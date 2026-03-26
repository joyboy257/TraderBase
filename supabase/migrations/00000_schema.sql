-- Supabase migration: afterhours schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_trader BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brokerage connections via Plaid
CREATE TABLE public.brokerage_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  plaid_access_token_encrypted TEXT,
  plaid_item_id TEXT,
  brokerage_name TEXT,
  account_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  linked_at TIMESTAMPTZ DEFAULT NOW()
);

-- User follows (who copies whom)
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  copy_ratio DECIMAL(3,2) DEFAULT 0.5 CHECK (copy_ratio BETWEEN 0.01 AND 1.0),
  max_position_size DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, leader_id)
);

-- Trades (from brokerage or manual entry)
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  quantity DECIMAL(12,4) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total_value DECIMAL(12,2) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  signal_id UUID,
  is_copied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current positions (denormalized for performance)
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  brokerage_connection_id UUID REFERENCES public.brokerage_connections(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  quantity DECIMAL(12,4) NOT NULL,
  average_cost DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  unrealized_pnl DECIMAL(12,2),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- Signals (trade alerts from leaders)
CREATE TABLE public.signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
  entry_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  take_profit DECIMAL(10,2),
  rationale TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat rooms (one per ticker)
CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feed posts (curated due diligence, charts, etc.)
CREATE TABLE public.feed_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('dd', 'chart', 'position', 'signal')),
  ticker TEXT,
  title TEXT NOT NULL,
  content TEXT,
  image_urls TEXT[],
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trades_user_id ON public.trades(user_id);
CREATE INDEX idx_trades_ticker ON public.trades(ticker);
CREATE INDEX idx_trades_executed_at ON public.trades(executed_at DESC);
CREATE INDEX idx_positions_user_id ON public.positions(user_id);
CREATE INDEX idx_signals_user_id ON public.signals(user_id);
CREATE INDEX idx_signals_ticker ON public.signals(ticker);
CREATE INDEX idx_signals_is_active ON public.signals(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_signals_created_at ON public.signals(created_at DESC);
CREATE INDEX idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX idx_follows_leader_id ON public.follows(leader_id);
CREATE INDEX idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);
CREATE INDEX idx_feed_posts_ticker ON public.feed_posts(ticker);
CREATE INDEX idx_feed_posts_created_at ON public.feed_posts(created_at DESC);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokerage_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, own write
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Signals: public read, own write
CREATE POLICY "Signals are viewable by everyone" ON public.signals FOR SELECT USING (true);
CREATE POLICY "Users can insert own signals" ON public.signals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own signals" ON public.signals FOR UPDATE USING (auth.uid() = user_id);

-- Feed posts: public read, own write
CREATE POLICY "Posts are viewable by everyone" ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "Users can insert own posts" ON public.feed_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Follows: public read, own write
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Chat: public read, authenticated write
CREATE POLICY "Chat rooms are viewable by everyone" ON public.chat_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Messages are viewable by everyone" ON public.chat_messages FOR SELECT USING (true);

-- Likes: own only
CREATE POLICY "Users can manage own likes" ON public.likes FOR ALL USING (auth.uid() = user_id);

-- Comments: public read, own write
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for signals and chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
