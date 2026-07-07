## 1. Dependencies & env

- [ ] 1.1 Add runtime deps: `@supabase/ssr`, `@supabase/supabase-js`
- [ ] 1.2 Add shadcn/theming deps: `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react` (or let `shadcn init` add them)
- [ ] 1.3 Create `.env.example` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` placeholders; confirm `.env.local` is gitignored
- [ ] 1.4 Skim `node_modules/next/dist/docs/` for Next 16 middleware + `cookies()` signatures and the current `@supabase/ssr` guide before writing clients

## 2. Folder conventions & utilities

- [ ] 2.1 Create root dirs `lib/`, `lib/supabase/`, `providers/`, `stores/`, `hooks/`, `components/ui/`
- [ ] 2.2 Add `cn()` helper at `lib/utils.ts` (clsx + tailwind-merge)
- [ ] 2.3 Verify `@/*` alias resolves an import from each new dir (build/typecheck)

## 3. UI system (shadcn/ui + tokens)

- [ ] 3.1 Run `shadcn init` for Tailwind v4 + App Router; commit `components.json` (fallback: hand-add `components.json` + deps if CLI lacks non-interactive v4 support)
- [ ] 3.2 Define design tokens as CSS variables in `app/globals.css` under `@theme`, with light + dark values
- [ ] 3.3 Add one primitive (`button`) via the CLI to confirm generation into `components/ui/`
- [ ] 3.4 Replace placeholder metadata/boilerplate in `app/layout.tsx` and `app/page.tsx` with a minimal token-based shell

## 4. State & providers

- [ ] 4.1 Create shared `QueryClient` with default `staleTime`/retry in `providers/index.tsx`, stable per session via `useState(() => ...)`
- [ ] 4.2 Wrap children in `QueryClientProvider` and mount `<Providers>` in `app/layout.tsx` (keep layout a server component)
- [ ] 4.3 Add an example typed Zustand store under `stores/` demonstrating the client-state convention

## 5. Supabase integration

- [ ] 5.1 Implement browser client at `lib/supabase/client.ts` via `createBrowserClient`, failing fast on missing env vars
- [ ] 5.2 Implement server client at `lib/supabase/server.ts` via `createServerClient` with Next cookie adapters; try/catch around cookie `set`
- [ ] 5.3 Add `middleware.ts` refreshing the session and re-emitting cookies, with a matcher excluding `_next/static`, `_next/image`, and asset files
- [ ] 5.4 (Optional) Scaffold an empty `lib/supabase/database.types.ts` placeholder and type the clients with it

## 6. Verification

- [ ] 6.1 `npm run build` and `npm run lint` pass clean
- [ ] 6.2 Confirm a client component can call `useQuery` without a "No QueryClient" error and a server component can call the server client to read the user
- [ ] 6.3 Confirm `cn("px-2","px-4")` resolves to `px-4` and dark-mode tokens apply
