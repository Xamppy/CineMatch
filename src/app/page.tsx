import Link from "next/link";
import { Film, Heart, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Film className="w-10 h-10 text-accent" />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary-light to-secondary-light bg-clip-text text-transparent">
            CineMatch
          </h1>
          <Heart className="w-10 h-10 text-secondary" />
        </div>

        <p className="text-xl text-text-secondary mb-2">
          Elige películas en pareja
        </p>
        <p className="text-text-muted mb-10 max-w-md mx-auto">
          Desliza, haz match y encuentra la película perfecta para ver juntos
          esta noche.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/login" className="btn-primary text-center">
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              Comenzar
            </span>
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 max-w-3xl mx-auto">
        {[
          {
            icon: Film,
            title: "Descubre",
            desc: "Explora películas trending o busca tus favoritas",
          },
          {
            icon: Heart,
            title: "Desliza",
            desc: "Swipea a la derecha si te gusta, izquierda si no",
          },
          {
            icon: Sparkles,
            title: "Match",
            desc: "Cuando ambos dan like, ¡es un match!",
          },
        ].map((feature) => (
          <div key={feature.title} className="card text-center">
            <feature.icon className="w-8 h-8 text-accent mx-auto mb-3" />
            <h3 className="font-semibold text-text-primary mb-1">
              {feature.title}
            </h3>
            <p className="text-sm text-text-muted">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
