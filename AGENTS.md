# AGENTS.md — CineMatch

Guidelines for AI agents working in this repository.

## Project Overview

CineMatch is a Tinder-style movie matching app for couples. Built with Next.js (App Router), Supabase (auth + realtime + DB), TMDB API, Tailwind CSS v4, Framer Motion, and Lucide React.

## Build / Dev / Lint Commands

```bash
npm run dev          # Start dev server with Turbopack (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint (next lint)
```

There is no test runner configured yet. When tests are added, they will use Vitest.

## Tech Stack

- **Framework:** Next.js 15+ with App Router (`src/app/`)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme` in `globals.css`)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Backend:** Supabase (auth, PostgreSQL, Realtime subscriptions)
- **External API:** TMDB (The Movie Database) — proxied through Next.js Route Handlers

## Project Structure

```
src/
├── app/                      # Next.js App Router pages and layouts
│   ├── layout.tsx            # Root layout (fonts, metadata, global styles)
│   ├── page.tsx              # Landing page (public)
│   ├── globals.css           # Tailwind v4 theme + custom component classes
│   ├── auth/                 # Authentication pages (login, register, callback)
│   ├── dashboard/            # Room creation / join (protected)
│   ├── room/[code]/          # Room pages (swiper, search, matches)
│   └── api/                  # Route Handlers (movies, rooms, votes)
├── components/ui/            # Reusable UI components
├── lib/                      # Shared utilities and service clients
│   ├── supabase/             # Supabase clients (client.ts, server.ts, middleware.ts)
│   └── tmdb.ts               # TMDB API wrapper
├── types/                    # TypeScript type definitions
└── middleware.ts              # Next.js middleware (auth session refresh + route protection)
supabase/
└── schema.sql                # Full database DDL with RLS policies
```

## Code Style

### TypeScript
- Strict mode enabled. Do NOT use `any` — use `unknown` and narrow.
- Prefer interfaces for object shapes; use `type` for unions/intersections.
- Export types from `src/types/index.ts`. Co-locate component-specific types in the component file.
- Use `snake_case` for database column names, `camelCase` for TypeScript properties. Map between them at the data layer.

### Imports
- Use the `@/*` path alias for all imports from `src/` (e.g., `import { createClient } from "@/lib/supabase/client"`).
- Order: 1) React/Next.js, 2) third-party libraries, 3) `@/lib`, 4) `@/components`, 5) `@/types`, 6) relative imports.
- Use named exports. Default exports are only for Next.js page/layout components.

### Components
- All interactive components must have `"use client"` directive at the top.
- Server Components are the default — only add `"use client"` when using hooks, event handlers, or browser APIs.
- Component files use kebab-case: `movie-card.tsx`, `match-alert.tsx`.
- Place reusable components in `src/components/ui/`. Page-specific components live next to their page.

### Formatting
- 2-space indentation.
- Double quotes for JSX attributes and imports.
- Trailing commas in multi-line objects/arrays.
- No semicolons — WAIT, this project USES semicolons. Always use semicolons.
- Max line length: soft limit 100 chars.

### Naming Conventions
- **Files:** kebab-case (`movie-card.tsx`, `search-input.tsx`)
- **Components:** PascalCase (`MovieCard`, `MatchAlert`)
- **Functions/variables:** camelCase (`handleSwipe`, `roomId`)
- **Constants:** UPPER_SNAKE_CASE for env vars and true constants (`TMDB_BASE_URL`)
- **Database tables:** snake_case (`movie_votes`, `room_members`)
- **API routes:** kebab-case paths (`/api/movies/search`)

### Error Handling
- In Route Handlers: catch errors, log with `console.error`, return proper HTTP status + JSON `{ error: "message" }`.
- In client components: use try/catch, set error state, display to user via inline messages (not alerts).
- Never expose internal errors or stack traces to the client.

### Supabase Patterns
- **Browser (client components):** `import { createClient } from "@/lib/supabase/client"`
- **Server (RSC, Route Handlers):** `import { createClient } from "@/lib/supabase/server"`
- Always call `await createClient()` on the server side (it reads cookies asynchronously).
- For Realtime: subscribe via `supabase.channel()` in `useEffect`, always clean up with `supabase.removeChannel()`.

### TMDB API
- NEVER call the TMDB API directly from client components. Always proxy through Route Handlers in `src/app/api/movies/` to protect the API key.
- The `TMDB_API_KEY` env var is server-only (no `NEXT_PUBLIC_` prefix).
- Use the wrapper functions in `src/lib/tmdb.ts`.

### Styling
- Use Tailwind utility classes. Custom theme tokens are defined in `src/app/globals.css` under `@theme`.
- Color palette: `primary` (#4C1D95), `secondary` (#881337), `background` (#0F0A1A), `surface`, `accent`, `text-primary`, `text-secondary`, `text-muted`.
- Reusable component classes: `.btn-primary`, `.btn-secondary`, `.input-field`, `.card`, `.gradient-primary`.
- Prefer Tailwind classes over inline styles. Use `cn()` utility if class merging is needed.

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key (public)
- `TMDB_API_KEY` — TMDB API key (server-only)
- All env vars are defined in `.env.local` (gitignored).

## Database

Full schema is in `supabase/schema.sql`. Tables: `profiles`, `rooms`, `room_members`, `movie_votes`, `matches`. All tables have RLS enabled. Realtime is enabled for `matches` and `movie_votes`.

## Key Architectural Decisions

1. **Auth:** Supabase Auth with email/password + Google OAuth. Session refresh handled in middleware.
2. **Rooms:** Users create rooms with 6-char codes. Rooms support exactly 2 members (enforced at app level).
3. **Voting:** Votes are upserted. Match detection happens server-side in the `/api/votes` Route Handler.
4. **Realtime:** Matches are broadcast via Supabase Realtime (postgres_changes on `matches` table).
5. **TMDB Proxy:** All TMDB calls go through Route Handlers to keep the API key server-side.
