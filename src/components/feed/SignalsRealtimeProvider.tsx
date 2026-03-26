"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface Signal {
  id: string;
  ticker: string;
  action: "BUY" | "SELL";
  entry_price: number | null;
  current_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  rationale: string | null;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
}

interface SignalsRealtimeProviderProps {
  initialSignals: Signal[];
  children: React.ReactNode;
}

export function SignalsRealtimeProvider({ initialSignals, children }: SignalsRealtimeProviderProps) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals);
  const seenIds = useRef<Set<string>>(new Set(initialSignals.map(s => s.id)));

  useEffect(() => {
    const supabase = createClient();
    const channel: RealtimeChannel = supabase.channel("signals-realtime");

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "signals" }, (payload) => {
      const newSignal = payload.new as Signal;
      if (newSignal.is_active && !seenIds.current.has(newSignal.id)) {
        seenIds.current.add(newSignal.id);
        setSignals(prev => {
          const next = [newSignal, ...prev];
          return next.slice(0, 50);
        });
      }
    });

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        channel.unsubscribe();
      } else {
        channel.subscribe();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    channel.subscribe();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      channel.unsubscribe();
    };
  }, []);

  return (
    <SignalsRealtimeContext.Provider value={signals}>
      {children}
    </SignalsRealtimeContext.Provider>
  );
}

import { createContext, useContext } from "react";

export const SignalsRealtimeContext = createContext<Signal[]>([]);

export function useSignalsRealtime() {
  return useContext(SignalsRealtimeContext);
}
