package dev.donuthud;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ServerInfo;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.argument;
import static net.fabricmc.fabric.api.client.command.v2.ClientCommandManager.literal;

public final class DonutHud implements ClientModInitializer {
	public static final String MOD_ID = "donuthud";
	public static final Logger LOG = LoggerFactory.getLogger("Donut HUD");
	/** For trying the HUD in singleplayer or on a test server: -Ddonuthud.anyServer=true */
	private static final boolean ANY_SERVER = Boolean.getBoolean("donuthud.anyServer");

	private static HudConfig config = new HudConfig();
	private static final PriceTracker TRACKER = new PriceTracker();
	private static KeyBinding editKey;
	private static KeyBinding toggleKey;
	private static boolean openEditor;
	private static boolean dirty;
	private static long lastSave;

	public static HudConfig config() {
		return config;
	}

	@Override
	public void onInitializeClient() {
		config = HudConfig.load();
		KeyBinding.Category category = KeyBinding.Category.create(Identifier.of(MOD_ID, "main"));
		editKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.donuthud.edit", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, category));
		toggleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.donuthud.toggle", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, category));
		HudElementRegistry.addLast(Identifier.of(MOD_ID, "prices"), HudRenderer::renderHud);
		ClientTickEvents.END_CLIENT_TICK.register(DonutHud::tick);
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, registries) -> registerCommands(dispatcher));
		ClientLifecycleEvents.CLIENT_STOPPING.register(client -> config.save());
	}

	/** True only while connected to DonutSMP; the HUD and the menu reading are off everywhere else. */
	public static boolean onDonut(MinecraftClient client) {
		if (client.world == null) return false;
		if (ANY_SERVER) return true;
		ServerInfo server = client.getCurrentServerEntry();
		return server != null && !client.isInSingleplayer() && Prices.isServer(server.address, config.servers);
	}

	private static void tick(MinecraftClient client) {
		// The keys only do something on DonutSMP, so they can't clash with other servers.
		boolean donut = onDonut(client);
		while (editKey.wasPressed()) openEditor |= donut;
		while (toggleKey.wasPressed()) {
			if (!donut) continue;
			config.enabled = !config.enabled;
			dirty = true;
		}
		if (openEditor) {
			openEditor = false;
			client.setScreen(new HudEditScreen(client.currentScreen));
		}
		if (donut && TRACKER.tick(client, config)) dirty = true;
		long now = System.currentTimeMillis();
		if (dirty && now - lastSave > 5000) {
			config.save();
			dirty = false;
			lastSave = now;
		}
	}

	private static void registerCommands(CommandDispatcher<FabricClientCommandSource> dispatcher) {
		dispatcher.register(literal("donuthud")
			.executes(c -> {
				// Opened on the next tick, after the chat screen has closed.
				openEditor = true;
				return 1;
			})
			.then(literal("toggle").executes(c -> {
				config.enabled = !config.enabled;
				config.save();
				c.getSource().sendFeedback(Text.literal("Donut HUD " + (config.enabled ? "shown" : "hidden")));
				return 1;
			}))
			.then(literal("color").then(argument("color", StringArgumentType.greedyString()).executes(c -> {
				String value = StringArgumentType.getString(c, "color").trim();
				Integer rgb = parseColor(value);
				if (rgb != null) {
					config.theme = Theme.CUSTOM.name();
					config.customColor = rgb;
				} else if (isTheme(value)) {
					config.theme = Theme.byName(value).name();
				} else {
					c.getSource().sendError(Text.literal("Use a hex colour like #ff66cc, or a theme: diamond, donut, emerald, gold, amethyst, redstone, snow"));
					return 0;
				}
				config.save();
				int shown = config.theme().accent(config);
				c.getSource().sendFeedback(Text.literal("Donut HUD colour set to ").append(Text.literal(String.format("#%06X", shown)).withColor(shown)));
				return 1;
			})))
			.then(literal("clear").executes(c -> {
				config.pickaxe = null;
				config.diamondOrder = null;
				config.save();
				c.getSource().sendFeedback(Text.literal("Donut HUD prices cleared. Open /ah or /orders to check again."));
				return 1;
			})));
	}

	private static boolean isTheme(String name) {
		for (Theme t : Theme.values()) if (t.name().equalsIgnoreCase(name)) return true;
		return false;
	}

	/** "#ff66cc", "ff66cc" or "#f6c" to 0xRRGGBB, or null. */
	static Integer parseColor(String s) {
		String hex = s.startsWith("#") ? s.substring(1) : s;
		if (hex.matches("[0-9a-fA-F]{3}")) hex = "" + hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
		return hex.matches("[0-9a-fA-F]{6}") ? Integer.parseInt(hex, 16) : null;
	}
}
