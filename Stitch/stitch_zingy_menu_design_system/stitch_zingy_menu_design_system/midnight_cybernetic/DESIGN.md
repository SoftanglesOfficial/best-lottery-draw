---
name: Midnight Cybernetic
colors:
  surface: '#111415'
  surface-dim: '#111415'
  surface-bright: '#37393a'
  surface-container-lowest: '#0c0f0f'
  surface-container-low: '#1a1c1d'
  surface-container: '#1e2021'
  surface-container-high: '#282a2b'
  surface-container-highest: '#333536'
  on-surface: '#e2e2e3'
  on-surface-variant: '#c9c4d8'
  inverse-surface: '#e2e2e3'
  inverse-on-surface: '#2e3132'
  outline: '#938ea1'
  outline-variant: '#484555'
  surface-tint: '#cabeff'
  primary: '#cabeff'
  on-primary: '#32009a'
  primary-container: '#947dff'
  on-primary-container: '#2b0088'
  inverse-primary: '#613de0'
  secondary: '#bec7d6'
  on-secondary: '#28313c'
  secondary-container: '#3e4753'
  on-secondary-container: '#adb6c4'
  tertiary: '#c7c6cb'
  on-tertiary: '#2f3035'
  tertiary-container: '#919096'
  on-tertiary-container: '#29292e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#cabeff'
  on-primary-fixed: '#1c0062'
  on-primary-fixed-variant: '#4918c8'
  secondary-fixed: '#dae3f2'
  secondary-fixed-dim: '#bec7d6'
  on-secondary-fixed: '#131c27'
  on-secondary-fixed-variant: '#3e4753'
  tertiary-fixed: '#e3e2e8'
  tertiary-fixed-dim: '#c7c6cb'
  on-tertiary-fixed: '#1a1b20'
  on-tertiary-fixed-variant: '#46464b'
  background: '#111415'
  on-background: '#e2e2e3'
  surface-variant: '#333536'
  surface-elevated: '#161B22'
  border-subtle: '#30363D'
  success-accent: '#00C896'
typography:
  headline-xl:
    fontFamily: Syne
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Syne
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '400'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-page: 24px
  container-max: 1440px
---

## Brand & Style

This design system is built for high-performance enterprise environments where focus and clarity are paramount. The aesthetic is a refined blend of **Minimalism** and **Modern Corporate**, utilizing a deep "Cybernetic" palette to reduce eye strain during long working sessions.

The brand personality is authoritative yet innovative, evoking a sense of precision and technical sophistication. It targets professional users who require dense information displays without visual clutter. The emotional response is one of calm control, facilitated by structured depth and high-contrast focal points.

## Colors

The palette is anchored by a deep-space foundation. The primary background uses a near-black tone to create an expansive sense of canvas, while elevated surfaces use a slightly lighter slate to establish hierarchy.

- **Primary Purple (#7C5CFC):** Used exclusively for call-to-action elements, active states, and critical brand identifiers. It provides a vibrant high-contrast anchor against the dark backdrop.
- **Surface Tiers:** Use the tertiary color for the base background and the secondary color for interactive components like cards and input fields.
- **Success Accent:** A specialized emerald green is reserved for "Logged in" notifications and positive status indicators, maintaining high legibility against the dark theme.

## Typography

This design system employs a sophisticated trio of typefaces to delineate content types:

1.  **Syne:** Reserved for major headings and brand-level display text. Its wide, geometric structure provides a futuristic, high-end feel.
2.  **Plus Jakarta Sans:** Chosen for all body copy and primary UI text. It offers superior legibility in dark mode and a modern, friendly touch that balances the technical aesthetic.
3.  **JetBrains Mono:** Used for utility text, such as keyboard shortcuts (e.g., `Ctrl+1`), status labels, and metadata. Its fixed-width nature reinforces the "developer-tool" precision of the application.

## Layout & Spacing

The system utilizes a **12-column fluid grid** for main dashboard views, but switches to centered, **fixed-width containers** (approx. 480px) for authentication and modal-driven workflows.

- **Rhythm:** A 4px baseline grid governs all spacing.
- **Vertical Stack:** Navigation and "List Item" patterns follow a dense vertical stack with 8px of separation between elements to maximize information density.
- **Margins:** Standard page margins are 24px, but collapse to 16px on mobile devices.

## Elevation & Depth

Depth is communicated through **Tonal Layering** rather than heavy shadows. 

- **Level 0 (Base):** The deepest hex (#0B0C10) represents the canvas.
- **Level 1 (Card/Container):** A lighter slate surface with a subtle 1px border (#30363D) creates separation.
- **Interactive State:** Hovering over list items or buttons triggers a subtle background lightening or a primary-colored glow.
- **Inner Depth:** Input fields use a slightly darker inset color to appear recessed into the Level 1 containers.

## Shapes

The design system uses a **Rounded** shape language to soften the high-contrast "Cyber" aesthetic. 

- **Standard Elements:** 0.5rem (8px) corner radius for buttons and list items.
- **Containers:** 1rem (16px) corner radius for main cards and modals to create a distinct framing effect.
- **Inputs:** 0.5rem (8px) to match the button style for visual consistency.

## Components

### Buttons
- **Primary:** Solid `#7C5CFC` background with white text. High-contrast and center-aligned.
- **Ghost/Secondary:** Transparent background with a `1px` border and subtle hover state.
- **Action Buttons:** Small, fixed-width buttons (e.g., "Back") use a more muted surface with an icon + text pairing.

### List Items
The "List Item" pattern is the core of navigation. It features:
- A full-width container with `12px` vertical padding.
- Left-aligned icons with a low-opacity primary tint.
- Subtle `1px` borders that only appear on hover or in active states.

### Cards
Cards are the primary organizational unit. They must include a clear header section, often featuring an icon and a title in **Syne**. For multi-step processes, a "progress bar" component consisting of segmented lines (active = primary purple) is placed just below the header.

### Input Fields
Inputs are dark-themed with a subtle border. Labels use **JetBrains Mono** in all-caps to denote their functional/technical role.