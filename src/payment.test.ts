import { describe, expect, it } from "vitest";
import { completePayment, createInitialPaymentState, resetPaymentStatus } from "./payment";

describe("payment", () => {
  it("accepts a valid card payment", () => {
    const result = completePayment(118, {
      ...createInitialPaymentState(),
      holderName: "Hanka",
      cardNumber: "4242 4242 4242 4242",
      expiry: "12/30",
      cvc: "123",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.receipt).toMatch(/^CARD-/);
    }
  });

  it("rejects incomplete card details", () => {
    const result = completePayment(118, {
      ...createInitialPaymentState(),
      holderName: "Hanka",
      cardNumber: "1234",
      expiry: "12/30",
      cvc: "123",
    });

    expect(result).toEqual({ ok: false, error: "Číslo karty není platné." });
  });

  it("accepts an app wallet payment", () => {
    const result = completePayment(118, {
      ...createInitialPaymentState(),
      method: "wallet",
    });

    expect(result.ok).toBe(true);
  });

  it("resets paid status when cart changes", () => {
    expect(
      resetPaymentStatus({
        ...createInitialPaymentState(),
        status: "paid",
        receipt: "CARD-TEST",
      }),
    ).toMatchObject({
      status: "idle",
      receipt: "",
      error: "",
    });
  });
});
