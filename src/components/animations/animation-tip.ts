// Behavior for AnimationTip.astro. Dismissing any tip, or opening the theme
// menu, hides every tip for good.

const STORAGE_KEY = "animation-tip";
let dismissed = readDismissed();
const tips = new Set<HTMLElement>();

function readDismissed() {
	try {
		return localStorage.getItem(STORAGE_KEY) === "dismissed";
	} catch {
		return false;
	}
}

function dismissAll() {
	if (dismissed) return;
	dismissed = true;
	for (const tip of tips) tip.hidden = true;
	try {
		localStorage.setItem(STORAGE_KEY, "dismissed");
	} catch {
		// Storage blocked; the tips stay hidden for this page view.
	}
}

// Finding the menu any other way also counts as having seen the tip.
document.getElementById("theme-menu")?.addEventListener("toggle", (event) => {
	if ((event as ToggleEvent).newState === "open") dismissAll();
});

/**
 * Wire up the tip for `animation`. `mascot` is the button for the character
 * the tip points at; focus moves there when the tip is dismissed from the
 * keyboard. Returns a function to call when the mascot starts (`true`) or
 * stops (`false`) peeking.
 */
export function setupAnimationTip(
	animation: string,
	mascot: HTMLButtonElement,
): (peeking: boolean) => void {
	const tip = document.querySelector<HTMLElement>(
		`[data-animation-tip="${animation}"]`,
	)!;
	tips.add(tip);

	function dismiss() {
		// Don't strand keyboard focus on a hidden element.
		const hadFocus = tip.contains(document.activeElement);
		dismissAll();
		if (hadFocus && !mascot.hidden) mascot.focus();
	}

	tip.querySelector(".animation-tip-close")!.addEventListener("click", dismiss);
	tip.addEventListener("keydown", (event) => {
		if (event.key === "Escape") dismiss();
	});
	tip.querySelector(".animation-tip-open")!.addEventListener("click", () => {
		// A closing popover returns focus to whatever had it before it opened, and
		// the tip is hidden by then. Focus the theme button first so focus lands
		// there, then put it on the animation switch.
		const themeButton =
			document.querySelector<HTMLButtonElement>(".theme-button");
		themeButton?.focus();
		themeButton?.click();
		document
			.querySelector<HTMLInputElement>('#theme-menu input[name="animations"]')
			?.focus();
	});

	return (peeking) => (tip.hidden = dismissed || !peeking);
}
