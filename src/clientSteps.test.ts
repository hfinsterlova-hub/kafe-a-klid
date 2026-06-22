import { describe, expect, it } from "vitest";
import { getClientStepProgress, getClientStepState } from "./clientSteps";

describe("client step progress", () => {
  it("starts with product selection for a client without a cart", () => {
    const progress = getClientStepProgress({
      cartCount: 0,
      paymentStatus: "idle",
    });

    expect(progress.activeIndex).toBe(1);
    expect(getClientStepState(0, progress)).toBe("done");
    expect(getClientStepState(1, progress)).toBe("active");
  });

  it("moves a draft order to payment when the cart has items", () => {
    const progress = getClientStepProgress({
      cartCount: 2,
      paymentStatus: "idle",
    });

    expect(progress.activeIndex).toBe(3);
    expect(getClientStepState(2, progress)).toBe("done");
    expect(getClientStepState(3, progress)).toBe("active");
  });

  it("marks payment as the current problem when payment fails", () => {
    const progress = getClientStepProgress({
      cartCount: 1,
      paymentStatus: "failed",
    });

    expect(progress.activeIndex).toBe(3);
    expect(progress.errorIndex).toBe(3);
    expect(getClientStepState(3, progress)).toBe("error");
  });

  it("waits for order submission after a successful payment", () => {
    const progress = getClientStepProgress({
      cartCount: 1,
      paymentStatus: "paid",
    });

    expect(progress.activeIndex).toBe(4);
    expect(getClientStepState(3, progress)).toBe("done");
    expect(getClientStepState(4, progress)).toBe("active");
  });

  it("tracks the customer's submitted order through preparation", () => {
    expect(
      getClientStepProgress({
        cartCount: 0,
        paymentStatus: "idle",
        orderStatus: "preparing",
      }).activeIndex,
    ).toBe(5);

    expect(
      getClientStepProgress({
        cartCount: 0,
        paymentStatus: "idle",
        orderStatus: "ready",
      }).activeIndex,
    ).toBe(6);
  });

  it("shows pickup as the last step after handoff", () => {
    const progress = getClientStepProgress({
      cartCount: 0,
      paymentStatus: "idle",
      orderStatus: "handed",
    });

    expect(progress.activeIndex).toBe(7);
    expect(getClientStepState(7, progress)).toBe("active");
  });

  it("marks the order step as failed when an order is cancelled", () => {
    const progress = getClientStepProgress({
      cartCount: 0,
      paymentStatus: "idle",
      orderStatus: "cancelled",
    });

    expect(progress.activeIndex).toBe(4);
    expect(progress.errorIndex).toBe(4);
    expect(getClientStepState(4, progress)).toBe("error");
  });
});
