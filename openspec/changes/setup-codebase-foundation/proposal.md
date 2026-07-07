## Why

The repo is a bare `create-next-app` scaffold (default `app/page.tsx`, placeholder metadata). Data/form libraries are installed but nothing is wired: no shadcn/ui, no Supabase clients, no React Query provider, no state/folder conventions. Every feature built now would invent its own patterns, so we establish the standard foundation once, up front.

## What Changes

- Add a **shadcn/ui** setup on top of the existing Tailwind v4 install: `components.json`, the `cn()` helper, design tokens as CSS variables, and light/dark theming.
- Add **Supabase** integration via `@supabase/ssr`: a browser client, a server client (async cookies), and Next middleware to refresh the auth session. **BREAKING** for env: requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Wire the already-installed libraries into **root providers**: a shared React Query client + `QueryClientProvider`, and Zustand store conventions for client-only state.
- Establish **folder conventions** under the existing `@/*` (root) path alias: where clients, providers, stores, hooks, UI components, and feature code live.
- Replace the placeholder root layout/page metadata and mount providers.
- Reuse what's already here — React Query, Zustand, React Hook Form, Zod are installed; this change configures them, it does not add duplicates. `axios` stays available but Supabase client + React Query cover most data access.

## Capabilities

### New Capabilities
- `project-foundation`: Directory/path conventions, environment-variable contract, root provider composition, React Query client wiring, and Zustand store conventions.
- `ui-system`: shadcn/ui installation, the `cn()` utility, Tailwind v4 design tokens, and light/dark theming.
- `supabase-integration`: Browser and server Supabase clients via `@supabase/ssr`, plus middleware-based session refresh.

### Modified Capabilities
<!-- None — this is a greenfield scaffold with no existing specs. -->

## Impact

- **Dependencies (new):** `@supabase/ssr`, `@supabase/supabase-js`; shadcn/ui-managed Radix primitives + `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`.
- **Dependencies (configured, already installed):** `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`, `@hookform/resolvers`.
- **Files:** `app/layout.tsx`, `app/globals.css`, `app/page.tsx`; new `middleware.ts`, `components.json`, `.env.example`; new dirs `lib/`, `components/ui/`, `providers/`, `stores/`, `hooks/`.
- **Config:** `next.config.ts` (as needed), Tailwind theme tokens.
- **Constraint:** Next.js **16** and Tailwind **v4** differ from common references — implementation must follow `node_modules/next/dist/docs/` and the current `@supabase/ssr` guidance, not older patterns.
