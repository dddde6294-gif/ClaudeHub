package dev.donuthud;

import java.util.List;
import java.util.Locale;
import java.util.OptionalDouble;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads DonutSMP prices ("$ 59.9K", "$150 each") out of menu titles and item lore,
 * and formats them back the way DonutSMP writes money. Uses no Minecraft classes,
 * so it can be unit tested on its own.
 */
public final class Prices {
	private Prices() {
	}

	public enum Menu { AUCTION, ORDERS, OTHER }

	private static final Pattern MONEY = Pattern.compile("\\$\\s*([0-9][0-9,]*(?:\\.[0-9]+)?|\\.[0-9]+)\\s*([kmbt](?![a-z]))?");
	private static final Pattern EACH = Pattern.compile("\\b(each|per|ea)\\b|/\\s*(item|piece|pc|ea)\\b");
	// Servers often write menu text in small capitals (ᴀᴜᴄᴛɪᴏɴ); these map to a-z in order.
	private static final String SMALL_CAPS = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ";

	/** Lowercases text and turns small capitals into plain letters. */
	public static String plain(String s) {
		StringBuilder out = new StringBuilder(s.length());
		for (int i = 0; i < s.length(); i++) {
			char c = s.charAt(i);
			int k = SMALL_CAPS.indexOf(c);
			out.append(k >= 0 ? (char) ('a' + k) : Character.toLowerCase(c));
		}
		return out.toString();
	}

	/** Which DonutSMP menu a container title belongs to. Your own listings and orders don't count. */
	public static Menu menu(String title) {
		String t = plain(title);
		if (t.contains("your") || t.contains("my ")) return Menu.OTHER;
		if (t.contains("auction")) return Menu.AUCTION;
		if (t.contains("order")) return Menu.ORDERS;
		return Menu.OTHER;
	}

	/** The first price in the text, in dollars, or NaN. */
	public static double parseMoney(String s) {
		Matcher m = MONEY.matcher(plain(s));
		return m.find() ? value(m) : Double.NaN;
	}

	private static double value(Matcher m) {
		double n = Double.parseDouble(m.group(1).replace(",", ""));
		String unit = m.group(2);
		if (unit == null) return n;
		return n * switch (unit) {
			case "k" -> 1e3;
			case "m" -> 1e6;
			case "b" -> 1e9;
			default -> 1e12;
		};
	}

	/** An auction item's price: the first price in its lore (DonutSMP puts it right under the name). */
	public static OptionalDouble listingPrice(List<String> lore) {
		for (String line : lore) {
			double v = parseMoney(line);
			if (!Double.isNaN(v)) return OptionalDouble.of(v);
		}
		return OptionalDouble.empty();
	}

	/**
	 * An order's price per item: the price on a line that says "each" or "per", otherwise the
	 * smallest price in the lore (an order's total is never less than its price per item).
	 */
	public static OptionalDouble orderPrice(List<String> lore) {
		double smallest = Double.NaN;
		for (String line : lore) {
			String p = plain(line);
			Matcher m = MONEY.matcher(p);
			while (m.find()) {
				double v = value(m);
				if (EACH.matcher(p).find()) return OptionalDouble.of(v);
				if (Double.isNaN(smallest) || v < smallest) smallest = v;
			}
		}
		return Double.isNaN(smallest) ? OptionalDouble.empty() : OptionalDouble.of(smallest);
	}

	/** True when a server address is one of the given hosts or a subdomain of one ("play.donutsmp.net:25565"). */
	public static boolean isServer(String address, List<String> hosts) {
		if (address == null) return false;
		String host = address.trim().toLowerCase(Locale.ROOT);
		int colon = host.lastIndexOf(':');
		if (colon > 0 && host.indexOf(':') == colon) host = host.substring(0, colon);
		if (host.endsWith(".")) host = host.substring(0, host.length() - 1);
		for (String h : hosts) {
			String want = h.trim().toLowerCase(Locale.ROOT);
			if (!want.isEmpty() && (host.equals(want) || host.endsWith("." + want))) return true;
		}
		return false;
	}

	private static final double[] SIZES = {1e12, 1e9, 1e6, 1e3};
	private static final String[] UNITS = {"T", "B", "M", "K"};

	/** DonutSMP's money style, kept to a tenth: $950, $12.5K, $131.5K, $1.25M. */
	public static String format(double n) {
		if (Double.isNaN(n) || Double.isInfinite(n)) return "—";
		for (int i = 0; i < SIZES.length; i++) {
			// 999,960 would round to "1000K", so it moves up to "$1M".
			if (n >= SIZES[i] * 0.99995) {
				double x = n / SIZES[i];
				return "$" + trim(x, x >= 10 ? 1 : 2) + UNITS[i];
			}
		}
		return "$" + trim(n, n == Math.rint(n) || n >= 100 ? 0 : 2);
	}

	private static String trim(double x, int digits) {
		String s = String.format(Locale.ROOT, "%." + digits + "f", x);
		return s.contains(".") ? s.replaceAll("\\.?0+$", "") : s;
	}

	/** "just now", "3m ago", "2h ago", "4d ago". */
	public static String ago(long ms) {
		if (ms < 45_000) return "just now";
		long m = Math.max(1, ms / 60_000);
		if (m < 60) return m + "m ago";
		long h = m / 60;
		return h < 24 ? h + "h ago" : (h / 24) + "d ago";
	}
}
