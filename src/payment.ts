export type PaymentMethod = "card" | "wallet";

export type PaymentStatus = "idle" | "paid" | "failed";

export type PaymentState = {
  method: PaymentMethod;
  holderName: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
  status: PaymentStatus;
  error: string;
  receipt: string;
};

export type PaymentResult =
  | { ok: true; receipt: string }
  | { ok: false; error: string };

export function createInitialPaymentState(): PaymentState {
  return {
    method: "card",
    holderName: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
    status: "idle",
    error: "",
    receipt: "",
  };
}

export function resetPaymentStatus(payment: PaymentState): PaymentState {
  return {
    ...payment,
    status: "idle",
    error: "",
    receipt: "",
  };
}

export function completePayment(amount: number, payment: PaymentState): PaymentResult {
  if (amount <= 0) {
    return { ok: false, error: "Košík je prázdný." };
  }

  if (payment.method === "wallet") {
    return { ok: true, receipt: buildReceipt("APP") };
  }

  const errors = validateCardPayment(payment);
  if (errors.length > 0) {
    return { ok: false, error: errors[0] };
  }

  return { ok: true, receipt: buildReceipt("CARD") };
}

export function validateCardPayment(payment: PaymentState) {
  const errors: string[] = [];
  const digits = normalizeCardNumber(payment.cardNumber);

  if (payment.holderName.trim().length < 3) {
    errors.push("Doplňte jméno držitele karty.");
  }

  if (digits.length < 12 || digits.length > 19 || !passesLuhn(digits)) {
    errors.push("Číslo karty není platné.");
  }

  if (!isValidExpiry(payment.expiry)) {
    errors.push("Platnost karty zadejte ve formátu MM/RR.");
  }

  if (!/^\d{3,4}$/.test(payment.cvc.trim())) {
    errors.push("CVC musí mít 3 až 4 číslice.");
  }

  return errors;
}

export function normalizeCardNumber(value: string) {
  return value.replace(/\D/g, "");
}

function isValidExpiry(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;

  const month = Number(match[1]);
  return month >= 1 && month <= 12;
}

function passesLuhn(digits: string) {
  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function buildReceipt(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
