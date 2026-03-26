import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BrokerageConnector } from "@/components/plaid/BrokerageConnector";
import { CheckCircle2, Trash2, Building2 } from "lucide-react";
import { SyncPositionsButton } from "@/components/plaid/SyncPositionsButton";

interface BrokerageConnection {
  id: string;
  brokerage_name: string;
  account_id: string | null;
  is_active: boolean;
  linked_at: string;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  // Fetch brokerage connections
  const { data: connections } = await supabase
    .from("brokerage_connections")
    .select("*")
    .eq("user_id", user!.id)
    .eq("is_active", true)
    .order("linked_at", { ascending: false });

  const typedConnections = (connections ?? []) as BrokerageConnection[];

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-text-primary)] tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Manage your profile and brokerage connections
        </p>
      </div>

      {/* Profile Section */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
          Profile
        </h2>
        <Card className="p-5">
          <div className="flex items-start gap-5 mb-6">
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.display_name ?? "User"}
              size="xl"
              className="w-16 h-16"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-0.5">
                {profile?.display_name ?? "Your Name"}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-3">
                @{profile?.username ?? "username"}
              </p>
              <Button variant="secondary" size="sm">
                Change Avatar
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                Display Name
              </label>
              <input
                type="text"
                defaultValue={profile?.display_name ?? ""}
                className="w-full h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)] text-sm"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                Username
              </label>
              <input
                type="text"
                defaultValue={profile?.username ?? ""}
                className="w-full h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)] text-sm"
                placeholder="username"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
                Bio
              </label>
              <textarea
                defaultValue={profile?.bio ?? ""}
                placeholder="Tell others about yourself..."
                rows={3}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)] resize-none text-sm leading-relaxed"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm">Save Profile</Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Brokerage Connections */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider text-[var(--color-text-muted)]">
            Brokerage Connections
          </h2>
          <BrokerageConnector />
        </div>

        <Card className="overflow-hidden">
          {typedConnections.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-3">
                <Building2 size={20} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                No brokerage connected
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-xs mx-auto">
                Link your brokerage to verify your trades and enable copy trading. We use Plaid to securely connect to your account — read-only access only.
              </p>
              <BrokerageConnector />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border-subtle)]">
              {typedConnections.map((conn) => (
                <div key={conn.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-[var(--color-accent-green-glow)] flex items-center justify-center">
                      <Building2 size={16} className="text-[var(--color-accent-green)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {conn.brokerage_name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Linked {new Date(conn.linked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="buy">
                      <CheckCircle2 size={10} />
                      Connected
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-[var(--color-text-muted)] hover:text-[var(--color-sell)]">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Sync positions */}
              <div className="px-5 py-3 bg-[var(--color-bg-surface)]">
                <SyncPositionsButton />
              </div>
            </div>
          )}
        </Card>

        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Your credentials are sent directly to Plaid — we never store your brokerage login. Read-only access only.
        </p>
      </section>

      {/* Copy Trading */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
          Copy Trading
        </h2>
        <Card className="p-5 space-y-5">
          <label className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Enable Copy Trading
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Automatically copy trades from traders you follow
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="mt-0.5 w-4 h-4 accent-[var(--color-accent-green)]"
            />
          </label>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">
              Default Copy Ratio
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="10"
                max="100"
                defaultValue="50"
                className="flex-1 accent-[var(--color-accent-green)]"
              />
              <span className="font-data text-sm text-[var(--color-text-primary)] w-12 text-right">
                50%
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
              Max Position Size
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-muted)]">$</span>
              <input
                type="number"
                defaultValue="500"
                className="w-32 h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-green)] text-sm font-data"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm">Save Copy Settings</Button>
          </div>
        </Card>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider text-[var(--color-text-muted)]">
          Notifications
        </h2>
        <Card className="p-5 space-y-4">
          {[
            { label: "Email Digest", desc: "Daily summary of signals from traders you follow" },
            { label: "Trade Alerts", desc: "Get notified when traders you follow make a trade" },
          ].map(({ label, desc }) => (
            <label key={label} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="mt-0.5 w-4 h-4 accent-[var(--color-accent-green)]"
              />
            </label>
          ))}
          <div className="flex justify-end">
            <Button size="sm">Save Preferences</Button>
          </div>
        </Card>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider text-[var(--color-sell)]">
          Danger Zone
        </h2>
        <Card className="p-5 border-[var(--color-sell)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Delete Account</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="danger" size="sm">
              Delete Account
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
