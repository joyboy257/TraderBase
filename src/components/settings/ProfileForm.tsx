"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { saveProfile } from "@/app/actions/settings";

interface ProfileFormProps {
  profile: {
    display_name: string | null;
    username: string | null;
    bio: string | null;
  } | null;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      setSuccess(false);
      const result = await saveProfile(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">
          Display Name
        </label>
        <input
          type="text"
          name="display_name"
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
          name="username"
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
          name="bio"
          defaultValue={profile?.bio ?? ""}
          placeholder="Tell others about yourself..."
          rows={3}
          className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)] resize-none text-sm leading-relaxed"
        />
      </div>
      {error && <p className="text-xs text-[var(--color-sell)]">{error}</p>}
      {success && <p className="text-xs text-[var(--color-accent-green)]">Profile saved!</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </form>
  );
}