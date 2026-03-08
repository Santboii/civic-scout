## ADDED Requirements

### Requirement: Professional, High-Contrast Color Palette
The system SHALL implement a modern, high-contrast color palette that replaces the legacy "beige" aesthetic. The palette MUST include:
- `background-primary`: A clean, off-white or very light gray (#F8FAFC).
- `background-secondary`: A subtle contrasting gray (#F1F5F9).
- `text-primary`: Deep slate for maximum readability (#0F172A).
- `text-secondary`: Muted slate for metadata (#475569).
- `accent-primary`: A professional Indigo or Blue for primary actions (#2563EB).
- `accent-secondary`: A sophisticated Slate or Gray for secondary actions (#64748B).

#### Scenario: Global theme applied to background
- **WHEN** any page in the application is rendered
- **THEN** the `body` background color SHALL be #F8FAFC and the primary text color SHALL be #0F172A

#### Scenario: Secondary background for cards and sidebars
- **WHEN** a component like `PermitList` or a sidebar is rendered
- **THEN** it SHALL use the `background-secondary` (#F1F5F9) to provide subtle visual separation from the main content

### Requirement: Modern Typography and Spacing System
The system SHALL use a modern sans-serif font stack (e.g., Inter, system-ui) with a defined scale for headings and body text. Spacing SHALL follow a strict 4px or 8px grid system.

#### Scenario: Heading hierarchy in Detail Modals
- **WHEN** a `PermitDetailModal` is displayed
- **THEN** the permit title SHALL use a semi-bold weight (600) and a larger font size (1.25rem/20px), while metadata labels use a medium weight (500) and smaller size (0.875rem/14px)

#### Scenario: Consistent padding across components
- **WHEN** any UI container (card, modal, or list item) is rendered
- **THEN** it SHALL use consistent padding from the defined spacing scale (e.g., 16px or 24px) to ensure a balanced layout

### Requirement: Interactive Feedback and States
All interactive elements (buttons, links, markers) SHALL provide clear visual feedback for hover, focus, and active states.

#### Scenario: Button hover state
- **WHEN** a user hovers over a primary action button (e.g., "Search")
- **THEN** the background color SHALL subtly shift (e.g., from #2563EB to #1D4ED8) and the cursor SHALL change to a pointer
