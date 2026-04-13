---
name: starye-ui-components
description: Maintain Shadcn UI boundaries, tailwind presets, and high-quality premium aesthetics.
metadata:
  author: AI
  version: "1.0"
---

# Starye UI Consistency Guide

The user demands a "premium, state of the art frontend" adhering strictly to Shadcn and Tailwind v4. When working on any Vue layer (`movie-app`, `admin`, `comic-app`), apply these design methodologies.

## 1. Monorepo Styling Boundaries

- The core design configuration resides in `packages/ui/tailwind.preset.ts`. 
- **DO NOT** hardcode disjointed HEX colors in Vue components. Always map to design tokens (e.g., `bg-primary-600`, `text-gray-400`).
- Check if a foundational component (Buttons, Popovers, Tabs) exists in `packages/ui` before scaffolding locally.

## 2. Micro-Animations & Interactivity

- Modern web requires dynamic interaction.
- Add `transition-all duration-300`, `hover:-translate-y-1`, or `hover:scale-[1.02]` on clickable cards.
- Support `Skeleton` placeholders during data suspense.

## 3. Cross-App Theming

- Applications span from `/blog`, `/movie`, to `/dashboard`.
- Even when apps are isolated, they MUST share standard Layout structures (like `BottomNavigation.vue` logic) to keep the Starye matrix visually unified.
