import { foundationTokens } from "../tokens";
import type { AppTheme } from "./types";

export const webTheme: AppTheme = {
  name: "web",
  cssVars: {
    "--background": foundationTokens.color.bg,
    "--foreground": foundationTokens.color.text,
    "--primary": foundationTokens.color.primary,
    "--primary-foreground": "210 40% 98%",
    "--secondary": "270 50% 96%",
    "--secondary-foreground": "222.2 47.4% 11.2%",
    "--muted": "217.2 32.6% 17.5%",
    "--muted-foreground": "215 20.2% 65.1%",
    "--accent": "217.2 32.6% 17.5%",
    "--accent-foreground": "210 40% 98%",
    "--destructive": foundationTokens.color.danger,
    "--destructive-foreground": "210 40% 98%",
    "--border": foundationTokens.color.border,
    "--input": foundationTokens.color.border,
    "--ring": foundationTokens.color.primary,
    "--card": "222.2 84% 4.9%",
    "--card-foreground": "210 40% 98%",
    "--popover": "222.2 84% 4.9%",
    "--popover-foreground": "210 40% 98%",
    "--radius": foundationTokens.radius.md,
    "--platform-card-radius": "1.5rem",
    "--platform-surface-shadow": foundationTokens.shadow[3],
    "--platform-touch-target": foundationTokens.hitArea.min,
  },
};

