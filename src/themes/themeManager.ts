import { androidTheme } from "./android";
import { iosTheme } from "./ios";
import type { AppTheme, ThemeName } from "./types";
import { webTheme } from "./web";

const THEME_STORAGE_KEY = "fatopago:theme";

const THEMES: Record<ThemeName, AppTheme> = {
  web: webTheme,
  android: androidTheme,
  ios: iosTheme,
};

export interface ThemeInitOptions {
  forcedTheme?: ThemeName;
  emulateNativeOnMobileWeb?: boolean;
  userAgent?: string;
}

const isIOS = (ua: string) => /iPhone|iPad|iPod/i.test(ua);
const isAndroid = (ua: string) => /Android/i.test(ua);

export const resolveThemeName = (options: ThemeInitOptions = {}): ThemeName => {
  if (options.forcedTheme) return options.forcedTheme;

  if (typeof window === "undefined") return "web";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
  if (savedTheme && savedTheme in THEMES) return savedTheme;

  if (!options.emulateNativeOnMobileWeb) return "web";

  const ua = options.userAgent ?? window.navigator.userAgent;
  if (isIOS(ua)) return "ios";
  if (isAndroid(ua)) return "android";
  return "web";
};

export const applyTheme = (themeName: ThemeName): void => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const theme = THEMES[themeName];

  Object.entries(theme.cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.dataset.theme = theme.name;
  root.dataset.platform = theme.name;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.name);
  }
};

export const initializeTheme = (options: ThemeInitOptions = {}): ThemeName => {
  const themeName = resolveThemeName(options);
  applyTheme(themeName);
  return themeName;
};

