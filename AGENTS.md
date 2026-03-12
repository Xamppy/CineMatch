# AGENTS.md — CineMatch

Guidelines for AI agents working in this repository.

## Project Overview

CineMatch is a Tinder-style movie matching app for couples. Built with Next.js 16 (App Router), Supabase (auth + realtime + DB), TMDB API, Tailwind CSS v4, Framer Motion, and Lucide React.

## Build / Dev / Lint Commands

```bash
npm run dev          # Start dev server with Turbopack (default port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint via: eslint src/
```

No test runner is configured yet. When tests are added they will use Vitest. Run a single test with: `npx vitest run path/to/file.test.ts`

### ESLint Configuration

ESLint 9 flat config in `eslint.config.mjs`. Extends `eslint-config-next` directly (not via `@eslint/eslintrc` compat). Custom rule: `@typescript-eslint/no-unused-vars` is `"warn"` with `argsIgnorePattern: "^_"` so unused parameters prefixed with `_` do not trigger warnings.

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Next.js (App Router) | 16 |
| Language | TypeScript (strict) | 5.9+ |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) | 4.2 |
| Animations | Framer Motion | 12 |
| Icons | Lucide React | 0.577+ |
| Auth / DB / Realtime | Supabase (`@supabase/ssr`) | 2.99+ |
| External API | TMDB (proxied through Route Handlers) | v3 |

## Project Structure

```
src/
├── app/                        # Next.js App Router pages & layouts
│   ├── layout.tsx              # Root layout (Inter font, metadata)
│   ├── page.tsx                # Landing page (public)
│   ├── globals.css             # Tailwind v4 @theme + component classes
│   ├── auth/                   # Login, register, OAuth callback
│   ├── dashboard/              # Room creation / join (protected)
│   ├── room/[code]/            # Room pages (layout with phase-aware tabs)
│   │   ├── layout.tsx          # Shared layout: header, status badge, bottom tabs
│   │   ├── lobby/page.tsx      # Lobby phase: search & add movies, ready up
│   │   ├── page.tsx            # Swipe phase: vote on pool movies
│   │   ├── matches/page.tsx    # Matches list
│   │   └── search/page.tsx     # Deprecated — redirects to lobby or swipe
│   └── api/                    # Route Handlers
│       ├── movies/             # search, trending, popular (TMDB proxy)
│       ├── rooms/              # create, join
│       │   ├── movies/         # GET/POST/DELETE room movie pool
│       │   └── ready/          # POST toggle ready + lobby→swiping transition
│       └── votes/              # POST vote + match detection
├── components/ui/              # Reusable UI components
├── lib/                        # Shared utilities & service clients
│   ├── supabase/               # client.ts, server.ts, middleware.ts
│   └── tmdb.ts                 # TMDB API wrapper
├── types/                      # Shared TypeScript type definitions
└── middleware.ts                # Auth guard + session refresh
supabase/
├── schema.sql                  # Full DDL with RLS policies (canonical)
├── migration-fix-rls.sql       # RLS hotfix migration
└── migration-lobby-feature.sql # Lobby feature migration (additive)
```

## Code Style

### TypeScript
- Strict mode is ON. Never use `any`; use `unknown` and narrow.
- Prefer `interface` for object shapes; use `type` for unions/intersections.
- Export shared types from `src/types/index.ts`. Co-locate component-specific types in the component file.
- Map DB `snake_case` columns to `camelCase` TS properties at the data layer.
- Prefix intentionally unused parameters with `_` (enforced by ESLint rule).

### Imports
- Always use the `@/*` path alias for imports from `src/` (e.g. `import { createClient } from "@/lib/supabase/client"`).
- Order: 1) React / Next.js 2) third-party 3) `@/lib` 4) `@/components` 5) `@/types` 6) relative.
- Use named exports everywhere. Default exports only for Next.js page/layout components.

### Formatting
- 2-space indentation.
- Double quotes for all strings and JSX attributes.
- Always use semicolons.
- Trailing commas in multi-line objects, arrays, and parameters.
- Soft line-length limit: 100 characters.

