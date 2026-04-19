import { foundationTokens } from "../tokens";
import type { AppTheme } from "./types";

export const iosTheme: AppTheme = {
  name: "ios",
  cssVars: {
    "--background": foundationTokens.color.bg,
    "--foreground": foundationTokens.color.text,
    "--primary": "275 79% 62%",
    "--primary-foreground": "210 40% 98%",
    "--secondary": "271 35% 19%",
    "--secondary-foreground": "210 40% 98%",
    "--muted": "267 26% 18%",
    "--muted-foreground": "220 17% 74%",
    "--accent": "271 32% 22%",
    "--accent-foreground": "210 40% 98%",
    "--destructive": foundationTokens.color.danger,
    "--destructive-foreground": "210 40% 98%",
    "--border": "266 24% 29%",
    "--input": "266 24% 29%",
    "--ring": "275 79% 62%",
    "--card": "263 54% 12%",
    "--card-foreground": "210 40% 98%",
    "--popover": "263 54% 12%",
    "--popover-foreground": "210 40% 98%",
    "--radius": "1rem",
    "--platform-card-radius": "1.375rem",
    "--platform-surface-shadow": foundationTokens.shadow[1],
    "--platform-touch-target": foundationTokens.hitArea.min,
  },
};

