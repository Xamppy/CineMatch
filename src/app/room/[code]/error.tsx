"use client";

import { useEffect } from "react";
import { Film } from "lucide-react";
import Link from "next/link";

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Room error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] px-4">
      <Film className="w-12 h-12 text-danger mb-4 opacity-50" />
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Error en la sala
      </h2>
      <p className="text-text-muted text-sm mb-6 text-center">
        Ocurrió un error inesperado. Intenta de nuevo.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary">
          Reintentar
        </button>
        <Link href="/dashboard" className="btn-secondary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
