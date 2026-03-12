"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  Film,
  Heart,
  ArrowLeft,
  Copy,
  Check,
  ListPlus,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const code = params.code as string;
  const [copied, setCopied] = useState(false);
  const [roomStatus, setRoomStatus] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Fetch room status
  useEffect(() => {
    async function fetchStatus() {
      const { data } = await supabase
        .from("rooms")
        .select("id, status")
        .eq("code", code)
        .single();

      if (data) {
        setRoomStatus(data.status);
      }
    }
    fetchStatus();
  }, [code, supabase]);

  // Listen for room status changes in realtime
  useEffect(() => {
    if (!code) return;

    const channel = supabase
      .channel(`room-layout:${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
        },
        (payload) => {
          const updated = payload.new;
          if (updated.code === code) {
            setRoomStatus(updated.status);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, supabase]);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isLobby = roomStatus === "lobby";

  // Show lobby tabs when room is in lobby phase.
  // Once the room transitions to swiping/completed, always show swipe tabs
  // even if the URL still says /lobby (the lobby page will redirect away).
  const lobbyTabs = [
    { href: `/room/${code}/lobby`, label: "Lobby", icon: ListPlus },
  ];

  const swipeTabs = [
    { href: `/room/${code}`, label: "Swipe", icon: Film },
    { href: `/room/${code}/matches`, label: "Matches", icon: Heart },
  ];

  const tabs = isLobby ? lobbyTabs : swipeTabs;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-primary/10 bg-surface/80 backdrop-blur-sm">
        <Link
          href="/dashboard"
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-3">
          {/* Room status badge */}
          {roomStatus && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                isLobby
                  ? "bg-accent/20 text-accent"
                  : "bg-success/20 text-success"
              }`}
            >
              {isLobby ? "Lobby" : "Votando"}
            </span>
          )}

          <button
            onClick={copyCode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <span className="text-sm font-mono font-semibold tracking-widest text-accent">
              {code}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-muted" />
            )}
          </button>
        </div>

        <div className="w-5" /> {/* Spacer for alignment */}
      </header>

      {/* Content */}
      <div className="flex-1">{children}</div>

      {/* Bottom Tabs — only show when there are multiple tabs */}
      {tabs.length > 1 && (
        <nav className="flex border-t border-primary/10 bg-surface/80 backdrop-blur-sm">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  isActive
                    ? "text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
