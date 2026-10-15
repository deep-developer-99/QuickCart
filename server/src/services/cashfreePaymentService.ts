import crypto from "crypto";

export type CashfreePaymentMethod =
  | "UPI_GPAY"
  | "UPI_PHONEPE"
  | "UPI_PAYTM"
  | "UPI_OTHER"
  | "CARD"
  | "WALLET";

export interface CreateCashfreeOrderInput {
  orderId: string;
  amount: number;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  paymentMethod: CashfreePaymentMethod;
}

export interface CashfreeOrderSession {
  orderId: string;
  paymentSessionId: string;
  amount: number;
  currency: "INR";
  environment: "SANDBOX" | "PRODUCTION";
}

export interface CashfreePaymentStatus {
  status: "paid" | "pending" | "failed";
  orderId: string;
  amount?: number;
  currency?: string;
  transactionId?: string;
  rawStatus?: string;
}

const getConfig = () => {
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim();
  const environment = (process.env.CASHFREE_ENV || "sandbox")
    .trim()
    .toLowerCase();
  const apiVersion = (process.env.CASHFREE_API_VERSION || "2025-01-01").trim();

  if (!appId || !secretKey) {
    throw new Error(
      "Cashfree configuration is incomplete. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.",
    );
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("CASHFREE_ENV must be sandbox or production.");
  }
  return {
    appId,
    secretKey,
    apiVersion,
    environment:
      environment === "sandbox"
        ? ("SANDBOX" as const)
        : ("PRODUCTION" as const),
    baseUrl:
      environment === "sandbox"
        ? "https://sandbox.cashfree.com/pg"
        : "https://api.cashfree.com/pg",
  };
};

const cashfreeRequest = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<T> => {
  const config = getConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      "x-client-id": config.appId,
      "x-client-secret": config.secretKey,
      "x-api-version": config.apiVersion,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!response.ok) {
    const message =
      data.message || data.type || `Cashfree API failed (${response.status})`;
    // Do not log or return secrets. Keep provider response details limited to a useful message.
    throw new Error(`Cashfree API error: ${message}`);
  }
  return data as T;
};

const paymentMethodsFor = (
  method: CashfreePaymentMethod,
): string | undefined => {
  if (method === "CARD") return "cc,dc";
  if (method.startsWith("UPI_")) return "upi";
  // Do not send an undocumented wallet filter; available wallet methods are controlled by Cashfree merchant configuration.
  return undefined;
};

export const createCashfreeOrder = async (
  input: CreateCashfreeOrderInput,
): Promise<CashfreeOrderSession> => {
  const config = getConfig();
  const phone = input.customerPhone.replace(/\D/g, "").slice(-10);
  if (!/^\d{10}$/.test(phone))
    throw new Error(
      "A valid 10-digit customer phone number is required for Cashfree.",
    );

  const paymentMethods = paymentMethodsFor(input.paymentMethod);
  const body: Record<string, any> = {
    order_id: input.orderId,
    order_amount: Number(input.amount.toFixed(2)),
    order_currency: "INR",
    customer_details: {
      customer_id:
        input.customerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) ||
        `user_${crypto.randomBytes(4).toString("hex")}`,
      customer_name:
        input.customerName
          .replace(/[^a-zA-Z0-9 .'-]/g, " ")
          .trim()
          .slice(0, 100) || "QuickCart Customer",
      customer_phone: phone,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    },
    order_note: "QuickCart mobile order",
  };
  if (paymentMethods) body.order_meta = { payment_methods: paymentMethods };

  const result = await cashfreeRequest<any>("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
  if (!result.order_id || !result.payment_session_id) {
    throw new Error(
      "Cashfree did not return an order ID and payment session ID.",
    );
  }
  return {
    orderId: String(result.order_id),
    paymentSessionId: String(result.payment_session_id),
    amount: Number(result.order_amount ?? input.amount),
    currency: "INR",
    environment: config.environment,
  };
};

export const fetchCashfreePaymentStatus = async (
  orderId: string,
): Promise<CashfreePaymentStatus> => {
  const order = await cashfreeRequest<any>(
    `/orders/${encodeURIComponent(orderId)}`,
    { method: "GET" },
  );
  const payments = await cashfreeRequest<any[]>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { method: "GET" },
  );
  const attempts = Array.isArray(payments) ? payments : [];
  const successful = attempts.find(
    (payment) => String(payment.payment_status).toUpperCase() === "SUCCESS",
  );
  const latest = attempts[0];
  const orderStatus = String(order.order_status || "").toUpperCase();
  const paymentStatus = String(latest?.payment_status || "").toUpperCase();

  if (orderStatus === "PAID" || successful) {
    return {
      status: "paid",
      orderId: String(order.order_id || orderId),
      amount: Number(order.order_amount),
      currency: String(order.order_currency || "INR"),
      transactionId: successful
        ? String(successful.cf_payment_id || successful.payment_id || "") ||
          undefined
        : undefined,
      rawStatus: paymentStatus || orderStatus,
    };
  }
  if (
    ["FAILED", "USER_DROPPED", "CANCELLED", "EXPIRED"].includes(
      paymentStatus,
    ) ||
    ["TERMINATED", "EXPIRED"].includes(orderStatus)
  ) {
    return {
      status: "failed",
      orderId: String(order.order_id || orderId),
      amount: Number(order.order_amount),
      currency: String(order.order_currency || "INR"),
      transactionId: latest?.cf_payment_id
        ? String(latest.cf_payment_id)
        : undefined,
      rawStatus: paymentStatus || orderStatus,
    };
  }
  return {
    status: "pending",
    orderId: String(order.order_id || orderId),
    amount: Number(order.order_amount),
    currency: String(order.order_currency || "INR"),
    transactionId: latest?.cf_payment_id
      ? String(latest.cf_payment_id)
      : undefined,
    rawStatus: paymentStatus || orderStatus || "PENDING",
  };
};
