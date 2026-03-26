# TraderBase

> Social copy trading platform. Follow verified traders, copy their positions, build wealth together.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-3FT-green?style=flat-square&logo=supabase)

---

## Features

- **📊 Signals** — Real-time trade alerts from verified traders. BUY/SELL badges, entry prices, stop losses, take profits.
- **💬 Chat Rooms** — Live ticker-based discussion rooms. Real-time messaging powered by Supabase.
- **👥 Trader Profiles** — Public profiles with return stats, follower counts, and signal history.
- **📈 Copy Trading** — Follow traders, set your copy ratio and max position size.
- **🛡️ Verified Positions** — Brokerage-linked accounts prove every position — no fake screenshots.
- **🌙 Dark Theme** — Neon green + purple accent aesthetic, GSAP animations, Swiper carousels.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + CSS Variables |
| Animations | GSAP + ScrollTrigger |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (Magic Links + OAuth) |
| Real-time | Supabase Realtime (Signals + Chat) |
| Brokerage | Plaid (1,000+ brokerages) |
| Market Data | Polygon.io |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase account
- Plaid account (for brokerage linking)
- Polygon.io account (for market data)

### Installation

```bash
# Clone the repository
git clone https://github.com/joyboy257/TraderBase.git
cd TraderBase

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials
```

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Plaid (for brokerage linking)
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox

# Polygon.io (for market data)
POLYGON_API_KEY=your_polygon_api_key

# Resend (for transactional email)
RESEND_API_KEY=your_resend_api_key
```

### Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the schema from `supabase/schema.sql`
3. Enable **Realtime** for the `signals` and `chat_messages` tables

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup, OAuth callback
│   ├── (marketing)/          # Landing page
│   ├── (app)/                # Authenticated app shell
│   │   ├── dashboard/
│   │   ├── feed/
│   │   ├── signals/
│   │   ├── traders/
│   │   ├── chat/
│   │   ├── portfolio/
│   │   └── settings/
│   └── api/                  # API routes (webhooks, etc.)
├── components/
│   ├── ui/                   # Design system primitives
│   ├── landing/              # Landing page components
│   ├── feed/
│   ├── signals/
│   ├── chat/
│   └── traders/
├── lib/
│   ├── supabase/             # Supabase client helpers
│   ├── plaid/                # Plaid integration
│   └── polygon/              # Polygon.io integration
├── hooks/                    # Custom React hooks
├── styles/                   # globals.css + design tokens
└── types/                    # TypeScript types
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, GSAP animations, trader carousel |
| `/login` | Email magic link or Google OAuth login |
| `/signup` | Create account with email or Google OAuth |
| `/dashboard` | Portfolio overview, active signals, followed traders |
| `/feed` | Mixed content feed from traders you follow |
| `/signals` | Full signals table with filters |
| `/traders` | Discover and follow verified traders |
| `/traders/[username]` | Trader profile with stats and signal history |
| `/chat` | Ticker chat room directory |
| `/chat/[ticker]` | Live chat room for a specific ticker |
| `/portfolio` | Your holdings with P&L tracking |
| `/settings` | Profile, brokerage links, copy trading preferences |

---

## Design System

**Colors:**
- Background: `#0a0a0f` (deep dark), `#12121a` (surface), `#1a1a25` (elevated)
- Accent Green: `#32ff48` (BUY, CTAs, positive P&L)
- Accent Purple: `#6F2BFF` (Following, links, accents)
- SELL: `#ff4757`

**Typography:**
- Display: Instrument Serif
- Body: DM Sans
- Data/Prices: JetBrains Mono

---

## Deployment

### Vercel (Recommended)

```bash
npm run build
vercel deploy
```

Set your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## TODO

- [ ] Plaid brokerage linking flow
- [ ] Automatic copy trading execution
- [ ] Polygon.io WebSocket price feed
- [ ] Push notifications (email digest only for now)
- [ ] Mobile responsive polish
- [ ] Performance analytics dashboard

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## License

MIT
