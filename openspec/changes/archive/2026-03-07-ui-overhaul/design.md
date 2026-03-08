## Context

The current application relies on a legacy "beige" aesthetic with fragmented styling across multiple components. It lacks a centralized design system, making it difficult to maintain visual consistency or implement theme updates. The project uses Next.js and global CSS, providing a straightforward path for modernization via CSS variables (design tokens).

## Goals / Non-Goals

**Goals:**
- Centralize all theme colors, typography, and spacing into a set of CSS variables in `src/app/globals.css`.
- Standardize the visual hierarchy across `Map`, `PermitList`, and `SearchForm`.
- Implement a high-contrast, professional professional palette (#F8FAFC, #0F172A, #2563EB).
- Ensure 100% responsiveness on mobile and desktop viewports.
- Improve interactive feedback (hovers, focus states, loading indicators).

**Non-Goals:**
- Migrating to a different CSS framework (e.g., Tailwind) if not already in use (the instructions say avoid Tailwind unless requested).
- Modifying backend logic, data ingestion, or geocoding APIs.
- Introducing new functional features beyond UI/UX improvements.

## Decisions

### 1. Centralized Design Tokens via CSS Variables
**Rationale**: Using CSS variables in `:root` allows for a single source of truth for all styles. It facilitates consistency across disparate components and simplifies future theme adjustments.
**Alternatives**: Hardcoding values (rejected for maintainability) or using a CSS-in-JS library (rejected to minimize bundle size and stay consistent with current Next.js patterns).

### 2. 8px Soft Grid System
**Rationale**: Adopting an 8px grid (8, 16, 24, 32px) for spacing and padding ensures a clean, mathematical rhythm that is standard in modern UI design.
**Alternatives**: Ad-hoc spacing (rejected for being the cause of the current "bland" look).

### 3. Progressive Enhancement for Map Overlays
**Rationale**: Instead of a complete map rewrite, we will update Mapbox layer properties (colors, opacities) dynamically to match the new theme.
**Alternatives**: Creating new static tilesets (rejected for complexity and cost).

## Risks / Trade-offs

- **[Risk]** Breaking responsive layouts in the `PermitList` drawer on mobile. → **Mitigation**: Use CSS Flexbox/Grid and perform rigorous testing on simulated mobile viewports.
- **[Risk]** Color contrast accessibility (A11y) issues. → **Mitigation**: Validate the new palette against WCAG AA standards using automated contrast checkers.
- **[Risk]** Visual regression on complex map overlays. → **Mitigation**: Incrementally update map layer styles and verify each tier marker individually.
