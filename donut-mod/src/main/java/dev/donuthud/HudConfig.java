package dev.donuthud;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;

/** Settings and the last prices seen, kept in config/donuthud.json. */
public final class HudConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	public boolean enabled = true;
	/** Top-left corner as a share of the free space (0 = left/top edge, 1 = right/bottom edge). */
	public double x = 0.01;
	public double y = 0.25;
	public float scale = 1.0f;
	public String theme = Theme.DIAMOND.name();
	public int customColor = 0x55FFFF;
	/** Background opacity, 0-100. */
	public int background = 75;
	public boolean xuongFont = true;
	/** The HUD only runs on these servers (and their subdomains). */
	public List<String> servers = new ArrayList<>(List.of("donutsmp.net"));
	public Reading pickaxe;
	public Reading diamondOrder;

	/** A price, when it was last seen in a menu, and the price at the check before that. */
	public static final class Reading {
		public double price;
		public long seenAt;
		public Double previous;
		/** When the price last changed, for the flash on the HUD. Not saved. */
		public transient long changedAt;

		public Reading(double price, long seenAt) {
			this.price = price;
			this.seenAt = seenAt;
		}
	}

	public Theme theme() {
		return Theme.byName(theme);
	}

	private static Path file() {
		return FabricLoader.getInstance().getConfigDir().resolve("donuthud.json");
	}

	public static HudConfig load() {
		Path f = file();
		if (Files.exists(f)) {
			try {
				HudConfig c = GSON.fromJson(Files.readString(f), HudConfig.class);
				if (c != null) return c.sanitize();
			} catch (IOException | RuntimeException e) {
				DonutHud.LOG.warn("Couldn't read {}, using defaults", f, e);
			}
		}
		return new HudConfig();
	}

	private HudConfig sanitize() {
		x = clamp01(x);
		y = clamp01(y);
		scale = Math.max(0.5f, Math.min(2.5f, scale));
		background = Math.max(0, Math.min(100, background));
		if (servers == null || servers.isEmpty()) servers = new ArrayList<>(List.of("donutsmp.net"));
		return this;
	}

	static double clamp01(double v) {
		return Double.isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
	}

	public void save() {
		Path f = file();
		try {
			Files.createDirectories(f.getParent());
			Path tmp = f.resolveSibling("donuthud.json.tmp");
			Files.writeString(tmp, GSON.toJson(this));
			Files.move(tmp, f, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
		} catch (IOException e) {
			DonutHud.LOG.warn("Couldn't save {}", f, e);
		}
	}
}
