package dev.donuthud;

import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.input.KeyInput;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

/** Drag the HUD where you want it, and pick its colour, size, background and font. */
public final class HudEditScreen extends Screen {
	private static final int MARGIN = 4;
	private static final int SNAP = 6;
	private static final float[] SIZES = {0.75f, 1.0f, 1.25f, 1.5f, 2.0f};
	private static final int[] BACKGROUNDS = {0, 35, 60, 75, 90};

	private final Screen parent;
	private final HudConfig config = DonutHud.config();
	private boolean dragging;
	private double grabX;
	private double grabY;
	private boolean centeredX;
	private boolean centeredY;
	private ButtonWidget sizeButton;

	public HudEditScreen(Screen parent) {
		super(Text.literal("Donut HUD"));
		this.parent = parent;
	}

	@Override
	protected void init() {
		int bw = 124;
		int bh = 20;
		int gap = 4;
		int left = (width - (3 * bw + 2 * gap)) / 2;
		int top = height - 2 * bh - gap - 12;
		addDrawableChild(ButtonWidget.builder(colorLabel(), b -> {
			config.theme = config.theme().next().name();
			b.setMessage(colorLabel());
		}).dimensions(left, top, bw, bh).build());
		sizeButton = addDrawableChild(ButtonWidget.builder(sizeLabel(), b -> {
			config.scale = nextSize(config.scale);
			b.setMessage(sizeLabel());
			keepOnScreen();
		}).dimensions(left + bw + gap, top, bw, bh).build());
		addDrawableChild(ButtonWidget.builder(backgroundLabel(), b -> {
			config.background = nextBackground(config.background);
			b.setMessage(backgroundLabel());
		}).dimensions(left + 2 * (bw + gap), top, bw, bh).build());
		addDrawableChild(ButtonWidget.builder(fontLabel(), b -> {
			config.xuongFont = !config.xuongFont;
			b.setMessage(fontLabel());
			keepOnScreen();
		}).dimensions(left, top + bh + gap, bw, bh).build());
		addDrawableChild(ButtonWidget.builder(Text.literal("Reset position"), b -> {
			config.x = 0.01;
			config.y = 0.25;
		}).dimensions(left + bw + gap, top + bh + gap, bw, bh).build());
		addDrawableChild(ButtonWidget.builder(Text.literal("Done"), b -> close()).dimensions(left + 2 * (bw + gap), top + bh + gap, bw, bh).build());
	}

	private Text colorLabel() {
		return Text.literal("Color: " + config.theme().label);
	}

	private Text sizeLabel() {
		return Text.literal("Size: " + Math.round(config.scale * 100) + "%");
	}

	private Text backgroundLabel() {
		return Text.literal("Background: " + (config.background == 0 ? "off" : config.background + "%"));
	}

	private Text fontLabel() {
		return Text.literal("Font: " + (config.xuongFont ? "Xuong" : "Minecraft"));
	}

	private static float nextSize(float current) {
		for (float s : SIZES) if (s > current + 0.01f) return s;
		return SIZES[0];
	}

	private static int nextBackground(int current) {
		for (int b : BACKGROUNDS) if (b > current) return b;
		return BACKGROUNDS[0];
	}

	private HudRenderer.Box box() {
		return HudRenderer.size(client, config, System.currentTimeMillis());
	}

	private int[] spot() {
		return HudRenderer.position(box(), width, height, config);
	}

	private boolean overHud(double mx, double my) {
		HudRenderer.Box b = box();
		int[] p = spot();
		return mx >= p[0] && mx < p[0] + b.width() && my >= p[1] && my < p[1] + b.height();
	}

	/** Moves the HUD's top-left corner to (x, y), snapping to the edges and the middle. */
	private void moveTo(int x, int y, boolean snap) {
		HudRenderer.Box b = box();
		int maxX = Math.max(0, width - b.width());
		int maxY = Math.max(0, height - b.height());
		centeredX = false;
		centeredY = false;
		if (snap) {
			if (Math.abs(x - MARGIN) <= SNAP) x = MARGIN;
			if (Math.abs(maxX - MARGIN - x) <= SNAP) x = maxX - MARGIN;
			if (Math.abs(y - MARGIN) <= SNAP) y = MARGIN;
			if (Math.abs(maxY - MARGIN - y) <= SNAP) y = maxY - MARGIN;
			if (Math.abs(x + b.width() / 2 - width / 2) <= SNAP) {
				x = width / 2 - b.width() / 2;
				centeredX = true;
			}
			if (Math.abs(y + b.height() / 2 - height / 2) <= SNAP) {
				y = height / 2 - b.height() / 2;
				centeredY = true;
			}
		}
		x = Math.max(0, Math.min(maxX, x));
		y = Math.max(0, Math.min(maxY, y));
		config.x = maxX == 0 ? 0 : (double) x / maxX;
		config.y = maxY == 0 ? 0 : (double) y / maxY;
	}

