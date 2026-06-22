import { describe, expect, it } from "vitest";
import { authenticate, createGuestSession } from "./auth";

describe("auth", () => {
  it("registers Hanka as customer-only user", () => {
    const result = authenticate("Hanka", "Hanka", "register");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.name).toBe("Hanka");
      expect(result.session.access).toBe("customer");
      expect(result.session.registered).toBe(true);
    }
  });

  it("logs admin into full-access mode", () => {
    const result = authenticate("admin", "admin", "login");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.access).toBe("admin");
      expect(result.session.kind).toBe("admin");
    }
  });

  it("supports customer usage without login", () => {
    expect(createGuestSession()).toEqual({
      kind: "guest",
      name: "Host",
      access: "customer",
      registered: false,
    });
  });
});
