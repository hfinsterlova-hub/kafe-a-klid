import type { PaymentStatus } from "./payment";
import type { OrderStatus } from "./types";

export const clientStepLabels = [
  "Účet",
  "Výběr",
  "Košík",
  "Platba",
  "Objednávka",
  "Příprava",
  "Hotovo",
  "Vyzvednutí",
] as const;

export type ClientStepState = "done" | "active" | "pending" | "error";

export type ClientStepProgress = {
  activeIndex: number;
  errorIndex: number | null;
};

const orderStatusIndex: Record<OrderStatus, number> = {
  new: 4,
  accepted: 4,
  preparing: 5,
  ready: 6,
  handed: 7,
  cancelled: 4,
};

export function getClientStepProgress(args: {
  cartCount: number;
  paymentStatus: PaymentStatus;
  orderStatus?: OrderStatus | null;
}): ClientStepProgress {
  const { cartCount, paymentStatus, orderStatus } = args;

  if (orderStatus) {
    const activeIndex = orderStatusIndex[orderStatus];

    return {
      activeIndex,
      errorIndex: orderStatus === "cancelled" ? activeIndex : null,
    };
  }

  if (cartCount > 0) {
    return {
      activeIndex: paymentStatus === "paid" ? 4 : 3,
      errorIndex: paymentStatus === "failed" ? 3 : null,
    };
  }

  return {
    activeIndex: 1,
    errorIndex: null,
  };
}

export function getClientStepState(index: number, progress: ClientStepProgress): ClientStepState {
  if (progress.errorIndex === index) return "error";
  if (index < progress.activeIndex) return "done";
  if (index === progress.activeIndex) return "active";
  return "pending";
}
