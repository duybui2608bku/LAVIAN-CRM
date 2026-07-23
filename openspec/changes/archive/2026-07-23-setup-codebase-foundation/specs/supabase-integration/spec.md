## ADDED Requirements

### Requirement: Browser Supabase client

The project SHALL provide a browser Supabase client created with `createBrowserClient` from `@supabase/ssr`, exposed from `@/lib/supabase/client` for use in client components.

#### Scenario: Client component queries Supabase

- **WHEN** a client component imports the browser client and issues a query
- **THEN** the client is configured with the public URL and anon key and reads the session from cookies

### Requirement: Server Supabase client

The project SHALL provide a server Supabase client created with `createServerClient` from `@supabase/ssr`, exposed from `@/lib/supabase/server`, that reads and writes auth cookies using Next.js server APIs.

#### Scenario: Server component reads authenticated user

- **WHEN** a server component or route handler calls the server client to get the current user
- **THEN** the client resolves the session from request cookies without leaking service credentials to the browser

#### Scenario: Cookie writes are handled safely

- **WHEN** the server client attempts to set a cookie in a context where writes are not allowed (e.g. a server component render)
- **THEN** the write is handled without throwing, deferring session refresh to middleware

### Requirement: Session refresh middleware

The project SHALL include Next.js `middleware.ts` that refreshes the Supabase auth session on each matched request so server components observe a current session.

#### Scenario: Expired session refreshed

- **WHEN** a request arrives with a refreshable but stale session cookie
- **THEN** the middleware refreshes the session and forwards updated auth cookies on the response

#### Scenario: Static assets excluded

- **WHEN** a request targets static assets or images
- **THEN** the middleware matcher excludes it so session refresh runs only on application routes
