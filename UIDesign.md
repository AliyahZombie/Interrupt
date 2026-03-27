# UI Design Guidelines & Component Library

This document outlines the design philosophy, core visual tokens, and reusable component library for the Survivor game project. Following these guidelines ensures a consistent, immersive Cyberpunk/Sci-Fi aesthetic across all current and future UI developments.

---

## 1. Core Aesthetic & Philosophy

The UI is designed to feel like a **tactical, retro-futuristic heads-up display (HUD)** or a **hacker's terminal**. 
- **No soft curves**: We avoid rounded corners (`rounded-md`, `rounded-full`) in favor of sharp, chamfered (cut) corners.
- **High Contrast**: Deep black/dark backgrounds contrasted with highly saturated neon accents.
- **Layered Depth**: Use of semi-transparent black backgrounds with background blur (`backdrop-blur`) to overlay UI on top of the game canvas without completely obscuring it.
- **Digital Artifacts**: Intentional use of scanlines, grid patterns, and glitch effects to simulate digital screens.

---

## 2. Design Tokens

### Typography
We use two primary font families, configured in Tailwind:
- **Primary/Headings (`font-sans`)**: `Space Grotesk`. Used for large titles, body text, and primary reading material. Feels modern and geometric.
- **Technical/Data (`font-mono`)**: `JetBrains Mono`. Used for labels, numbers, stats, and small UI elements. Always use with `uppercase` and `tracking-widest` for that "system terminal" look.

### Color Palette
Defined in `src/index.css`. Always use these semantic colors instead of arbitrary hex codes:
- **Backgrounds**: `--color-cyber-bg` (`#050505`), `--color-cyber-panel` (`rgba(10, 10, 15, 0.85)`).
- **Neon Accents**:
  - Cyan (`#06b6d4`): Primary interactive color, safe state, standard system text.
  - Red (`#ef4444`): Danger, enemy, system failure, destructive actions.
  - Yellow (`#eab308`): Warnings, energy, special items.
  - Purple (`#a855f7`): Epic items, rare elements.
  - Blue (`#3b82f6`): Secondary interactive elements, player dash.

### Visual Effects (CSS Classes)
- **Chamfered Corners**: Apply `.clip-chamfer` (15px cut) for large containers or `.clip-chamfer-sm` (8px cut) for small elements like badges and inputs.
- **Glow**: Use `.text-glow-cyan`, `.text-glow-red`, `.border-glow-cyan`, or `.border-glow-red` to make elements emit light.
- **Scanlines**: Add `.bg-scanlines` to a container (usually an absolute overlay with low opacity like `opacity-20`) to create CRT monitor lines.

---

## 3. Component Library Reference

All UI components are exported from `src/components/ui/index.ts`. Always prefer using these over building custom HTML elements.

### 3.1 CyberPanel
The base container for any UI card, menu, or modal.
```tsx
import { CyberPanel } from './ui';

// Variants: 'cyan' | 'red' | 'neutral'
<CyberPanel variant="cyan" className="w-96">
  Content goes here...
</CyberPanel>
```

### 3.2 CyberText & CyberGlitchText
Standardized typography components.
```tsx
import { CyberText, CyberGlitchText } from './ui';

// Standard Text (Variants: h1, h2, h3, body, label)
<CyberText variant="h1" color="cyan" glow>MAIN TITLE</CyberText>
<CyberText variant="label" color="neutral">SYSTEM STATUS</CyberText>

// Glitch Text (Animated)
<CyberGlitchText text="SYSTEM COMPROMISED" color="red" />
```

### 3.3 CyberButton
Interactive buttons with hover states and scanline overlays.
```tsx
import { CyberButton } from './ui';

// Variants: 'primary' | 'danger' | 'ghost'
<CyberButton variant="primary" onClick={handleStart}>
  INITIALIZE
</CyberButton>
```

### 3.4 CyberBadge
Small status indicators.
```tsx
import { CyberBadge } from './ui';

// Variants: 'cyan' | 'red' | 'yellow' | 'purple' | 'neutral'
<CyberBadge variant="red" glow>DANGER</CyberBadge>
```

### 3.5 CyberProgressBar
For health, shields, experience, or loading states.
```tsx
import { CyberProgressBar } from './ui';

<CyberProgressBar 
  value={75} 
  max={100} 
  variant="cyan" 
  label="SHIELD INTEGRITY" 
  showValue 
/>
```

### 3.6 CyberInput
Form inputs with cyber styling and error states.
```tsx
import { CyberInput } from './ui';

<CyberInput 
  label="ACCESS KEY" 
  type="password" 
  placeholder="Enter key..." 
  error="Invalid credentials" 
/>
```

### 3.7 CyberModal
A complete modal overlay with backdrop blur, title, and action buttons.
```tsx
import { CyberModal, CyberButton } from './ui';

<CyberModal 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)} 
  title="SETTINGS"
  variant="cyan"
  actions={<CyberButton variant="ghost">CLOSE</CyberButton>}
>
  Modal content here...
</CyberModal>
```

---

## 4. Guidelines for Future Development

To maintain a unified UI style as the project grows, strictly adhere to the following rules:

### Rule 1: No Border Radius
**Never use Tailwind's `rounded-*` classes.** The cyber aesthetic relies on sharp, angular geometry. 
*How to enforce:* If you need a non-rectangular shape, use the custom `.clip-chamfer` or `.clip-chamfer-sm` utility classes defined in `index.css`.

### Rule 2: Typography Hierarchy
- **Data is Monospace**: Any dynamic number (score, HP, ammo), system label, or small metadata must use `font-mono uppercase tracking-widest`.
- **Prose is Sans-Serif**: Paragraphs, descriptions, and large titles should use `font-sans`.

### Rule 3: Intentional Layering
When building new overlays (like an inventory screen or pause menu):
1. Start with a dark, blurred backdrop: `bg-black/60 backdrop-blur-sm`.
2. Place a `CyberPanel` in the center.
3. Ensure the panel has a subtle border (`border-cyan-500/50`) to separate it from the background.

### Rule 4: Restrained use of Glow
Glow effects (`glow` prop or `.text-glow-*`) are visually heavy. 
- **Do**: Use glow for active states, critical warnings, main titles, or hovered buttons.
- **Don't**: Apply glow to body text, disabled elements, or every single badge on the screen. Too much glow creates visual noise and reduces readability.

### Rule 5: Component Composition
If you need a new complex UI element (e.g., a Player Stats Card), compose it using existing primitives:
```tsx
// Example of composing a new UI element
<CyberPanel variant="neutral" className="p-4">
  <CyberText variant="label" color="cyan">PLAYER_01</CyberText>
  <div className="mt-4 space-y-2">
    <CyberProgressBar value={hp} max={maxHp} variant="cyan" label="HP" />
    <CyberProgressBar value={energy} max={maxEnergy} variant="yellow" label="ENG" />
  </div>
</CyberPanel>
```

---

## 5. UI ↔ Engine Data Flow (Architecture Rule)

The React layer should **not poll** engine state on an interval.

- Prefer subscribing to the engine’s UI snapshot via React 18 `useSyncExternalStore`.
- `GameEngine` exposes:
  - `subscribeUi(listener): () => void`
  - `getUiSnapshot(): EngineUiSnapshot`

Use this for overlay state that must remain consistent with engine actions (e.g. weapon slots / active weapon / nearby interactables), while keeping the frame-by-frame simulation inside the canvas engine.
