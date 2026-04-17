// Litro brand colors
export const colors = {
  green: '#1A8A6F',   // primary
  gold: '#F2C94C',    // reward — use once per design
  ink: '#0D1F1A',     // text on light
  pale: '#F5FAF8',    // light text / backgrounds
  dark: '#071812',    // signature dark background
  grey: '#8A9E98',    // muted / disabled
  red: '#D94F4F',     // error / out of stock
  yellow: '#E8A838',  // warning stock
} as const

// Stock level colors (numerical mode)
export const stockColors = {
  green: colors.green,   // > 50%
  yellow: colors.yellow, // 20-50%
  red: colors.red,       // < 20%
  grey: colors.grey,     // 0
} as const

export const fonts = {
  headline: 'BricolageGrotesque',
  body: 'DMSans',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const
