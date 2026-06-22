export type RoleKey = "customer" | "staff" | "inventory" | "admin";

export type ProductCategory = "coffee" | "tea" | "food";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  basePrice: number;
  prepMinutes: number;
  image: string;
  alt: string;
  ingredients: Record<string, number>;
  customizable: boolean;
  available: boolean;
  badge?: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  current: number;
  min: number;
};

export type SizeOption = {
  id: "small" | "medium" | "large";
  label: string;
  priceDelta: number;
  multiplier: number;
};

export type MilkOption = {
  id: "none" | "cow" | "oat";
  label: string;
  priceDelta: number;
  ingredientId?: string;
  amount: number;
};

export type ItemOptions = {
  sizeId: SizeOption["id"];
  milkId: MilkOption["id"];
  sugar: number;
};

export type CartLine = {
  id: string;
  productId: string;
  quantity: number;
  options: ItemOptions;
};

export type OrderStatus =
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "handed"
  | "cancelled";

export type OrderLine = CartLine & {
  productName: string;
  unitPrice: number;
};

export type Order = {
  id: string;
  number: string;
  customerName: string;
  registered: boolean;
  status: OrderStatus;
  paymentStatus: "paid" | "refunded";
  createdAt: string;
  pickupTime: string;
  lines: OrderLine[];
  total: number;
  pointsEarned: number;
  consumption: Record<string, number>;
  stockDeducted: boolean;
  note?: string;
};