### Naming Conventions
- **Files:** kebab-case (`movie-card.tsx`, `search-input.tsx`).
- **Components:** PascalCase (`MovieCard`, `MatchAlert`).
- **Functions / variables:** camelCase (`handleSwipe`, `roomId`).
- **Constants:** UPPER_SNAKE_CASE for env vars and true constants (`TMDB_BASE_URL`).
- **DB tables / columns:** snake_case (`movie_votes`, `room_members`).
- **API routes:** kebab-case paths (`/api/movies/search`).

### Components
- Server Components are the default. Only add `"use client"` when the file uses hooks, event handlers, or browser APIs.
- Place reusable components in `src/components/ui/`. Page-specific components live next to their page file.

### Error Handling
- **Route Handlers:** catch errors, `console.error(...)`, return `{ error: "message" }` with the correct HTTP status.
- **Client components:** try/catch, set error state, render inline error messages (never `alert()`).
- Never expose stack traces or internal details to the client.

## Supabase Patterns

- **Browser:** `import { createClient } from "@/lib/supabase/client"` — call synchronously.
- **Server (RSC / Route Handlers):** `import { createClient } from "@/lib/supabase/server"` — always `await createClient()` (reads cookies async).
- **Realtime:** subscribe via `supabase.channel()` inside `useEffect`; always clean up with `supabase.removeChannel()` in the effect's return.

## TMDB API

- NEVER call TMDB directly from client components. Proxy all requests through Route Handlers under `src/app/api/movies/` to keep the API key server-side.
- `TMDB_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix).
- Use wrapper functions in `src/lib/tmdb.ts` (`searchMovies`, `getTrendingMovies`, `getPopularMovies`, `getTopRatedMovies`, `getMovieDetails`).

## Styling

- Tailwind utility classes first. Custom tokens are defined in `src/app/globals.css` under `@theme`.
- Full color palette: `primary` (#4C1D95), `primary-light`, `primary-dark`, `secondary` (#881337), `secondary-light`, `secondary-dark`, `background` (#0F0A1A), `surface`, `surface-light`, `accent` (#C084FC), `text-primary`, `text-secondary`, `text-muted`, `success`, `danger`.
- Reusable component classes: `.btn-primary`, `.btn-secondary`, `.input-field`, `.card`, `.gradient-primary`, `.gradient-card`.
- Prefer Tailwind classes over inline styles. Use a `cn()` utility if class merging is needed.

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `TMDB_API_KEY` | Server-only | TMDB API key |

All defined in `.env.local` (gitignored). Use `https://`-prefixed placeholder URLs to avoid build-time validation errors from the Supabase SDK.

## Database

Full schema: `supabase/schema.sql`. Tables: `profiles`, `rooms`, `room_members`, `room_movies`, `movie_votes`, `matches`. All tables have RLS enabled. Realtime is enabled on `matches`, `movie_votes`, `room_movies`, and `room_members`.

## Key Architecture Decisions

1. **Auth:** Supabase Auth (email/password + Google OAuth). Session refresh in Next.js middleware.
2. **Rooms:** 6-char alphanumeric codes. Max 2 members enforced at application level.
3. **Voting:** Votes are upserted (unique on `room_id, user_id, movie_id`). Match detection is server-side in `/api/votes`.
4. **Realtime:** Clients subscribe to `postgres_changes` on the `matches` table for instant match alerts.
5. **TMDB Proxy:** All TMDB calls go through Route Handlers to keep the API key server-side.
6. **Lobby Phase:** Rooms start in `lobby` status. Each user searches and adds movies to the pool (min 5). Both users must ready up to transition to `swiping`. Status transitions happen server-side in `/api/rooms/ready`.
7. **Room Phases:** `lobby` → `swiping` → `completed`. The room layout dynamically switches tabs and shows a status badge. The search page is deprecated and redirects based on current phase.

## Known Caveats

- Next.js 16 deprecates the `middleware` file convention in favor of `proxy`. The current `src/middleware.ts` still works but emits a build warning. Migration to the proxy convention is planned.
- The `.env.local` must use valid `https://` URLs for `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://your-project.supabase.co`). Plain placeholder strings cause the Supabase SDK to throw at build time during static page prerendering.
- No `next/image` remote patterns are configured in `next.config.ts` yet. TMDB poster images are loaded via `<img>` tags with `eslint-disable` comments for `@next/next/no-img-element`. When optimizing images, add `image.tmdb.org` to `images.remotePatterns` in the Next config.
