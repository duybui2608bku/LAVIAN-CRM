## ADDED Requirements

### Requirement: shadcn/ui installation

The project SHALL be initialized with shadcn/ui configured for Tailwind v4 and the App Router, producing a committed `components.json` and generating primitives into `@/components/ui`.

#### Scenario: Add a component

- **WHEN** a developer runs the shadcn CLI to add a component (e.g. `button`)
- **THEN** the component is generated under `components/ui/` and imports resolve without further configuration

### Requirement: Class-merge utility

The project SHALL provide a `cn()` helper (combining `clsx` and `tailwind-merge`) at `@/lib/utils` for conditional and conflict-free Tailwind class composition.

#### Scenario: Conflicting classes resolve

- **WHEN** `cn("px-2", "px-4")` is called
- **THEN** it returns a single class string with the later `px-4` winning

### Requirement: Design tokens and theming

The project SHALL define design tokens (colors, radius, etc.) as CSS variables in `globals.css` mapped through Tailwind v4's `@theme`, supporting light and dark modes.

#### Scenario: Dark mode applies

- **WHEN** the dark theme is active
- **THEN** components styled with token-based Tailwind classes render with the dark palette without hardcoded color values

#### Scenario: Placeholder scaffold removed

- **WHEN** the change is applied
- **THEN** the default `create-next-app` layout/page metadata and boilerplate styles are replaced with project tokens and a minimal shell
