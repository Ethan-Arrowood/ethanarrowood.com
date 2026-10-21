export type ColorScheme = "light" | "dark";

export type BackgroundAnimation = "falling-leaves";

export interface Theme {
	id: string;
	label: string;
	/** Standard themes are always available; special themes are seasonal or just for fun. */
	group: "standard" | "special";
	/** Drives `color-scheme`, syntax highlighting, and other light/dark variants. */
	scheme: ColorScheme;
	/** Optional background animation, shown when the visitor has animations enabled. */
	animation?: BackgroundAnimation;
}

export const themes: Theme[] = [
	{ id: "light", label: "Light", group: "standard", scheme: "light" },
	{ id: "dark", label: "Dark", group: "standard", scheme: "dark" },
	{
		id: "spooky",
		label: "Spooky",
		group: "special",
		scheme: "dark",
		animation: "falling-leaves",
	},
];

/** Stored preferences. `system` follows `prefers-color-scheme`. */
export const THEME_STORAGE_KEY = "theme";
export const ANIMATIONS_STORAGE_KEY = "animations";

export interface ThemePreferences {
	theme: "system" | Theme["id"];
	animations: boolean;
}

/** Defined by the inline script in `ThemeInit.astro`. */
export interface SiteThemeApi {
	themes: Theme[];
	getPreferences(): ThemePreferences;
	setTheme(value: ThemePreferences["theme"]): void;
	setAnimations(enabled: boolean): void;
	current(): Theme;
}

declare global {
	interface Window {
		siteTheme: SiteThemeApi;
	}
	interface DocumentEventMap {
		"site-theme-change": CustomEvent<{
			theme: Theme;
			preferences: ThemePreferences;
		}>;
	}
}
