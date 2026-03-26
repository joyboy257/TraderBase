"use client";

import { useRef, useEffect } from "react";
import { Swiper } from "swiper";
import { Autoplay, FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatPercent, formatCompactNumber } from "@/lib/utils";

const traders = [
  {
    username: "sirjack",
    displayName: "Sir Jack",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop",
    return30d: 42.5,
    followers: 12400,
    isVerified: true,
    specialty: "Momentum",
  },
  {
    username: "diamondhands",
    displayName: "Diamond Hands",
    avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop",
    return30d: 28.3,
    followers: 8900,
    isVerified: true,
    specialty: "Long-term",
  },
  {
    username: "thequant",
    displayName: "The Quant",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    return30d: 35.1,
    followers: 15600,
    isVerified: true,
    specialty: "Algorithmic",
  },
  {
    username: "valuehunter",
    displayName: "Value Hunter",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    return30d: 18.7,
    followers: 6200,
    isVerified: true,
    specialty: "Value",
  },
  {
    username: "optionsking",
    displayName: "Options King",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    return30d: 67.2,
    followers: 22100,
    isVerified: true,
    specialty: "Options",
  },
  {
    username: "divhunter",
    displayName: "Div Hunter",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    return30d: 12.4,
    followers: 4800,
    isVerified: true,
    specialty: "Dividends",
  },
];

export function FeaturedTraders() {
  const swiperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!swiperRef.current) return;

    const swiper = new Swiper(swiperRef.current, {
      modules: [Autoplay, FreeMode],
      slidesPerView: 1.15,
      spaceBetween: 16,
      autoplay: { delay: 3000, disableOnInteraction: false },
      freeMode: { enabled: true, sticky: true },
      breakpoints: {
        640: { slidesPerView: 2.15 },
        1024: { slidesPerView: 3.15 },
        1280: { slidesPerView: 4.15 },
      },
    });

    return () => swiper.destroy(true, true);
  }, []);

  return (
    <section id="traders" className="py-24 px-4 bg-[var(--color-bg-secondary)]">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <span className="text-xs font-semibold tracking-widest uppercase text-[var(--color-accent-purple)] mb-4 block">
              Top Traders
            </span>
            <h2 className="font-display text-4xl md:text-5xl text-[var(--color-text-primary)]">
              Follow the best
            </h2>
          </div>
          <a
            href="/traders"
            className="hidden md:inline-flex items-center gap-2 text-sm text-[var(--color-accent-purple)] hover:underline"
          >
            View all traders
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        <div ref={swiperRef} className="swiper">
          <div className="swiper-wrapper">
            {traders.map((trader) => (
              <div key={trader.username} className="swiper-slide">
                <div className="p-6 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl hover:border-[var(--color-accent-purple)] transition-colors cursor-pointer group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={trader.avatar}
                        alt={trader.displayName}
                        size="lg"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {trader.displayName}
                          </span>
                          {trader.isVerified && (
                            <Badge variant="verified">Verified</Badge>
                          )}
                        </div>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          @{trader.username}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]">
                      {trader.specialty}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                        30D Return
                      </span>
                      <span
                        className={`font-data font-semibold text-lg ${
                          trader.return30d >= 0
                            ? "text-[var(--color-accent-green)]"
                            : "text-[var(--color-sell)]"
                        }`}
                      >
                        {formatPercent(trader.return30d)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                        Followers
                      </span>
                      <span className="font-data font-semibold text-lg text-[var(--color-text-primary)]">
                        {formatCompactNumber(trader.followers)}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full group-hover:border-[var(--color-accent-purple)] group-hover:text-[var(--color-accent-purple)]"
                    size="sm"
                  >
                    Copy Trade
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
