"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Film, Mail, Lock, User, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Create profile
      await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        avatar_url: null,
      });
    }

    setSuccess(true);
    setLoading(false);
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
            Crear cuenta
          </h2>

          {success ? (
            <div className="text-center py-4">
              <p className="text-success mb-2">¡Registro exitoso!</p>
              <p className="text-text-muted text-sm">
                Revisa tu email para confirmar tu cuenta.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-11"
                  required
                  minLength={2}
                />
              </div>

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
                  placeholder="Contraseña (mín. 6 caracteres)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-11"
                  required
                  minLength={6}
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
                  <UserPlus className="w-5 h-5" />
                  {loading ? "Creando cuenta..." : "Registrarse"}
                </span>
              </button>
            </form>
          )}

          <p className="text-center text-sm text-text-muted mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/auth/login" className="text-accent hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
