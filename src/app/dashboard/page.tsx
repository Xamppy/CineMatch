"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Plus, LogIn, Copy, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreateRoom() {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la sala");
      router.push(`/room/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la sala");
      setCreating(false);
    }
  }

  async function handleJoinRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setError(null);

    try {
      const res = await fetch("/api/rooms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Room not found");
      }

      const room = await res.json();
      router.push(`/room/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al unirse");
      setJoining(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Film className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-bold text-text-primary">CineMatch</h1>
        </div>

        <div className="space-y-6">
          {/* Create Room */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent" />
              Crear sala
            </h2>
            <p className="text-text-muted text-sm mb-4">
              Crea una sala y comparte el código con tu pareja.
            </p>
            <button
              onClick={handleCreateRoom}
              disabled={creating}
              className="btn-primary w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <Copy className="w-5 h-5" />
                {creating ? "Creando..." : "Crear nueva sala"}
              </span>
            </button>
          </div>

          {/* Join Room */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-accent" />
              Unirse a sala
            </h2>
            <form onSubmit={handleJoinRoom} className="space-y-4">
              <input
                type="text"
                placeholder="Código de sala (ej: ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="input-field text-center text-lg tracking-widest uppercase"
                maxLength={6}
              />
              <button
                type="submit"
                disabled={joining || joinCode.length < 6}
                className="btn-secondary w-full"
              >
                {joining ? "Uniéndose..." : "Unirse"}
              </button>
            </form>
          </div>

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 text-text-muted hover:text-text-secondary transition-colors w-full py-2"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
