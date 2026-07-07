## Context

`lavian-crm` is a fresh Next.js **16.2.10** App Router project (React 19, Tailwind **v4** via `@tailwindcss/postcss`, TypeScript strict, path alias `@/*` → repo root). React Query, Zustand, React Hook Form, Zod, and axios are already in `package.json` but unused; only the default `create-next-app` layout/page exist. There is no UI kit, no Supabase, and no provider wiring.

Two hard constraints from `AGENTS.md`: Next.js 16 and Tailwind v4 diverge from common references, so implementation must consult `node_modules/next/dist/docs/` and current `@supabase/ssr` docs rather than older App Router / `auth-helpers` patterns.

## Goals / Non-Goals

**Goals:**
- Configure (not re-add) the installed libraries into a single, documented set of conventions.
- Provide working Supabase browser + server clients and session-refresh middleware.
- Install shadcn/ui on Tailwind v4 with design tokens and light/dark theming.
- Leave a minimal, non-boilerplate app shell that new features can build on.

**Non-Goals:**
- No auth flows, login pages, or CRM domain features — this is scaffolding only.
- No database schema, migrations, or generated DB types (a placeholder type is fine).
- No component library beyond what shadcn generates on demand; no design system.
- No removal of `axios` — it stays available; we simply route data access through React Query + Supabase.

## Decisions

**1. `@supabase/ssr`, not `auth-helpers`.** `@supabase/auth-helpers-nextjs` is deprecated; `@supabase/ssr` is the current cookie-based SSR path. Split into `@/lib/supabase/client` (browser, `createBrowserClient`) and `@/lib/supabase/server` (`createServerClient` with Next cookie adapters). Server cookie writes during a server-component render can throw — wrap `set` in try/catch and rely on middleware for the actual refresh. *Alternative rejected:* a single isomorphic client — impossible given browser vs. server cookie access differ.

**2. Middleware owns session refresh.** A `middleware.ts` calls `supabase.auth.getUser()` (or `getClaims`) to refresh and re-emit cookies, with a matcher excluding `_next/static`, `_next/image`, and asset files. This keeps server components reading a fresh session without each one refreshing. *Alternative rejected:* per-request refresh in a layout — runs too late and duplicates work.

**3. Providers as one client component.** `providers/index.tsx` (client) holds `QueryClientProvider` with a lazily-created `QueryClient` (via `useState(() => new QueryClient())` so it's stable and per-session), composed into the server `app/layout.tsx`. Keeps the layout a server component and gives one place to add future providers (theme, etc.). *Alternative rejected:* making the whole layout a client component — loses server rendering.

**4. Root-based folders under `@/*`.** The existing alias maps `@/*` to the repo root (not `src/`), so add `lib/`, `providers/`, `stores/`, `hooks/`, `components/ui/` at root and keep the alias unchanged. *Alternative rejected:* migrating to `src/` — churns the alias and the existing `app/` for no benefit.

**5. shadcn/ui with CLI-on-demand.** Run `shadcn init` for Tailwind v4, commit `components.json` and `cn()`, but do not pre-generate a catalog of components — features add what they use. Tokens live as CSS variables in `globals.css` under `@theme`. *Alternative rejected:* hand-rolling primitives or importing a full component lib — more code to own.

**6. React Query for server state, Zustand for client state.** Clear split: anything from Supabase goes through React Query; Zustand holds only ephemeral UI state. Prevents the common bug of caching server data in two places.

## Risks / Trade-offs

- **Next 16 / Tailwind v4 API drift** → Consult `node_modules/next/dist/docs/` and current `@supabase/ssr` guide before writing each file; verify `cookies()` async signature and middleware shape against the installed version, not memory.
- **shadcn CLI Tailwind-v4 support** → If the CLI doesn't fully support v4 non-interactively, fall back to manually adding `components.json` + `cn()` + deps; the spec only requires the outcome, not the CLI path.
- **Env vars missing at runtime** → Fail fast in the client factory with an explicit error naming the variable; ship `.env.example`.
- **Server cookie-write throw** → try/catch around `set`, documented as intentional; middleware is the real refresh path.
- **Over-scoping the scaffold** → Deliberately no auth/domain code; each spec is verifiable as pure infrastructure.

## Migration Plan

Greenfield — no data or users to migrate. Rollback = revert the change branch. Deploy requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in the environment before build.

## Open Questions

- Do we want a theme provider (e.g. `next-themes`) now, or defer dark-mode toggling until a feature needs it? (Leaning defer — tokens support both modes already.)
- Should a generated `Database` type be scaffolded as an empty placeholder, or omitted until the schema exists? (Leaning empty placeholder for typed clients.)
