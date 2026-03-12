"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { Film, Search, Heart, ArrowLeft, Copy, Check } from "lucide-react";
import { useState } from "react";

export default function RoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const code = params.code as string;
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const tabs = [
    { href: `/room/${code}`, label: "Swipe", icon: Film },
    { href: `/room/${code}/search`, label: "Buscar", icon: Search },
    { href: `/room/${code}/matches`, label: "Matches", icon: Heart },
  ];

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

        <div className="w-5" /> {/* Spacer for alignment */}
      </header>

      {/* Content */}
      <div className="flex-1">{children}</div>

      {/* Bottom Tabs */}
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
    </div>
  );
}
