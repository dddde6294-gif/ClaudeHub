package dev.donuthud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.StyleSpriteSource;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** Draws the HUD panel: a pickaxe row for /ah and a diamond row for /orders. */
public final class HudRenderer {
	private HudRenderer() {
	}

	private static final StyleSpriteSource XUONG = new StyleSpriteSource.Font(Identifier.of(DonutHud.MOD_ID, "xuong"));
	private static final ItemStack PICKAXE = new ItemStack(Items.DIAMOND_PICKAXE);
	private static final ItemStack DIAMOND = new ItemStack(Items.DIAMOND);

	// Layout before scaling, in GUI pixels.
	private static final int PAD = 7;
	private static final int ICON = 16;
	private static final int GAP = 7;
	private static final int HEADER = 13;
	private static final int ROW = 25;
	private static final int DIVIDER = 5;
	private static final int MIN_WIDTH = 124;
	private static final float BIG = 1.5f;
	private static final float SMALL = 0.75f;
	private static final float TITLE = 0.85f;
	private static final float DELTA = 0.85f;
	private static final long FLASH_MS = 1500;

	private static final int BASE = 0x0D0B14;
	private static final int MUTED = 0xFFB4AEC4;
	private static final int SOFT = 0xFFD9D3E8;
	private static final int FRESH = 0xFF5CFF8A;
	private static final int AGING = 0xFFFFD84A;
	private static final int STALE = 0xFFFF6B6B;

	/** The HUD's size on screen, after scaling. */
	public record Box(int width, int height) {
	}

	private record Row(ItemStack icon, String price, String label, HudConfig.Reading reading) {
	}

	private static Row[] rows(HudConfig config) {
		HudConfig.Reading pick = config.pickaxe;
		HudConfig.Reading order = config.diamondOrder;
		return new Row[] {
			new Row(PICKAXE, pick == null ? "—" : Prices.format(pick.price), pick == null ? "OPEN /AH TO CHECK" : "LOWEST ON /AH", pick),
			new Row(DIAMOND, order == null ? "—" : Prices.format(order.price), order == null ? "OPEN /ORDERS TO CHECK" : "BEST /ORDERS EACH", order),
		};
	}

	private static Text text(HudConfig config, String s) {
		MutableText t = Text.literal(s);
		return config.xuongFont ? t.setStyle(Style.EMPTY.withFont(XUONG)) : t;
	}

	private static int width(TextRenderer font, HudConfig config, String s, float scale) {
		return (int) Math.ceil(font.getWidth(text(config, s)) * scale);
	}

	/** "▲ 10.9%" against the check before, or "" when there's nothing to compare. */
	private static String delta(Row row) {
		HudConfig.Reading r = row.reading;
		if (r == null || r.previous == null || r.previous <= 0) return "";
		double pct = (r.price - r.previous) / r.previous * 100;
		if (Math.abs(pct) < 0.05) return "";
		return (pct > 0 ? "▲ " : "▼ ") + String.format(java.util.Locale.ROOT, Math.abs(pct) < 10 ? "%.1f%%" : "%.0f%%", Math.abs(pct));
	}

	private static int priceWidth(TextRenderer font, HudConfig config, Row row) {
		String d = delta(row);
		return width(font, config, row.price, BIG) + (d.isEmpty() ? 0 : 5 + width(font, config, d, DELTA));
	}

	/** Fades from white to the accent colour just after a price changes. */
	private static int priceColor(int accent, HudConfig.Reading r, long now) {
		long since = now - r.changedAt;
		if (r.changedAt == 0 || since >= FLASH_MS) return withAlpha(accent, 255);
		float t = since / (float) FLASH_MS;
		int red = Math.round(255 + (((accent >> 16) & 0xFF) - 255) * t);
		int green = Math.round(255 + (((accent >> 8) & 0xFF) - 255) * t);
		int blue = Math.round(255 + ((accent & 0xFF) - 255) * t);
		return 0xFF000000 | (red << 16) | (green << 8) | blue;
	}

	private static String subline(Row row, long now) {
		return row.reading == null ? row.label : row.label + "  ·  " + Prices.ago(now - row.reading.seenAt);
	}

	private static int innerWidth(TextRenderer font, HudConfig config, long now) {
		int w = width(font, config, "DONUT HUD", TITLE) + 14;
		for (Row row : rows(config)) {
			int text = Math.max(priceWidth(font, config, row), width(font, config, subline(row, now), SMALL));
			w = Math.max(w, ICON + GAP + text);
		}
		return Math.max(MIN_WIDTH - 2 * PAD, w);
	}

	private static int rawHeight() {
		return PAD + HEADER + ROW * 2 + DIVIDER + PAD - 3;
	}

	public static Box size(MinecraftClient client, HudConfig config, long now) {
		int w = innerWidth(client.textRenderer, config, now) + 2 * PAD;
		return new Box((int) Math.ceil(w * config.scale), (int) Math.ceil(rawHeight() * config.scale));
	}

