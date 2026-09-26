package dev.donuthud;

/** HUD colour themes. Custom uses the colour set with /donuthud color. */
public enum Theme {
	DIAMOND("Diamond", 0x55FFFF),
	DONUT("Donut", 0xFF7EB6),
	EMERALD("Emerald", 0x5CFF8A),
	GOLD("Gold", 0xFFC940),
	AMETHYST("Amethyst", 0xC58CFF),
	REDSTONE("Redstone", 0xFF5A5A),
	SNOW("Snow", 0xEEF2FF),
	CUSTOM("Custom", 0x55FFFF);

	public final String label;
	private final int accent;

	Theme(String label, int accent) {
		this.label = label;
		this.accent = accent;
	}

	/** The accent colour as 0xRRGGBB. */
	public int accent(HudConfig config) {
		return this == CUSTOM ? config.customColor & 0xFFFFFF : accent;
	}

	public Theme next() {
		return values()[(ordinal() + 1) % values().length];
	}

	public static Theme byName(String name) {
		for (Theme t : values()) if (t.name().equalsIgnoreCase(name)) return t;
		return DIAMOND;
	}
}