	private void keepOnScreen() {
		int[] p = spot();
		moveTo(p[0], p[1], false);
	}

	@Override
	public boolean mouseClicked(Click click, boolean doubled) {
		if (super.mouseClicked(click, doubled)) return true;
		if (click.button() == GLFW.GLFW_MOUSE_BUTTON_LEFT && overHud(click.x(), click.y())) {
			int[] p = spot();
			dragging = true;
			grabX = click.x() - p[0];
			grabY = click.y() - p[1];
			return true;
		}
		return false;
	}

	@Override
	public boolean mouseDragged(Click click, double deltaX, double deltaY) {
		if (dragging) {
			moveTo((int) Math.round(click.x() - grabX), (int) Math.round(click.y() - grabY), true);
			return true;
		}
		return super.mouseDragged(click, deltaX, deltaY);
	}

	@Override
	public boolean mouseReleased(Click click) {
		if (dragging) {
			dragging = false;
			centeredX = false;
			centeredY = false;
			return true;
		}
		return super.mouseReleased(click);
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double horizontal, double vertical) {
		if (overHud(mouseX, mouseY) && vertical != 0) {
			config.scale = Math.max(0.5f, Math.min(2.5f, Math.round((config.scale + (vertical > 0 ? 0.05f : -0.05f)) * 20) / 20f));
			sizeButton.setMessage(sizeLabel());
			keepOnScreen();
			return true;
		}
		return super.mouseScrolled(mouseX, mouseY, horizontal, vertical);
	}

	@Override
	public boolean keyPressed(KeyInput input) {
		int step = (input.modifiers() & GLFW.GLFW_MOD_SHIFT) != 0 ? 10 : 1;
		int dx = switch (input.key()) {
			case GLFW.GLFW_KEY_LEFT -> -step;
			case GLFW.GLFW_KEY_RIGHT -> step;
			default -> 0;
		};
		int dy = switch (input.key()) {
			case GLFW.GLFW_KEY_UP -> -step;
			case GLFW.GLFW_KEY_DOWN -> step;
			default -> 0;
		};
		if (dx != 0 || dy != 0) {
			int[] p = spot();
			moveTo(p[0] + dx, p[1] + dy, false);
			return true;
		}
		return super.keyPressed(input);
	}

	@Override
	public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {
		// A light dim instead of the usual blur, so you can see where the HUD sits over the game.
		context.fill(0, 0, width, height, 0x70000000);
	}

	@Override
	public void render(DrawContext context, int mouseX, int mouseY, float delta) {
		super.render(context, mouseX, mouseY, delta);
		long now = System.currentTimeMillis();
		HudRenderer.Box b = HudRenderer.size(client, config, now);
		int[] p = HudRenderer.position(b, width, height, config);
		if (dragging && centeredX) context.fill(width / 2, 0, width / 2 + 1, height, 0x99FFFFFF);
		if (dragging && centeredY) context.fill(0, height / 2, width, height / 2 + 1, 0x99FFFFFF);
		// Hints sit just above the buttons, clear of chat and the pop-ups in the top corner,
		// and step aside when the HUD is moved over them.
		int buttonsTop = height - 2 * 20 - 4 - 12;
		hint(context, "Drag the HUD anywhere · scroll on it to resize · arrow keys to nudge", buttonsTop - 26, 0xFFFFFFFF, p, b);
		hint(context, "Any colour: /donuthud color #ff66cc", buttonsTop - 14, 0xFFB4AEC4, p, b);
		// The HUD goes on top of the hints, since it is what you are moving. Text is drawn after
		// shapes within a layer, so it needs a layer of its own to cover them.
		context.createNewRootLayer();
		HudRenderer.draw(context, client, config, p[0], p[1], now);
		int outline = dragging ? 0xFFFFFFFF : overHud(mouseX, mouseY) ? 0xCCFFFFFF : 0x55FFFFFF;
		context.drawStrokedRectangle(p[0] - 2, p[1] - 2, b.width() + 4, b.height() + 4, outline);
	}

	private void hint(DrawContext context, String message, int y, int color, int[] hudSpot, HudRenderer.Box hud) {
		int w = textRenderer.getWidth(message);
		int x = (width - w) / 2;
		boolean covered = x < hudSpot[0] + hud.width() + 2 && x + w > hudSpot[0] - 2 && y < hudSpot[1] + hud.height() + 2 && y + 9 > hudSpot[1] - 2;
		if (!covered) context.drawTextWithShadow(textRenderer, Text.literal(message), x, y, color);
	}

	@Override
	public boolean shouldPause() {
		return false;
	}

	@Override
	public void close() {
		config.save();
		client.setScreen(parent);
	}
}