	/** Where the HUD goes on a screen of this size, from the saved position. */
	public static int[] position(Box box, int screenWidth, int screenHeight, HudConfig config) {
		int x = (int) Math.round(config.x * Math.max(0, screenWidth - box.width()));
		int y = (int) Math.round(config.y * Math.max(0, screenHeight - box.height()));
		return new int[] {x, y};
	}

	private static int freshness(long age) {
		return age < 2 * 60_000 ? FRESH : age < 10 * 60_000 ? AGING : STALE;
	}

	private static int withAlpha(int rgb, int alpha) {
		return (Math.max(0, Math.min(255, alpha)) << 24) | (rgb & 0xFFFFFF);
	}

	/** The in-game HUD element. */
	public static void renderHud(DrawContext context, RenderTickCounter tickCounter) {
		MinecraftClient client = MinecraftClient.getInstance();
		HudConfig config = DonutHud.config();
		if (!config.enabled || client.options.hudHidden || client.currentScreen instanceof HudEditScreen || !DonutHud.onDonut(client)) return;
		long now = System.currentTimeMillis();
		Box box = size(client, config, now);
		int[] p = position(box, context.getScaledWindowWidth(), context.getScaledWindowHeight(), config);
		draw(context, client, config, p[0], p[1], now);
	}

	public static void draw(DrawContext context, MinecraftClient client, HudConfig config, int x, int y, long now) {
		TextRenderer font = client.textRenderer;
		int accent = config.theme().accent(config);
		int w = innerWidth(font, config, now) + 2 * PAD;
		int h = rawHeight();
		int bgAlpha = Math.round(config.background * 2.55f);

		var m = context.getMatrices();
		m.pushMatrix();
		m.translate(x, y);
		m.scale(config.scale, config.scale);

		// Panel with clipped corners, a glow from the top and a bright accent edge.
		context.fill(1, 0, w - 1, h, withAlpha(BASE, bgAlpha));
		context.fill(0, 1, 1, h - 1, withAlpha(BASE, bgAlpha));
		context.fill(w - 1, 1, w, h - 1, withAlpha(BASE, bgAlpha));
		context.fillGradient(1, 2, w - 1, h / 2, withAlpha(accent, bgAlpha / 5), withAlpha(accent, 0));
		context.fill(1, 0, w - 1, 2, withAlpha(accent, 255));
		context.fill(0, 1, 1, h - 1, withAlpha(accent, 70));
		context.fill(w - 1, 1, w, h - 1, withAlpha(accent, 70));
		context.fill(1, h - 1, w - 1, h, withAlpha(accent, 70));

		// Header: the name, and a dot that shows how fresh the newest price is.
		drawScaled(context, font, text(config, "DONUT HUD"), PAD, PAD - 1, TITLE, withAlpha(accent, 255));
		long newest = Math.max(config.pickaxe == null ? 0 : config.pickaxe.seenAt, config.diamondOrder == null ? 0 : config.diamondOrder.seenAt);
		int dot = newest == 0 ? MUTED : freshness(now - newest);
		context.fill(w - PAD - 4, PAD + 1, w - PAD, PAD + 5, dot);

		int top = PAD + HEADER;
		Row[] rows = rows(config);
		for (int i = 0; i < rows.length; i++) {
			Row row = rows[i];
			if (i > 0) {
				context.fill(PAD, top + 1, w - PAD, top + 2, withAlpha(accent, 45));
				top += DIVIDER;
			}
			context.drawItem(row.icon, PAD, top + (ROW - ICON) / 2 - 2);
			int tx = PAD + ICON + GAP;
			drawScaled(context, font, text(config, row.price), tx, top, BIG, row.reading == null ? MUTED : priceColor(accent, row.reading, now));
			String d = delta(row);
			if (!d.isEmpty()) drawScaled(context, font, text(config, d), tx + width(font, config, row.price, BIG) + 5, top + 4, DELTA, SOFT);
			int sy = top + 15;
			drawScaled(context, font, text(config, row.label), tx, sy, SMALL, MUTED);
			if (row.reading != null) {
				// The age is coloured by how fresh it is: green, then yellow, then red.
				long age = now - row.reading.seenAt;
				int sepX = tx + width(font, config, row.label, SMALL);
				drawScaled(context, font, text(config, "  ·  "), sepX, sy, SMALL, MUTED);
				int ageX = sepX + width(font, config, "  ·  ", SMALL);
				drawScaled(context, font, text(config, Prices.ago(age)), ageX, sy, SMALL, freshness(age));
			}
			top += ROW;
		}
		m.popMatrix();
	}

	private static void drawScaled(DrawContext context, TextRenderer font, Text text, int x, int y, float scale, int color) {
		var m = context.getMatrices();
		m.pushMatrix();
		m.translate(x, y);
		m.scale(scale, scale);
		context.drawText(font, text, 0, 0, color, true);
		m.popMatrix();
	}
}
