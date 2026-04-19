import { foundationTokens } from "../tokens";
import type { AppTheme } from "./types";

export const androidTheme: AppTheme = {
  name: "android",
  cssVars: {
    "--background": foundationTokens.color.bg,
    "--foreground": foundationTokens.color.text,
    "--primary": "272 82% 58%",
    "--primary-foreground": "210 40% 98%",
    "--secondary": "268 42% 18%",
    "--secondary-foreground": "210 40% 98%",
    "--muted": "266 30% 16%",
    "--muted-foreground": "220 18% 72%",
    "--accent": "267 33% 20%",
    "--accent-foreground": "210 40% 98%",
    "--destructive": foundationTokens.color.danger,
    "--destructive-foreground": "210 40% 98%",
    "--border": "262 26% 25%",
    "--input": "262 26% 25%",
    "--ring": "272 82% 58%",
    "--card": "262 58% 11%",
    "--card-foreground": "210 40% 98%",
    "--popover": "262 58% 11%",
    "--popover-foreground": "210 40% 98%",
    "--radius": "0.875rem",
    "--platform-card-radius": "1.125rem",
    "--platform-surface-shadow": foundationTokens.shadow[2],
    "--platform-touch-target": foundationTokens.hitArea.min,
  },
};

