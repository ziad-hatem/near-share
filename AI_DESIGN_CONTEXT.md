# AI Design Context & Style Guide

This document is designed to help an AI agent replicate the design system, visual identity, and coding patterns of this project in a new environment.

## 1. Tech Stack & Core Dependencies

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Animation**: 
  - `framer-motion` (Declarative animations)
  - `gsap` (Complex sequencing)
  - `lenis` (Smooth scrolling)
- **Icons**: `lucide-react`
- **Utilities**: `clsx`, `tailwind-merge`

## 2. Visual Identity

### Color Palette (Dark Theme Default)
The design relies on a deep, rich dark mode with neon accents.

| Role | Token Name | Value (HSL / Description) | Usage |
|------|------------|---------------------------|-------|
| **Background** | `--background` | `240 29% 14%` (Deep Indigo-Black) | Main page background |
| **Foreground** | `--foreground` | `0 0% 94%` (Off-White) | Primary text |
| **Card** | `--card` | `240 29% 21%` | Surface background |
| **Accent** | `--accent` | `167 100% 48%` (Neon Teal/Green) | Highlights, Active states |
| **Muted** | `--muted-foreground`| `0 0% 66%` | Secondary text |
| **Border** | `--border` | `0 0% 100% / 0.1` (10% White) | Subtle dividers |

### Typography
- **Font**: Inter (Google Fonts)
- **Weights**: 400 (Body), 500 (Headings/Buttons)
- **Scaling**: Standard Tailwind scale. H1 is typically `text-2xl` or larger.

### Shape & Structure
- **Radius**: `rounded-xl` (approx 12px/0.75rem) is the standard for cards and inputs.
- **Glassmorphism**: A core design trait.
  - **Basic**: `bg-white/5` or `bg-black/20` with `backdrop-blur-md` (or `xl`).
  - **Advanced**: Custom SVG Displacement filters (see `GlassSurface` pattern below) for liquid/refractive glass effects.

## 3. Key Component Patterns

### 1. Button / Interactive Elements
Buttons often feature heavy usage of hover states, transitions, and glow effects.

```tsx
<button className="px-4 py-2 bg-accent text-accent-foreground rounded-lg font-medium hover:brightness-110 transition-all">
  Action
</button>
```

### 2. Form Inputs (`StyledInput`)
Inputs use a translucent dark background with subtle borders and focus rings.

- **Background**: `bg-zinc-900/50`
- **Border**: `border-zinc-800`
- **Focus**: `ring-2 ring-blue-500/50` (or accent color)
- **Text**: White with `placeholder-zinc-600`
- **Transition**: `transition-all`

### 3. Glass Card Pattern
Used for generic containers, stats, or content blocks.

```tsx
<div className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-2xl relative overflow-hidden">
  {/* Content */}
</div>
```

### 4. Advanced "GlassSurface"
For hero sections or primary focal points, use a custom component that mimics optical refraction using SVG filters. 

**Core props:** `opacity: 0.93`, `blur: 11`, `distortionScale: -180`.

## 4. Animation Guidelines

1.  **Micro-interactions**: Use `transition-all duration-200` on interactive elements (hover, focus).
2.  **Page Load**: Elements should stagger in using `framer-motion`.
    - `initial={{ opacity: 0, y: 20 }}`
    - `animate={{ opacity: 1, y: 0 }}`
3.  **Scroll**: Use `lenis` for smooth scrolling inertia.

## 5. Layout Patterns

- **Container**: Centered, max-width constrained for readability.
- **Grid/Flex**: Heavy use of `flex` for alignment and `grid` for card layouts.
- **Spacing**: Generous spacing (`gap-6`, `p-6`, `py-12`) to let the design breathe.

## 6. Implementation Rules for the Agent

1.  **Always use `tailwind-merge`**: When building reusable components, ensure classes can be overridden.
2.  **Client Components**: Mark interactive components (using hooks) with `"use client";`.
3.  **Dark Mode First**: The design is primarily dark mode. Ensure all standard colors look good on dark backgrounds.
4.  **Aesthetics**: Prioritize "Premium" feel. Avoid flat, solid colors for large surfaces; use gradients or glass effects instead.
