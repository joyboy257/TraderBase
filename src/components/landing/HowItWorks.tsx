"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    number: "01",
    title: "Find Winning Traders",
    description:
      "Browse verified traders with proven track records. See their real positions, returns, and risk metrics — not cherry-picked screenshots.",
    image: "/step1.svg",
  },
  {
    number: "02",
    title: "Copy Their Trades",
    description:
      "Set your copy ratio and max position size. When they trade, your account automatically mirrors their moves in real-time.",
    image: "/step2.svg",
  },
  {
    number: "03",
    title: "Profit Together",
    description:
      "Track your portfolio performance. Follow multiple traders across different strategies. Build wealth with social proof on your side.",
    image: "/step3.svg",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".step-card").forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 60 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="py-24 px-4 bg-[var(--color-bg-base)]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold tracking-widest uppercase text-[var(--color-accent-green)] mb-4 block">
            How It Works
          </span>
          <h2 className="font-display text-4xl md:text-5xl text-[var(--color-text-primary)] mb-4">
            Three steps to better trades
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
            No complicated setups. No expensive subscriptions. Just proven
            traders and smart copying.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="step-card relative p-8 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-xl"
            >
              {/* Step number */}
              <span className="font-data text-6xl font-bold text-[var(--color-bg-elevated)] absolute -top-4 -left-2">
                {step.number}
              </span>

              {/* Glow accent */}
              <div
                className="absolute top-0 left-0 w-full h-1 rounded-t-xl"
                style={{
                  background:
                    "linear-gradient(90deg, var(--color-accent-green), var(--color-accent-purple))",
                }}
              />

              <div className="relative pt-8">
                <h3 className="font-display text-2xl text-[var(--color-text-primary)] mb-4">
                  {step.title}
                </h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
