"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/Button";
import { Marquee } from "./Marquee";
import { HowItWorks } from "./HowItWorks";
import { FeaturedTraders } from "./FeaturedTraders";
import { LiveActivity } from "./LiveActivity";
import { PhoneMockup } from "./PhoneMockup";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const heroRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const tickersRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero timeline
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      // Gradient background slow rotation with fade-in
      const heroGradient = document.querySelector(".hero-gradient");
      if (heroGradient) {
        gsap.fromTo(
          heroGradient,
          { opacity: 0, backgroundPosition: "0% 0%" },
          {
            opacity: 0.3,
            backgroundPosition: "200% 200%",
            duration: 1.5,
            ease: "power2.out",
          }
        );
        gsap.to(heroGradient, {
          backgroundPosition: "200% 200%",
          duration: 20,
          repeat: -1,
          ease: "none",
        });
      }

      // Headline split text reveal
      if (headlineRef.current) {
        const words = headlineRef.current.querySelectorAll(".word");
        tl.fromTo(
          words,
          { opacity: 0, y: 40, rotateX: -20 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            stagger: 0.1,
          }
        );
      }

      // Subheadline
      tl.fromTo(
        subheadRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.3"
      );

      // CTA buttons
      if (ctaRef.current?.children && ctaRef.current.children.length > 0) {
        tl.fromTo(
          ctaRef.current.children,
          { opacity: 0, y: 20, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1 },
          "-=0.3"
        );
      }

      // Floating tickers
      if (tickersRef.current) {
        const tickers = tickersRef.current.querySelectorAll(".ticker");
        gsap.fromTo(
          tickers,
          { opacity: 0, x: (i) => (i % 2 === 0 ? -50 : 50) },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            stagger: 0.1,
            delay: 0.5,
            ease: "power2.out",
          }
        );
      }

      // Floating ticker animation
      const floatingTickers = gsap.utils.toArray<HTMLElement>(".floating-ticker");
      if (floatingTickers.length > 0) {
        floatingTickers.forEach((el) => {
          gsap.to(el, {
            y: -15,
            duration: 2 + Math.random() * 2,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: Math.random() * 2,
          });
        });
      }

      // Phone mockup rise
      if (phoneRef.current) {
        gsap.fromTo(
          phoneRef.current,
          { opacity: 0, y: 60, rotateY: -10 },
          {
            opacity: 1,
            y: 0,
            rotateY: 0,
            duration: 1,
            delay: 0.8,
            ease: "power3.out",
          }
        );
      }

      // ScrollTrigger for parallax
      if (phoneRef.current) {
        gsap.to(phoneRef.current, {
          y: -100,
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
      }

      // Stats counter animation
      gsap.utils.toArray<HTMLElement>(".stat-number").forEach((el) => {
        const target = parseInt(el.getAttribute("data-target") || "0", 10);
        gsap.fromTo(
          el,
          { innerText: 0 },
          {
            innerText: target,
            duration: 2,
            ease: "power2.out",
            snap: { innerText: 1 },
            scrollTrigger: {
              trigger: el,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <main className="min-h-screen bg-[var(--color-bg-base)]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[var(--color-bg-base)]/80 border-b border-[var(--color-border-subtle)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-green)] flex items-center justify-center">
              <span className="text-[var(--color-text-inverse)] font-bold font-data text-sm">AH</span>
            </div>
            <span className="font-display text-xl text-[var(--color-text-primary)]">AfterHours</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              How It Works
            </a>
            <a href="#traders" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              Traders
            </a>
            <a href="#activity" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
              Live Activity
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Sign Up Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16"
      >
        {/* Animated gradient background */}
        <div
          className="hero-gradient absolute inset-0 opacity-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(50,255,72,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(111,43,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(50,255,72,0.05) 0%, transparent 70%)",
            backgroundSize: "200% 200%",
            backgroundPosition: "0% 0%",
          }}
        />

        {/* Floating tickers */}
        <div
          ref={tickersRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
        >
          {["TSLA", "AAPL", "NVDA", "META", "AMZN", "GOOGL", "SPY", "QQQ"].map(
            (ticker, i) => (
              <div
                key={ticker}
                className={`floating-ticker absolute font-data text-sm font-semibold text-[var(--color-text-muted)] opacity-20 ${
                  i === 0
                    ? "top-[15%] left-[10%]"
                    : i === 1
                    ? "top-[25%] right-[15%]"
                    : i === 2
                    ? "top-[60%] left-[8%]"
                    : i === 3
                    ? "top-[70%] right-[12%]"
                    : i === 4
                    ? "top-[35%] left-[20%]"
                    : i === 5
                    ? "top-[50%] right-[8%]"
                    : i === 6
                    ? "bottom-[25%] left-[15%]"
                    : "bottom-[20%] right-[20%]"
                }`}
              >
                {ticker}
              </div>
            )
          )}
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] mb-8">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-green)] animate-pulse" />
            <span className="text-xs text-[var(--color-text-secondary)]">
              200,000+ traders sharing $400M in live trades daily
            </span>
          </div>

          {/* Headline */}
          <h1
            ref={headlineRef}
            className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.1] mb-6 perspective-[1000px]"
          >
            {["Follow", "the", "best", "traders.", "Win."]
              .map((word, i) => (
                <span
                  key={i}
                  className={`word inline-block mr-4 ${
                    word === "best" || word === "Win."
                      ? "text-[var(--color-accent-green)]"
                      : "text-[var(--color-text-primary)]"
                  }`}
                  style={{ opacity: 0 }}
                >
                  {word}
                </span>
              ))}
          </h1>

          {/* Subheadline */}
          <p
            ref={subheadRef}
            className="text-lg md:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ opacity: 0 }}
          >
            Join the community of winning investors. Copy their trades in
            real-time. Verified positions. Zero fake screenshots.
          </p>

          {/* CTAs */}
          <div
            ref={ctaRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            {[
              { label: "Start Copying Free", variant: "primary" as const },
              { label: "See How It Works", variant: "secondary" as const },
            ].map((btn) => (
              <Button key={btn.label} variant={btn.variant} size="lg">
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Phone mockup */}
          <div ref={phoneRef} className="relative mx-auto max-w-sm" style={{ opacity: 0 }}>
            <PhoneMockup />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">Scroll to explore</span>
          <div className="w-5 h-8 rounded-full border-2 border-[var(--color-border-default)] flex justify-center pt-1">
            <div className="w-1 h-2 rounded-full bg-[var(--color-accent-green)] animate-bounce" />
          </div>
        </div>
      </section>

      {/* Social Proof Marquee */}
      <Marquee />

      {/* How It Works */}
      <HowItWorks />

      {/* Featured Traders */}
      <FeaturedTraders />

      {/* Live Activity */}
      <LiveActivity />

      {/* CTA Section */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(50,255,72,0.2) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-5xl text-[var(--color-text-primary)] mb-6">
            Ready to up your trading game?
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] mb-8">
            Join 200,000+ traders sharing real-time signals. Free forever —
            no hidden fees, no commission traps.
          </p>
          <Link href="/signup">
            <Button size="lg" className="animate-pulse-glow">
              Create Your Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border-subtle)] py-12 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-green)] flex items-center justify-center">
              <span className="text-[var(--color-text-inverse)] font-bold font-data text-sm">AH</span>
            </div>
            <span className="font-display text-lg text-[var(--color-text-primary)]">AfterHours</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
            <span>© 2024 AfterHours</span>
            <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Terms</a>
            <a href="#" className="hover:text-[var(--color-text-primary)] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
