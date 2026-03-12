"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Film, Mail, Lock, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Film className="w-8 h-8 text-accent" />
          <h1 className="text-3xl font-bold text-text-primary">CineMatch</h1>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-center mb-6">
            Iniciar sesión
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field pl-11"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field pl-11"
                required
              />
            </div>

            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              <span className="flex items-center justify-center gap-2">
                <LogIn className="w-5 h-5" />
                {loading ? "Entrando..." : "Entrar"}
              </span>
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-primary/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-surface px-2 text-text-muted">o</span>
            </div>
          </div>

          <button onClick={handleGoogleLogin} className="btn-secondary w-full">
            Continuar con Google
          </button>

          <p className="text-center text-sm text-text-muted mt-6">
            ¿No tienes cuenta?{" "}
            <Link
              href="/auth/register"
              className="text-accent hover:underline"
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
