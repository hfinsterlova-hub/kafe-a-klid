import { milkOptions, sizeOptions } from "./data";
import type { CartLine, InventoryItem, ItemOptions, Order, Product } from "./types";

export const defaultOptions: ItemOptions = {
  sizeId: "medium",
  milkId: "none",
  sugar: 0,
};

export function findSize(sizeId: ItemOptions["sizeId"]) {
  return sizeOptions.find((option) => option.id === sizeId) ?? sizeOptions[1];
}

export function findMilk(milkId: ItemOptions["milkId"]) {
  return milkOptions.find((option) => option.id === milkId) ?? milkOptions[0];
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

export function lineUnitPrice(product: Product, options: ItemOptions) {
  if (!product.customizable) {
    return product.basePrice;
  }

  const size = findSize(options.sizeId);
  const milk = findMilk(options.milkId);
  const sugarDelta = options.sugar > 1 ? (options.sugar - 1) * 2 : 0;

  return Math.max(0, product.basePrice + size.priceDelta + milk.priceDelta + sugarDelta);
}

export function lineConsumption(product: Product, options: ItemOptions, quantity = 1) {
  const size = product.customizable ? findSize(options.sizeId) : findSize("medium");
  const milk = findMilk(options.milkId);
  const consumption: Record<string, number> = {};

  for (const [ingredientId, amount] of Object.entries(product.ingredients)) {
    consumption[ingredientId] = (consumption[ingredientId] ?? 0) + amount * size.multiplier * quantity;
  }

  if (product.customizable && milk.ingredientId && milk.amount > 0) {
    consumption[milk.ingredientId] =
      (consumption[milk.ingredientId] ?? 0) + milk.amount * size.multiplier * quantity;
  }

  if (product.customizable && options.sugar > 0) {
    consumption.sugar = (consumption.sugar ?? 0) + options.sugar * 4 * quantity;
  }

  return consumption;
}

export function mergeConsumption(items: Array<Record<string, number>>) {
  return items.reduce<Record<string, number>>((acc, item) => {
    for (const [ingredientId, amount] of Object.entries(item)) {
      acc[ingredientId] = (acc[ingredientId] ?? 0) + amount;
    }
    return acc;
  }, {});
}

export function cartConsumption(cart: CartLine[], products: Product[]) {
  return mergeConsumption(
    cart.map((line) => {
      const product = products.find((item) => item.id === line.productId);
      return product ? lineConsumption(product, line.options, line.quantity) : {};
    }),
  );
}

export function cartTotal(cart: CartLine[], products: Product[]) {
  return cart.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return product ? sum + lineUnitPrice(product, line.options) * line.quantity : sum;
  }, 0);
}

export function stockCheck(
  required: Record<string, number>,
  inventory: InventoryItem[],
  reserved: Record<string, number> = {},
) {
  const shortages: Array<{ ingredientId: string; name: string; missing: number; unit: string }> = [];

  for (const [ingredientId, amount] of Object.entries(required)) {
    const item = inventory.find((stockItem) => stockItem.id === ingredientId);
    const available = (item?.current ?? 0) - (reserved[ingredientId] ?? 0);

    if (!item || available < amount) {
      shortages.push({
        ingredientId,
        name: item?.name ?? ingredientId,
        missing: Math.ceil(amount - Math.max(available, 0)),
        unit: item?.unit ?? "",
      });
    }
  }

  return {
    ok: shortages.length === 0,
    shortages,
  };
}

export function activeOrderConsumption(orders: Order[]) {
  return mergeConsumption(
    orders
      .filter((order) => !order.stockDeducted && !["handed", "cancelled"].includes(order.status))
      .map((order) => order.consumption),
  );
}

export function createOrder(args: {
  cart: CartLine[];
  products: Product[];
  number: number;
  customerName: string;
  registered: boolean;
  pickupTime: string;
}) {
  const { cart, products, number, customerName, registered, pickupTime } = args;
  const total = cartTotal(cart, products);
  const consumption = cartConsumption(cart, products);

  const lines = cart.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) {
      throw new Error(`Unknown product: ${line.productId}`);
    }

    return {
      ...line,
      productName: product.name,
      unitPrice: lineUnitPrice(product, line.options),
    };
  });

  return {
    id: `order-${Date.now()}-${number}`,
    number: `KAK-${number}`,
    customerName,
    registered,
    status: "new",
    paymentStatus: "paid",
    createdAt: new Date().toISOString(),
    pickupTime,
    lines,
    total,
    pointsEarned: registered ? Math.floor(total / 10) : 0,
    consumption,
    stockDeducted: false,
  } satisfies Order;
}

export function deductInventory(inventory: InventoryItem[], consumption: Record<string, number>) {
  return inventory.map((item) => ({
    ...item,
    current: Math.max(0, item.current - (consumption[item.id] ?? 0)),
  }));
}
