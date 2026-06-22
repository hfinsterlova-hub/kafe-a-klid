import type { InventoryItem, MilkOption, Order, Product, SizeOption } from "./types";

export const sizeOptions: SizeOption[] = [
  { id: "small", label: "Malá", priceDelta: -8, multiplier: 0.85 },
  { id: "medium", label: "Střední", priceDelta: 0, multiplier: 1 },
  { id: "large", label: "Velká", priceDelta: 16, multiplier: 1.25 },
];

export const milkOptions: MilkOption[] = [
  { id: "none", label: "Bez mléka", priceDelta: 0, amount: 0 },
  { id: "cow", label: "Plnotučné", priceDelta: 0, ingredientId: "milk", amount: 120 },
  { id: "oat", label: "Ovesné", priceDelta: 12, ingredientId: "oatMilk", amount: 120 },
];

export const initialProducts: Product[] = [
  {
    id: "espresso",
    name: "Espresso Klid",
    category: "coffee",
    description: "Lokální pražírna, hutná crema, krátká pauza uprostřed dne.",
    basePrice: 59,
    prepMinutes: 4,
    image:
      "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?auto=format&fit=crop&w=900&q=80",
    alt: "Šálek espressa na dřevěném stole",
    ingredients: { coffeeBeans: 18 },
    customizable: true,
    available: true,
    badge: "Must",
  },
  {
    id: "cappuccino",
    name: "Cappuccino Praha",
    category: "coffee",
    description: "Sametová pěna, výběrová káva a klidné ráno bez fronty.",
    basePrice: 79,
    prepMinutes: 6,
    image:
      "https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&w=900&q=80",
    alt: "Cappuccino s latte artem",
    ingredients: { coffeeBeans: 18, milk: 140 },
    customizable: true,
    available: true,
    badge: "Top",
  },
  {
    id: "latte",
    name: "Vanilkové latte",
    category: "coffee",
    description: "Jemná káva s domácím sirupem, vhodná i s ovesným mlékem.",
    basePrice: 89,
    prepMinutes: 7,
    image:
      "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=900&q=80",
    alt: "Sklenice latte na kavárenském stolku",
    ingredients: { coffeeBeans: 18, milk: 180, vanilla: 12 },
    customizable: true,
    available: true,
  },
  {
    id: "chai",
    name: "Bylinkový chai",
    category: "tea",
    description: "Koření, bylinky od Kláry a pomalé odpoledne.",
    basePrice: 72,
    prepMinutes: 5,
    image:
      "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=900&q=80",
    alt: "Horký čaj ve skleněném šálku",
    ingredients: { teaBlend: 10, milk: 80 },
    customizable: true,
    available: true,
  },
  {
    id: "croissant",
    name: "Máslový croissant",
    category: "food",
    description: "Čerstvé pečivo z ranní várky, voňavé a křehké.",
    basePrice: 49,
    prepMinutes: 2,
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80",
    alt: "Čerstvé croissanty",
    ingredients: { pastry: 1 },
    customizable: false,
    available: true,
  },
  {
    id: "makronky",
    name: "Klářiny makronky",
    category: "food",
    description: "Limitovaná sladkost, která se v kavárně rychle vyprodá.",
    basePrice: 64,
    prepMinutes: 1,
    image:
      "https://images.unsplash.com/photo-1558326567-98ae2405596b?auto=format&fit=crop&w=900&q=80",
    alt: "Barevné makronky",
    ingredients: { macarons: 2 },
    customizable: false,
    available: true,
    badge: "Limit",
  },
];

export const initialInventory: InventoryItem[] = [
  { id: "coffeeBeans", name: "Kávová zrna", unit: "g", current: 2800, min: 600 },
  { id: "milk", name: "Plnotučné mléko", unit: "ml", current: 5200, min: 1200 },
  { id: "oatMilk", name: "Ovesné mléko", unit: "ml", current: 1600, min: 700 },
  { id: "vanilla", name: "Vanilkový sirup", unit: "ml", current: 440, min: 120 },
  { id: "teaBlend", name: "Čajová směs", unit: "g", current: 640, min: 150 },
  { id: "sugar", name: "Cukr", unit: "g", current: 1800, min: 400 },
  { id: "pastry", name: "Croissanty", unit: "ks", current: 18, min: 6 },
  { id: "macarons", name: "Makronky", unit: "ks", current: 14, min: 8 },
];

export const seedOrders: Order[] = [
  {
    id: "seed-1007",
    number: "KAK-1007",
    customerName: "Jana R.",
    registered: true,
    status: "preparing",
    paymentStatus: "paid",
    createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    pickupTime: "09:15",
    lines: [
      {
        id: "seed-line-1",
        productId: "cappuccino",
        productName: "Cappuccino Praha",
        quantity: 2,
        unitPrice: 79,
        options: { sizeId: "medium", milkId: "cow", sugar: 0 },
      },
    ],
    total: 158,
    pointsEarned: 15,
    consumption: { coffeeBeans: 36, milk: 280 },
    stockDeducted: false,
  },
  {
    id: "seed-1008",
    number: "KAK-1008",
    customerName: "Host",
    registered: false,
    status: "new",
    paymentStatus: "paid",
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    pickupTime: "09:40",
    lines: [
      {
        id: "seed-line-2",
        productId: "espresso",
        productName: "Espresso Klid",
        quantity: 1,
        unitPrice: 59,
        options: { sizeId: "medium", milkId: "none", sugar: 1 },
      },
      {
        id: "seed-line-3",
        productId: "croissant",
        productName: "Máslový croissant",
        quantity: 1,
        unitPrice: 49,
        options: { sizeId: "medium", milkId: "none", sugar: 0 },
      },
    ],
    total: 108,
    pointsEarned: 0,
    consumption: { coffeeBeans: 18, sugar: 4, pastry: 1 },
    stockDeducted: false,
  },
];
