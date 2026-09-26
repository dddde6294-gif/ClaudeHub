package dev.donuthud;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.OptionalDouble;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PricesTest {
	@Test
	void readsDonutMoney() {
		// The /ah tooltip shows "$ 59.9K" (a green $ and a space).
		assertEquals(59_900, Prices.parseMoney("$ 59.9K"), 1e-6);
		assertEquals(54_000, Prices.parseMoney("$54K"), 1e-6);
		assertEquals(1_250_000, Prices.parseMoney("Price: $1.25M"), 1e-6);
		assertEquals(1_500, Prices.parseMoney("$1,500"), 1e-6);
		assertEquals(150, Prices.parseMoney("$150 each"), 1e-6);
		assertEquals(2e9, Prices.parseMoney("$2b"), 1e-6);
		assertEquals(59_900, Prices.parseMoney("$ 59.9ᴋ"), 1e-6);
		assertTrue(Double.isNaN(Prices.parseMoney("When in Main Hand:")));
		assertTrue(Double.isNaN(Prices.parseMoney("5 Attack Damage")));
	}

	@Test
	void knowsTheMenus() {
		assertEquals(Prices.Menu.AUCTION, Prices.menu("Auction (Page 1)"));
		assertEquals(Prices.Menu.AUCTION, Prices.menu("ᴀᴜᴄᴛɪᴏɴ ʜᴏᴜsᴇ"));
		assertEquals(Prices.Menu.ORDERS, Prices.menu("Orders (Page 2)"));
		assertEquals(Prices.Menu.ORDERS, Prices.menu("ᴏʀᴅᴇʀꜱ"));
		assertEquals(Prices.Menu.OTHER, Prices.menu("Your Orders"));
		assertEquals(Prices.Menu.OTHER, Prices.menu("Your Auctions"));
		assertEquals(Prices.Menu.OTHER, Prices.menu("Chest"));
	}

	@Test
	void listingPriceIsTheFirstPriceInTheLore() {
		assertEquals(OptionalDouble.of(59_900), Prices.listingPrice(List.of("$ 59.9K", "", "When in Main Hand:", "5 Attack Damage")));
		assertEquals(OptionalDouble.empty(), Prices.listingPrice(List.of("Click to buy")));
	}

	@Test
	void orderPriceIsPerItem() {
		assertEquals(OptionalDouble.of(128_000), Prices.orderPrice(List.of("$128K each", "Paid: $2.56M", "20/64 delivered")));
		assertEquals(OptionalDouble.of(130_000), Prices.orderPrice(List.of("Total: $8.32M", "Price per item: $130K")));
		assertEquals(OptionalDouble.of(125_000), Prices.orderPrice(List.of("Reward: $125K")));
		// Without an "each", the smallest price is the per-item one.
		assertEquals(OptionalDouble.of(120_000), Prices.orderPrice(List.of("$7.68M total", "$120K")));
		assertEquals(OptionalDouble.empty(), Prices.orderPrice(List.of("Click to deliver")));
	}

	@Test
	void onlyDonutSmp() {
		List<String> donut = List.of("donutsmp.net");
		assertTrue(Prices.isServer("donutsmp.net", donut));
		assertTrue(Prices.isServer("DonutSMP.net:25565", donut));
		assertTrue(Prices.isServer("play.donutsmp.net", donut));
		assertTrue(Prices.isServer("donutsmp.net.", donut));
		assertFalse(Prices.isServer("notdonutsmp.net", donut));
		assertFalse(Prices.isServer("donutsmp.net.evil.com", donut));
		assertFalse(Prices.isServer("hypixel.net", donut));
		assertFalse(Prices.isServer(null, donut));
	}

	@Test
	void formatsLikeDonutSmp() {
		assertEquals("$59.9K", Prices.format(59_900));
		assertEquals("$54K", Prices.format(54_000));
		assertEquals("$128.4K", Prices.format(128_400));
		assertEquals("$131.5K", Prices.format(131_500));
		assertEquals("$132K", Prices.format(132_000));
		assertEquals("$1M", Prices.format(999_999));
		assertEquals("$1.25M", Prices.format(1_250_000));
		assertEquals("$950", Prices.format(950));
		assertEquals("—", Prices.format(Double.NaN));
	}

	@Test
	void saysHowLongAgo() {
		assertEquals("just now", Prices.ago(10_000));
		assertEquals("1m ago", Prices.ago(50_000));
		assertEquals("12m ago", Prices.ago(12 * 60_000));
		assertEquals("3h ago", Prices.ago(3 * 3_600_000 + 5));
		assertEquals("2d ago", Prices.ago(49 * 3_600_000L));
	}

	@Test
	void readsColours() {
		assertEquals(0xFF66CC, DonutHud.parseColor("#ff66cc"));
		assertEquals(0xFF66CC, DonutHud.parseColor("FF66CC"));
		assertEquals(0xFF66CC, DonutHud.parseColor("#f6c"));
		assertEquals(null, DonutHud.parseColor("pink"));
	}
}
