export const foundationTokens = {
  color: {
    bg: "270 50% 10%",
    text: "210 40% 98%",
    primary: "271 76% 53%",
    border: "217.2 32.6% 17.5%",
    success: "149 61% 47%",
    warning: "38 92% 50%",
    danger: "0 84.2% 60.2%",
  },
  typography: {
    family: {
      sans: "Inter, sans-serif",
    },
    size: {
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    lineHeight: {
      tight: 1.15,
      normal: 1.5,
      relaxed: 1.7,
    },
  },
  space: {
    1: "0.25rem",
    2: "0.5rem",
    3: "0.75rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    8: "2rem",
    10: "2.5rem",
    12: "3rem",
  },
  radius: {
    sm: "0.375rem",
    md: "0.75rem",
    lg: "1.25rem",
  },
  shadow: {
    1: "0 2px 8px rgba(14, 8, 32, 0.18)",
    2: "0 8px 18px rgba(20, 10, 46, 0.24)",
    3: "0 16px 30px rgba(21, 10, 52, 0.3)",
    4: "0 24px 44px rgba(15, 8, 40, 0.38)",
  },
  motion: {
    duration: {
      fast: "120ms",
      med: "220ms",
      slow: "320ms",
    },
    easing: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
    },
  },
  hitArea: {
    min: "44px",
  },
} as const;

export type FoundationTokens = typeof foundationTokens;
