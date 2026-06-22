---
name: Monolithic Intelligence
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#b9c8de'
  on-secondary: '#233143'
  secondary-container: '#39485a'
  on-secondary-container: '#a7b6cc'
  tertiary: '#ffffff'
  on-tertiary: '#263143'
  tertiary-container: '#d8e3fb'
  on-tertiary-container: '#5a6579'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#d4e4fa'
  secondary-fixed-dim: '#b9c8de'
  on-secondary-fixed: '#0d1c2d'
  on-secondary-fixed-variant: '#39485a'
  tertiary-fixed: '#d8e3fb'
  tertiary-fixed-dim: '#bcc7de'
  on-tertiary-fixed: '#111c2d'
  on-tertiary-fixed-variant: '#3c475a'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-page: 24px
  panel-padding: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for high-performance AI orchestration, prioritizing clarity, precision, and a "pro-tool" aesthetic. The brand personality is stoic and authoritative, positioning itself as a silent but powerful engine for complex automated workflows.

The visual style is a fusion of **Modern Minimalism** and **Technical Glassmorphism**. It utilizes a monochromatic palette to reduce cognitive load while employing subtle depth through translucent layers and razor-thin borders. The interface should feel like a premium command center—utilitarian enough for developers but polished enough for high-level executive monitoring.

## Colors

The palette is strictly grayscale and neutral to maintain focus on the live data and AI outputs. 

- **Primary:** High-contrast White (#FFFFFF) is reserved for primary actions, active text, and essential indicators.
- **Surface Tiers:** We use a "Deep Black" base (#050505) with elevated surfaces using "Pure Charcoal" (#0F0F0F). This creates a hierarchy of depth without relying on traditional shadows.
- **Accent Slate:** Slate grays are used for secondary information and iconography to ensure they remain legible but secondary to the primary white content.
- **Status Tones:** While the system is monochromatic, use functional colors (Red, Amber, Green) sparingly and only for critical system statuses, maintaining a low-saturation profile.

## Typography

This design system utilizes a dual-font strategy to distinguish between UI controls and technical data.

- **Inter:** The primary sans-serif for navigation, headers, and descriptive text. It provides a modern, accessible feel that balances the technical nature of the platform.
- **JetBrains Mono:** Used for all "Terminal" elements, code blocks, agent logs, and small labels. The monospaced nature emphasizes the algorithmic and precise personality of the tool.

On mobile devices, headlines scale down significantly (e.g., display-lg becomes 32px) to maintain readability in narrow-column multi-pane layouts.

## Layout & Spacing

The layout philosophy follows a **Fluid Multi-Pane Grid**, similar to an Integrated Development Environment (IDE). 

- **The Workspace:** A 12-column grid that allows for collapsible sidebars (left/right) and a central flexible orchestration area. 
- **Density:** High density is preferred. Spacing units are based on a 4px baseline to allow for compact data presentation.
- **Panels:** Each agent or terminal instance lives in a "Pane" with a 16px gutter between adjacent panes. 
- **Responsiveness:** On tablet, panes stack into a 2-column scrollable grid. On mobile, the system collapses into a single-pane focused view with a horizontal switcher for active agents.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Backdrop Blurs** rather than traditional drop shadows.

- **The Void:** The furthest background layer is the darkest (#050505).
- **The Surface:** Active panels use a slightly lighter gray (#0F0F0F) with a 1px "Inner Luster" (a subtle top-border highlight) to define edges.
- **Glassmorphism:** Overlays, dropdown menus, and floating tooltips utilize a `backdrop-filter: blur(20px)` with a semi-transparent slate background. This allows the user to maintain visual context of the logs running beneath the UI.
- **Borders:** Use high-contrast, low-opacity borders (1px white at 8% opacity) to separate code blocks and terminal segments.

## Shapes

The design system uses a **Soft (0.25rem / 4px)** corner radius for almost all components. This creates a disciplined, technical look that feels precise without being sharp or aggressive.

- **Standard Elements:** Buttons, inputs, and cards use the 4px radius.
- **Terminal Panes:** May use 0px (sharp) on internal divisions to maintain the rigid "grid" aesthetic while keeping external container corners at 4px.
- **Status Pips:** Small indicators for "Online" or "Processing" are pure circles to stand out against the otherwise geometric and rectangular environment.

## Components

### Buttons
- **Primary:** Solid White background with Black text. No shadow, 4px radius.
- **Ghost:** Transparent background with 1px white border (15% opacity). Text in white.
- **Action Icons:** 32x32px hit area, icons in Slate Gray, turning White on hover.

### Terminal Panes (Cards)
- **Header:** Slate background (#1E293B at 40% opacity), JetBrains Mono label in caps. 
- **Body:** JetBrains Mono text, high contrast against #0A0A0A background.
- **Scrollbars:** Custom minimal styling—thin, dark gray tracks with slightly lighter gray thumbs.

### Inputs & Terminal Prompts
- **Inputs:** Subdued borders that glow slightly (soft white) when focused. 
- **Prompt:** Use a `>` character prefix in JetBrains Mono to signify an active command line.

### Chips & Badges
- Used for agent tags or status. These are small, 0.25rem rounded, with low-saturation backgrounds (e.g., Dark Slate for "Idle", Dim Emerald for "Active").

### Navigation
- A thin top-bar for global orchestration controls and a vertical slim-sidebar for workspace switching. Both use glassmorphism and backdrop blurs to feel integrated into the background environment.