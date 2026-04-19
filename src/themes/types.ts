export type ThemeName = "web" | "android" | "ios";

export type CssVarMap = Record<`--${string}`, string>;

export interface AppTheme {
  name: ThemeName;
  cssVars: CssVarMap;
}

