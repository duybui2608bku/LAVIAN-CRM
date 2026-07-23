## ADDED Requirements

### Requirement: Directory and path conventions

The project SHALL organize non-route code under root-level directories resolvable via the existing `@/*` path alias: `lib/` (clients, utilities), `providers/` (React context providers), `stores/` (Zustand stores), `hooks/` (shared hooks), and `components/ui/` (shadcn/ui primitives).

#### Scenario: Import via path alias

- **WHEN** a module imports `@/lib/utils` or `@/components/ui/button`
- **THEN** TypeScript resolves it against the repo root and the build succeeds

### Requirement: Environment variable contract

The project SHALL document required environment variables in a committed `.env.example`, and application code SHALL read Supabase configuration from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

#### Scenario: Missing configuration

- **WHEN** the app initializes a Supabase client without the required env vars set
- **THEN** it fails fast with a clear error naming the missing variable rather than silently using an undefined value

#### Scenario: Example file present

- **WHEN** a developer clones the repo
- **THEN** `.env.example` lists every required variable with placeholder values and `.env.local` remains gitignored

### Requirement: Root provider composition

The app SHALL mount client-side providers (at minimum React Query) through a single client component composed into the root layout, keeping `app/layout.tsx` a server component.

#### Scenario: Providers available to the tree

- **WHEN** any client component calls `useQuery` or `useMutation`
- **THEN** a `QueryClient` is available in context and the call does not throw a "No QueryClient set" error

### Requirement: React Query client configuration

The project SHALL create a single shared `QueryClient` with sensible defaults (defined `staleTime` and retry behavior) and expose it through `QueryClientProvider` so all server-state access goes through React Query.

#### Scenario: Single client instance per browser session

- **WHEN** the app renders on the client
- **THEN** one `QueryClient` instance is reused across the component tree rather than recreated on every render

### Requirement: Client state conventions

The project SHALL use Zustand for client-only UI state, with each store defined as a typed hook under `stores/` and never used to mirror server state that React Query already owns.

#### Scenario: Typed store usage

- **WHEN** a component consumes a Zustand store hook
- **THEN** the selected state and actions are fully typed with no `any`
