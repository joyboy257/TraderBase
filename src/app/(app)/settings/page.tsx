import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl text-[var(--color-text-primary)] mb-8">
        Settings
      </h1>

      {/* Profile section */}
      <section className="mb-8">
        <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">
          Profile
        </h2>
        <Card className="p-6">
          <div className="flex items-start gap-6 mb-6">
            <Avatar
              src={profile?.avatar_url}
              alt={profile?.display_name ?? "User"}
              size="xl"
              className="w-20 h-20"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">
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
            <Input
              label="Display Name"
              defaultValue={profile?.display_name ?? ""}
              placeholder="Your display name"
            />
            <Input
              label="Username"
              defaultValue={profile?.username ?? ""}
              placeholder="username"
            />
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
                Bio
              </label>
              <textarea
                defaultValue={profile?.bio ?? ""}
                placeholder="Tell others about yourself..."
                rows={3}
                className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)] resize-none"
              />
            </div>
            <Button>Save Changes</Button>
          </div>
        </Card>
      </section>

      {/* Brokerage section */}
      <section className="mb-8">
        <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">
          Brokerage Connections
        </h2>
        <Card className="p-6">
          <p className="text-[var(--color-text-secondary)] mb-4">
            Link your brokerage account to verify your trades and enable copy trading.
          </p>
          <Button variant="secondary">
            + Link Brokerage Account
          </Button>
        </Card>
      </section>

      {/* Copy Trading section */}
      <section className="mb-8">
        <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">
          Copy Trading
        </h2>
        <Card className="p-6 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[var(--color-text-primary)]">
                Enable Copy Trading
              </span>
              <p className="text-sm text-[var(--color-text-muted)]">
                Automatically copy trades from traders you follow
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-5 h-5 accent-[var(--color-accent-green)]"
            />
          </label>

          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
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
              <span className="font-data text-sm text-[var(--color-text-primary)] w-12">
                50%
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
              Max Position Size
            </label>
            <Input
              type="number"
              defaultValue="500"
              placeholder="500"
              className="w-48"
            />
          </div>

          <Button>Save Copy Settings</Button>
        </Card>
      </section>

      {/* Notifications */}
      <section className="mb-8">
        <h2 className="font-semibold text-[var(--color-text-primary)] mb-4">
          Notifications
        </h2>
        <Card className="p-6 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[var(--color-text-primary)]">
                Email Digest
              </span>
              <p className="text-sm text-[var(--color-text-muted)]">
                Daily summary of signals from traders you follow
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-5 h-5 accent-[var(--color-accent-green)]"
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[var(--color-text-primary)]">
                Trade Alerts
              </span>
              <p className="text-sm text-[var(--color-text-muted)]">
                Get notified when traders you follow make a trade
              </p>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-5 h-5 accent-[var(--color-accent-green)]"
            />
          </label>
          <Button>Save Preferences</Button>
        </Card>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="font-semibold text-[var(--color-sell)] mb-4">Danger Zone</h2>
        <Card className="p-6 border-[var(--color-sell)]">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-[var(--color-text-primary)]">
                Delete Account
              </span>
              <p className="text-sm text-[var(--color-text-muted)]">
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
