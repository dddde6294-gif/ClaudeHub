package dev.donuthud;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.LoreComponent;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.screen.slot.Slot;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalDouble;

/**
 * Watches the /ah and /orders menus while they're open and records the cheapest diamond
 * pickaxe listed and the best price per diamond offered. Nothing is clicked or sent.
 */
public final class PriceTracker {
	/** Closing a menu for longer than this starts a fresh look; paging through it doesn't. */
	private static final long NEW_LOOK_AFTER_MS = 3000;

	private final Look auction = new Look(true);
	private final Look orders = new Look(false);

	/** One visit to a menu: the best price across every page looked at during it. */
	private static final class Look {
		final boolean lowest;
		long lastOpen;
		double best = Double.NaN;
		/** The saved price when this look started, to compare against. */
		Double before;

		Look(boolean lowest) {
			this.lowest = lowest;
		}

		void open(long now, HudConfig.Reading saved) {
			if (now - lastOpen > NEW_LOOK_AFTER_MS) {
				best = Double.NaN;
				before = saved == null ? null : saved.price;
			}
			lastOpen = now;
		}

		double offer(double price) {
			best = Double.isNaN(best) ? price : lowest ? Math.min(best, price) : Math.max(best, price);
			return best;
		}
	}

	/** Called every client tick. Returns true when a price was recorded. */
	public boolean tick(MinecraftClient client, HudConfig config) {
		if (!(client.currentScreen instanceof HandledScreen<?> screen) || client.player == null) return false;
		Prices.Menu menu = Prices.menu(screen.getTitle().getString());
		if (menu == Prices.Menu.OTHER) return false;

		boolean isAuction = menu == Prices.Menu.AUCTION;
		Item wanted = isAuction ? Items.DIAMOND_PICKAXE : Items.DIAMOND;
		double seen = Double.NaN;
		for (Slot slot : screen.getScreenHandler().slots) {
			if (slot.inventory instanceof PlayerInventory || !slot.hasStack()) continue;
			ItemStack stack = slot.getStack();
			if (!stack.isOf(wanted)) continue;
			List<String> lore = lore(stack);
			OptionalDouble price = isAuction ? Prices.listingPrice(lore) : Prices.orderPrice(lore);
			if (price.isEmpty()) continue;
			double p = price.getAsDouble();
			seen = Double.isNaN(seen) ? p : isAuction ? Math.min(seen, p) : Math.max(seen, p);
		}

		long now = System.currentTimeMillis();
		Look look = isAuction ? auction : orders;
		HudConfig.Reading saved = isAuction ? config.pickaxe : config.diamondOrder;
		look.open(now, saved);
		if (Double.isNaN(seen)) return false;
		HudConfig.Reading reading = new HudConfig.Reading(look.offer(seen), now);
		reading.previous = look.before;
		reading.changedAt = saved != null && saved.price == reading.price ? saved.changedAt : now;
		if (isAuction) config.pickaxe = reading;
		else config.diamondOrder = reading;
		return true;
	}

	private static List<String> lore(ItemStack stack) {
		LoreComponent lore = stack.get(DataComponentTypes.LORE);
		List<String> lines = new ArrayList<>();
		if (lore != null) for (Text line : lore.lines()) lines.add(line.getString());
		return lines;
	}
}
