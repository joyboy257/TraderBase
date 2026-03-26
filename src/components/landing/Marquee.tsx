"use client";

export function Marquee() {
  const items = [
    { label: "200K+ Traders", icon: "👥" },
    { label: "$400M Daily Volume", icon: "💰" },
    { label: "1,000+ Brokerages", icon: "🏦" },
    { label: "Real-Time Signals", icon: "⚡" },
    { label: "Verified Positions", icon: "✓" },
    { label: "Zero Fake Screenshots", icon: "🚫" },
    { label: "Free Forever", icon: "💚" },
  ];

  const doubled = [...items, ...items];

  return (
    <section className="py-8 border-y border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 px-8 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            <span>{item.icon}</span>
            <span className="font-semibold">{item.label}</span>
            <span className="w-1 h-1 rounded-full bg-[var(--color-accent-green)]" />
          </span>
        ))}
      </div>
    </section>
  );
}
