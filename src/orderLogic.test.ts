import { describe, expect, it } from "vitest";
import { initialInventory, initialProducts } from "./data";
import {
  cartConsumption,
  createOrder,
  defaultOptions,
  lineUnitPrice,
  stockCheck,
} from "./orderLogic";
import type { CartLine } from "./types";

describe("order logic", () => {
  it("counts drink variants in the price", () => {
    const latte = initialProducts.find((product) => product.id === "latte")!;

    expect(
      lineUnitPrice(latte, {
        sizeId: "large",
        milkId: "oat",
        sugar: 3,
      }),
    ).toBe(121);
  });

  it("detects stock shortage before the order reaches the barista", () => {
    const cart: CartLine[] = [
      {
        id: "line-1",
        productId: "makronky",
        quantity: 20,
        options: defaultOptions,
      },
    ];

    const required = cartConsumption(cart, initialProducts);
    const result = stockCheck(required, initialInventory);

    expect(result.ok).toBe(false);
    expect(result.shortages[0].ingredientId).toBe("macarons");
  });

  it("creates a paid registered order with loyalty points", () => {
    const cart: CartLine[] = [
      {
        id: "line-1",
        productId: "espresso",
        quantity: 2,
        options: { ...defaultOptions, sugar: 1 },
      },
    ];

    const order = createOrder({
      cart,
      products: initialProducts,
      number: 1042,
      customerName: "Klára",
      registered: true,
      pickupTime: "10:15",
    });

    expect(order.number).toBe("KAK-1042");
    expect(order.total).toBe(118);
    expect(order.pointsEarned).toBe(11);
    expect(order.consumption.coffeeBeans).toBe(36);
  });
});
