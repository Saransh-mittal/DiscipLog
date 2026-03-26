# Momentum Integration Guide

How to build dashboard components that auto-adapt to the active world tier.

## Quick Start

### Option A: Use `<WorldCard>` (recommended for card-based components)

```tsx
import WorldCard from "@/components/WorldCard";

function MyComponent() {
  return (
    <WorldCard className="relative overflow-hidden" style={{ padding: 0 }}>
      <div className="p-6">{/* content */}</div>
    </WorldCard>
  );
}
```

`WorldCard` auto-applies:
- World-tier background, border, shadow, border-radius
- Hover lift, glow, ripple (based on micro-interaction unlocks)
- Card entrance animations

### Option B: Use `--world-*` CSS variables (for CSS-only components)

```css
.my-component {
  background: var(--world-surface, var(--v2-surface));
  border: 1px solid var(--world-border, oklch(1 0 0 / 6%));
  border-radius: var(--world-border-radius, 14px);
  color: var(--world-text-primary, var(--v2-text-primary));
}
```

Available vars: `--world-surface`, `--world-surface-raised`, `--world-border`,
`--world-border-radius`, `--world-shadow`, `--world-shadow-card`,
`--world-text-primary`, `--world-text-secondary`, `--world-text-muted`,
`--world-accent`, `--world-accent-glow`, `--world-spacing`,
`--world-header-bg`, `--world-header-border`, `--world-tab-*`.

### Option C: Use `useMomentumClasses()` (for complex interactive components)

```tsx
import { useMomentumClasses } from "@/hooks/useMomentumClasses";

function MyComponent() {
  const { cardClasses, entranceClass, allClasses, microInteractions } = useMomentumClasses();
  // cardClasses = "world-card world-hover-lift world-hover-glow ..."
  // entranceClass = "entrance-slide-up"
  return <div className={`my-wrapper ${allClasses}`}>…</div>;
}
```

## How It Works

1. `MomentumProvider` computes `streakPower` + `dailyEnergy` + `microInteractions`
2. `WorldRenderer` selects the world skin and **injects all theme values as `--world-*` CSS custom properties on `:root`**
3. Each world's `CardSkin` applies tier-specific colors + micro-interaction CSS classes
4. `WorldCard` is a thin wrapper that delegates to the active `CardSkin`

## Architecture

```
MomentumProvider (data)
  └─ WorldRenderer (skin selection + CSS var injection)
       └─ WorldCard / CardSkin (per-component theming)
```
