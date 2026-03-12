"use client";

import { useEffect } from "react";
import { Film } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <Film className="w-12 h-12 text-danger mb-4 opacity-50" />
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Algo salió mal
      </h2>
      <p className="text-text-muted text-sm mb-6 text-center">
        Ocurrió un error inesperado. Intenta de nuevo.
      </p>
      <button onClick={reset} className="btn-primary">
        Reintentar
      </button>
    </div>
  );
}
