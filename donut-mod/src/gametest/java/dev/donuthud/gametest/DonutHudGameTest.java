package dev.donuthud.gametest;

import dev.donuthud.DonutHud;
import dev.donuthud.HudConfig;
import dev.donuthud.HudEditScreen;
import dev.donuthud.HudRenderer;
import dev.donuthud.Theme;
import net.fabricmc.fabric.api.client.gametest.v1.FabricClientGameTest;
import net.fabricmc.fabric.api.client.gametest.v1.context.ClientGameTestContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestDedicatedServerContext;
import net.fabricmc.fabric.api.client.gametest.v1.context.TestServerConnection;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.ingame.GenericContainerScreen;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.LoreComponent;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;

/**
 * Plays through the HUD in the real game: a test server that isn't DonutSMP, the same server
 * treated as DonutSMP, an /ah menu, an /orders menu, and dragging the HUD in the editor.
 */
public class DonutHudGameTest implements FabricClientGameTest {
	@Override
	public void runTest(ClientGameTestContext context) {
		HudConfig config = DonutHud.config();
		try (TestDedicatedServerContext server = context.worldBuilder().createServer();
				TestServerConnection connection = server.connect()) {
			connection.getClientWorld().waitForChunksRender();
			long now = System.currentTimeMillis();
			context.runOnClient(client -> {
				config.pickaxe = new HudConfig.Reading(54_000, now - 11 * 60_000);
				config.diamondOrder = null;
			});

			// Any server other than DonutSMP: the HUD stays off and menus aren't read.
			check(!context.computeOnClient(DonutHud::onDonut), "HUD should be off on a server that isn't DonutSMP");
			openMenu(context, "Auction (Page 1)", Items.DIAMOND_PICKAXE, "$ 1K");
			context.waitTicks(3);
			check(config.pickaxe.price == 54_000, "menus on other servers must be ignored, got " + config.pickaxe.price);
			context.setScreen(() -> null);
			screenshot(context, "donuthud-1-other-server");

			// The same server listed as DonutSMP (it's at localhost here).
			context.runOnClient(client -> config.servers = new ArrayList<>(List.of("donutsmp.net", "localhost", "127.0.0.1")));
			check(context.computeOnClient(DonutHud::onDonut), "HUD should be on for a listed server");
			context.waitTicks(2);
			screenshot(context, "donuthud-2-hud-old-price");

			// /ah: the cheapest diamond pickaxe across the page; other items don't count.
			openMenu(context, "Auction (Page 1)", Items.DIAMOND_PICKAXE, "$ 64.5K", "$ 59.9K", "$ 61K");
			context.runOnClient(client -> addToMenu(client, 20, Items.NETHERITE_PICKAXE, "$ 1K"));
			context.waitTicks(3);
			check(Math.abs(config.pickaxe.price - 59_900) < 1e-6, "expected $59.9K, got " + config.pickaxe.price);
			check(System.currentTimeMillis() - config.pickaxe.seenAt < 10_000, "the pickaxe price should be fresh");
			check(config.pickaxe.previous != null && config.pickaxe.previous == 54_000, "the last check ($54K) should be kept to compare against");
			screenshot(context, "donuthud-3-auction-menu");
			context.setScreen(() -> null);
			screenshot(context, "donuthud-3b-price-changed");

			// /orders: the best price per diamond.
			openMenu(context, "Orders (Page 1)", Items.DIAMOND, "$128K each", "$131.5K each", "$120K each");
			context.waitTicks(3);
			check(config.diamondOrder != null && Math.abs(config.diamondOrder.price - 131_500) < 1e-6, "expected $131.5K per diamond");
			context.setScreen(() -> null);
			context.waitTicks(2);
			screenshot(context, "donuthud-4-hud");

			// The editor: drag the HUD to the right-hand edge.
			context.setScreen(() -> new HudEditScreen(null));
			context.waitTicks(2);
			screenshot(context, "donuthud-5-editor");
			double[] from = context.computeOnClient(DonutHudGameTest::hudCenterInWindow);
			double scale = context.computeOnClient(client -> client.getWindow().getScaleFactor());
			int windowWidth = context.computeOnClient(client -> client.getWindow().getWidth());
			context.getInput().setCursorPos(from[0], from[1]);
			context.getInput().holdMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
			for (int i = 1; i <= 10; i++) {
				context.getInput().setCursorPos(from[0] + (windowWidth - from[0]) * i / 10.0, from[1] + 40 * scale * i / 10.0);
				context.waitTick();
			}
			context.getInput().releaseMouse(GLFW.GLFW_MOUSE_BUTTON_LEFT);
			context.waitTick();
			check(config.x > 0.99, "dragging to the right edge should move the HUD there, x=" + config.x);
			screenshot(context, "donuthud-6-editor-moved");

			// Colours and fonts.
			context.runOnClient(client -> {
				config.theme = Theme.DONUT.name();
				config.scale = 1.25f;
			});
			context.waitTicks(2);
			screenshot(context, "donuthud-7-donut-theme");
			context.runOnClient(client -> {
				config.theme = Theme.GOLD.name();
				config.xuongFont = false;
				config.scale = 1.0f;
			});
			context.waitTicks(2);
			screenshot(context, "donuthud-8-gold-minecraft-font");
			context.runOnClient(client -> {
				config.theme = Theme.DIAMOND.name();
				config.xuongFont = true;
			});
			context.setScreen(() -> null);
		}
	}

	/** Takes a screenshot without the test server's pop-up notices covering the HUD. */
	private static void screenshot(ClientGameTestContext context, String name) {
		context.runOnClient(client -> client.getToastManager().clear());
		context.waitTick();
		context.takeScreenshot(name);
	}

	private static void check(boolean ok, String message) {
		if (!ok) throw new AssertionError(message);
	}

	/** A client-side chest menu like DonutSMP's, with the item priced in its lore. */
	private static void openMenu(ClientGameTestContext context, String title, Item item, String... prices) {
		context.runOnClient(client -> {
			SimpleInventory inventory = new SimpleInventory(54);
			for (int i = 0; i < prices.length; i++) inventory.setStack(10 + i, priced(item, prices[i]));
			var handler = GenericContainerScreenHandler.createGeneric9x6(77, client.player.getInventory(), inventory);
			client.setScreen(new GenericContainerScreen(handler, client.player.getInventory(), Text.literal(title)));
		});
		context.waitTick();
	}

	private static void addToMenu(MinecraftClient client, int slot, Item item, String price) {
		if (client.currentScreen instanceof GenericContainerScreen screen) {
			screen.getScreenHandler().getInventory().setStack(slot, priced(item, price));
		}
	}

	private static ItemStack priced(Item item, String price) {
		ItemStack stack = new ItemStack(item);
		stack.set(DataComponentTypes.LORE, new LoreComponent(List.of(Text.literal(price), Text.literal(""), Text.literal("Click to buy"))));
		return stack;
	}

	private static double[] hudCenterInWindow(MinecraftClient client) {
		HudConfig config = DonutHud.config();
		int w = client.getWindow().getScaledWidth();
		int h = client.getWindow().getScaledHeight();
		HudRenderer.Box box = HudRenderer.size(client, config, System.currentTimeMillis());
		int[] p = HudRenderer.position(box, w, h, config);
		double scale = client.getWindow().getScaleFactor();
		return new double[] {(p[0] + box.width() / 2.0) * scale, (p[1] + box.height() / 2.0) * scale};
	}
}
