---
name: starye-ui-components
description: Build or maintain Starye Vue surfaces and shared UI components with the repository's Tailwind v4 tokens, responsive data-surface patterns, and accessible interaction states.
metadata:
  author: AI
  version: "2.0"
---

# Starye UI Component Workflow

Use this skill for Vue UI work in packages/ui, apps/dashboard, apps/movie-app, apps/comic-app, apps/blog, or apps/quant-app.

## Local design system

- Shared components and primitives live in packages/ui/src/components, src/composables, and src/assets/globals.css. Check the package exports before creating an app-local duplicate.
- Styling is Tailwind v4 through @tailwindcss/vite and @starye/ui/globals.css. packages/ui/tailwind.config.ts remains an exported compatibility/configuration surface; the shared runtime tokens are the CSS variables and --ui-* metrics in globals.css.
- Use bg-background, text-foreground, border-border, bg-card, text-muted-foreground, and the shared --ui-* variables. Scope an app-specific palette to its shell, such as .dashboard-shell or .quant-shell, so teleported drawers and nested surfaces inherit the intended variables.
- Use existing lucide-vue-next icons and shared components for buttons, dialogs, tables, filters, pagination, skeletons, status tags, and drawers. Give icon-only controls an accessible label and a tooltip when the icon meaning needs discovery.

## Surface decisions

1. Public content pages use the ui-public-* classes and shared cards/grid primitives. Dashboard and Quant are dense operational surfaces with their own shell tokens, tables, status colors, and compact controls.
2. Keep page sections and repeated items distinct. A framed surface may contain its own fields or rows; nested decorative card stacks add noise and reduce scanning.
3. Use semantic tokens rather than new arbitrary hex colors. Use --ui-radius-*, stable control heights, table cell metrics, and motion variables before inventing local values.
4. Motion should communicate state: transition the relevant color, border, shadow, or small positional property. A blanket transition-all, repeated lift effect, or hover animation on every data row makes the operational UI noisy.
5. Design loading, empty, error, disabled, focus-visible, narrow-width, long-label, and overflow states at the same time as the happy path. Tables and fixed-format controls need stable dimensions so dynamic text cannot shift surrounding content.
6. Prefer icon buttons for familiar tool actions, segmented controls or menus for modes/options, and text buttons for explicit commands. Preserve keyboard access, visible focus, semantic headings, and useful labels.

## Validation

- Shared package: pnpm --filter @starye/ui run type-check.
- App: run the affected app's type-check, focused Vitest tests, and build when Vite/Nuxt wiring or CSS imports change. Quant uses pnpm --filter quant-app run type-check and run test.
- UI acceptance runs through http://localhost:8080/...; direct app ports support diagnosis. Exercise the actual route, loading/error/empty states, mobile width, and any drawer/modal focus behavior.
- For visually important or cross-app changes, use the existing Playwright setup for the affected app and inspect screenshots at desktop and mobile widths. Keep unrelated design and generated files outside the change.
