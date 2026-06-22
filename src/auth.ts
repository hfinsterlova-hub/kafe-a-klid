export type AuthMode = "login" | "register";

export type AuthSession = {
  kind: "guest" | "customer" | "admin";
  name: string;
  access: "customer" | "admin";
  registered: boolean;
};

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string };

export function createGuestSession(): AuthSession {
  return {
    kind: "guest",
    name: "Host",
    access: "customer",
    registered: false,
  };
}

export function authenticate(username: string, password: string, mode: AuthMode): AuthResult {
  const cleanUsername = username.trim();
  const cleanPassword = password.trim();

  if (mode === "register") {
    if (cleanUsername === "Hanka" && cleanPassword === "Hanka") {
      return {
        ok: true,
        session: {
          kind: "customer",
          name: "Hanka",
          access: "customer",
          registered: true,
        },
      };
    }

    return {
      ok: false,
      error: "Registrace je v prototypu povolena pouze pro účet Hanka.",
    };
  }

  if (cleanUsername === "Hanka" && cleanPassword === "Hanka") {
    return {
      ok: true,
      session: {
        kind: "customer",
        name: "Hanka",
        access: "customer",
        registered: true,
      },
    };
  }

  if (cleanUsername === "admin" && cleanPassword === "admin") {
    return {
      ok: true,
      session: {
        kind: "admin",
        name: "Admin",
        access: "admin",
        registered: true,
      },
    };
  }

  return {
    ok: false,
    error: "Jméno nebo heslo nesedí.",
  };
}
