import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border-subtle)] flex flex-col z-40">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-[var(--color-border-subtle)]">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-green)] flex items-center justify-center">
              <span className="text-[var(--color-text-inverse)] font-bold font-data text-xs">AH</span>
            </div>
            <span className="font-display text-lg text-[var(--color-text-primary)]">AfterHours</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {[
            { href: "/dashboard", icon: "📊", label: "Dashboard" },
            { href: "/feed", icon: "📈", label: "Feed" },
            { href: "/signals", icon: "⚡", label: "Signals" },
            { href: "/chat", icon: "💬", label: "Chat" },
            { href: "/portfolio", icon: "💼", label: "Portfolio" },
            { href: "/traders", icon: "👥", label: "Traders" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <span>{item.icon}</span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-[var(--color-border-subtle)]">
          <Link
            href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors mb-2"
          >
            <span>⚙️</span>
            <span className="text-sm font-medium">Settings</span>
          </Link>

          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.display_name ?? "User"}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {profile?.display_name ?? "User"}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] truncate">
                @{profile?.username ?? "user"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64">{children}</main>
    </div>
  );
}
