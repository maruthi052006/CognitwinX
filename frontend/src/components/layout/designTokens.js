/**
 * Centralized Design System Tokens for CognitwinX
 * Strict 8px-based spacing scale, documented z-index hierarchy,
 * and unified glassmorphic style tokens.
 */

export const spacingScale = {
  xs: '4px',    // 0.5 (4px)
  sm: '8px',    // 1   (8px base)
  md: '16px',   // 2   (16px)
  lg: '24px',   // 3   (24px)
  xl: '32px',   // 4   (32px)
  '2xl': '48px', // 6  (48px)
  '3xl': '64px', // 8  (64px)
};

export const spacingClasses = {
  padding: {
    none: 'p-0',
    xs: 'p-1',     // 4px
    sm: 'p-2',     // 8px
    md: 'p-4',     // 16px
    lg: 'p-6',     // 24px
    xl: 'p-8',     // 32px
  },
  gap: {
    none: 'gap-0',
    xs: 'gap-1',   // 4px
    sm: 'gap-2',   // 8px
    md: 'gap-4',   // 16px
    lg: 'gap-6',   // 24px
    xl: 'gap-8',   // 32px
  },
  margin: {
    none: 'm-0',
    xs: 'm-1',     // 4px
    sm: 'm-2',     // 8px
    md: 'm-4',     // 16px
    lg: 'm-6',     // 24px
    xl: 'm-8',     // 32px
  }
};

export const zIndexHierarchy = {
  modal: 1000,
  toast: 900,
  chat: 800,
  banner: 700,
  navbar: 600,
  dropdown: 550,
  tooltip: 500,
  content: 10,
  base: 0,
};

export const borderRadius = {
  sm: 'rounded-lg',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
  full: 'rounded-full',
};

export const themeColors = {
  bgPrimary: '#070b14',
  bgPanel: 'rgba(15, 23, 42, 0.75)',
  cyanAccent: '#06b6d4',
  blueAccent: '#3b82f6',
  borderDefault: 'border-cyan-500/20',
  borderGlow: 'border-cyan-400/40',
};

export default {
  spacingScale,
  spacingClasses,
  zIndexHierarchy,
  borderRadius,
  themeColors,
};
