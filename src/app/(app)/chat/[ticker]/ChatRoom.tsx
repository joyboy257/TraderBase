"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Message {
  id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export default function ChatRoom() {
  const params = useParams();
  const ticker = params.ticker as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data: rooms } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("ticker", ticker)
        .single();

      if (rooms) {
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("*, profiles:user_id(username, display_name, avatar_url)")
          .eq("room_id", rooms.id)
          .order("created_at", { ascending: true })
          .limit(100);

        if (msgs) setMessages(msgs);
      }
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${ticker}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=in.(SELECT id FROM chat_rooms WHERE ticker='${ticker}')`,
        },
        async (payload) => {
          const { data: msg } = await supabase
            .from("chat_messages")
            .select("*, profiles:user_id(username, display_name, avatar_url)")
            .eq("id", payload.new.id)
            .single();

          if (msg) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticker, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    setSending(true);
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("ticker", ticker)
      .single();

    let roomId = room?.id;

    // Create room if it doesn't exist
    if (!roomId) {
      const { data: newRoom } = await supabase
        .from("chat_rooms")
        .insert({ ticker })
        .select("id")
        .single();
      roomId = newRoom?.id;
    }

    if (roomId) {
      await supabase.from("chat_messages").insert({
        room_id: roomId,
        user_id: user.id,
        content: newMessage.trim(),
      });
    }

    setNewMessage("");
    setSending(false);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-4">
          <Link href="/chat" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-data font-bold text-xl text-[var(--color-text-primary)]">
                ${ticker}
              </span>
              <Badge variant="neutral">Chat</Badge>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              Live discussion
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <Avatar
              src={msg.profiles?.avatar_url}
              alt={msg.profiles?.display_name ?? msg.profiles?.username ?? "User"}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {msg.profiles?.display_name ?? msg.profiles?.username}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {timeAgo(msg.created_at)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] break-words">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message $${ticker}...`}
            className="flex-1 h-10 px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-green)]"
            disabled={!user || sending}
          />
          <Button type="submit" disabled={!newMessage.trim() || !user || sending}>
            Send
          </Button>
        </form>
        {!user && (
          <p className="text-xs text-center text-[var(--color-text-muted)] mt-2">
            <Link href="/login" className="text-[var(--color-accent-purple)] hover:underline">
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}
      </div>
    </div>
  );
}
