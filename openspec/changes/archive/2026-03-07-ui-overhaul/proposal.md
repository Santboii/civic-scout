## Why

The current UI is beige and "bland," which doesn't reflect the professional and data-rich nature of the development and permit information provided. Modernizing the interface will improve user engagement, build trust with the target market (real estate professionals and civic scouts), and create a more intuitive and visually appealing experience.

## What Changes

- Overhaul global CSS (colors, typography, and spacing) to replace the beige palette with a professional, high-contrast, and modern design system.
- Redesign the layout of `Map.tsx` and its overlays to provide a more immersive and interactive experience.
- Enhance the visual hierarchy and styling of `PermitList.tsx` and `PermitDetailModal.tsx` for better readability.
- Modernize the `SearchForm.tsx` to be more sleek and responsive.
- Ensure consistent styling across all components using a unified design system.

## Capabilities

### New Capabilities
- `modern-design-system`: Defines a new, professional color palette, typography, and reusable UI component styles that move away from the current beige aesthetic.

### Modified Capabilities
- `development-map`: Updating the visual presentation of the map, markers, and data overlays to align with the new design system.
- `address-search`: Enhancing the search interface and result presentation for a more modern user experience.

## Impact

- `src/app/globals.css`: Primary location for global styling and design tokens.
- `src/components/*`: Most UI components will need styling updates.
- Responsive layout across the entire application.
