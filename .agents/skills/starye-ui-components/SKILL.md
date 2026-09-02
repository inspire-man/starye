---
name: starye-ui-components
description: Build or maintain Starye Vue surfaces and shared UI components with the repository's Tailwind v4 tokens, responsive data-surface patterns, and accessible interaction states.
metadata:
  author: AI
  version: "2.1"
---

# Starye UI Component Workflow

Use this skill for Vue UI work in packages/ui, apps/dashboard, apps/movie-app, apps/comic-app, apps/blog, apps/auth, or apps/quant-app.

## Local design system

- Shared components and primitives live in packages/ui/src/components, src/composables, and src/assets/globals.css. Check package exports before creating an app-local duplicate.
- Styling is Tailwind v4 through @tailwindcss/vite and @starye/ui/globals.css. The shared runtime tokens are CSS variables and --ui-* metrics in globals.css; packages/ui/tailwind.config.ts remains a compatibility surface.
- Use bg-background, text-foreground, border-border, bg-card, text-muted-foreground, and shared --ui-* variables. Scope an app palette to its shell, such as dashboard-shell or quant-shell, so teleported drawers and nested surfaces inherit the intended variables.
- Use existing lucide-vue-next icons and shared components for buttons, dialogs, tables, filters, pagination, skeletons, status tags, and drawers. Give icon-only controls an accessible label and tooltip when discovery matters.

## Surface decisions

1. Public content pages use ui-public-* classes and shared cards/grid primitives. Dashboard and Quant are dense operational surfaces with their own shell tokens, tables, status colors, and compact controls.
2. Keep page sections and repeated items distinct. A framed surface may contain its own fields or rows; nested decorative card stacks reduce scanning.
3. Use semantic tokens, --ui-radius-* metrics, stable control heights, and table cell metrics before inventing local values.
4. Motion communicates state. Transition the relevant color, border, shadow, or small positional property; keep operational data rows quiet.
5. Design loading, empty, error, disabled, focus-visible, narrow-width, long-label, and overflow states with the happy path. Fixed-format controls must not move when content changes.
6. For Quant research and AI surfaces, show evidence status, source, observed time, missing data, pending generation, stream progress, and error state separately from score, priority, recommendation, and decision outcome.
7. Prefer icon buttons for familiar tool actions, segmented controls or menus for modes/options, and text buttons for explicit commands. Preserve keyboard access, visible focus, semantic headings, and useful labels.

## Validation

- Shared package: pnpm --filter @starye/ui run type-check.
- App: run the affected app type-check, focused Vitest tests, and build when Vite/Nuxt wiring or CSS imports change. Quant uses pnpm --filter quant-app run type-check, pnpm --filter quant-app test, and pnpm --filter quant-app build when applicable.
- UI acceptance runs through http://localhost:8080/...; direct app ports support diagnosis. Exercise the actual route, auth state, loading/error/empty states, mobile width, and drawer/modal focus behavior.
- For visually important or cross-app changes, use the existing Playwright setup and inspect desktop and mobile screenshots. Keep unrelated design and generated files outside the change.
