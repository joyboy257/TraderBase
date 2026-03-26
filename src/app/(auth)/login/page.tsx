"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/callback` },
    });
    setLoading(false);
    if (!error) setSent(true);
  };

  const handleOAuth = async (provider: "google") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-green)] flex items-center justify-center">
              <span className="text-[var(--color-text-inverse)] font-bold font-data">AH</span>
            </div>
            <span className="font-display text-2xl text-[var(--color-text-primary)]">AfterHours</span>
          </Link>
        </div>

        <div className="p-8 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-2xl">
          {!sent ? (
            <>
              <h1 className="font-display text-2xl text-[var(--color-text-primary)] text-center mb-2">
                Welcome back
              </h1>
              <p className="text-[var(--color-text-secondary)] text-center mb-8">
                Sign in to your account to continue
              </p>

              {/* Magic link form */}
              <form onSubmit={handleMagicLink} className="space-y-4 mb-6">
                <Input
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Sending..." : "Send Magic Link"}
                </Button>
              </form>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--color-border-subtle)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-[var(--color-bg-surface)] text-xs text-[var(--color-text-muted)]">
                    or continue with
                  </span>
                </div>
              </div>

              {/* OAuth buttons */}
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full"
                  size="lg"
                  onClick={() => handleOAuth("google")}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[var(--color-accent-green-glow)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[var(--color-accent-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-display text-2xl text-[var(--color-text-primary)] mb-2">Check your email</h2>
              <p className="text-[var(--color-text-secondary)]">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[var(--color-accent-purple)] hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </main>
  );
}
