import {
  generatePaytmSignature,
  verifyPaytmSignature,
} from "../utils/paytmChecksum";

export interface PaytmTransactionStatus {
  status: "paid" | "pending" | "failed";
  orderId: string;
  amount?: number;
  currency?: string;
  mid?: string;
  transactionId?: string;
  rawStatus?: string;
}

type PaytmApiEnvelope = {
  head?: { signature?: string; [key: string]: unknown };
  body?: Record<string, any>;
};

const getConfig = () => {
  const mid = process.env.PAYTM_MID?.trim();
  const merchantKey = process.env.PAYTM_MERCHANT_KEY?.trim();
  const website = process.env.PAYTM_WEBSITE_NAME?.trim();
  const callbackTemplate = process.env.PAYTM_CALLBACK_URL?.trim();
  const environment = (process.env.PAYTM_ENV || "staging").trim().toLowerCase();
  const isStaging = environment === "staging" || environment === "test";

  if (!mid || !merchantKey || !website || !callbackTemplate) {
    throw new Error(
      "Paytm configuration is incomplete. Set PAYTM_ENV, PAYTM_MID, PAYTM_MERCHANT_KEY, PAYTM_WEBSITE_NAME and PAYTM_CALLBACK_URL.",
    );
  }
  if (!isStaging && environment !== "production") {
    throw new Error("PAYTM_ENV must be staging or production");
  }
  if (Buffer.byteLength(merchantKey, "utf8") !== 16) {
    throw new Error(
      "PAYTM_MERCHANT_KEY must be the 16-byte key issued for the selected Paytm environment",
    );
  }

  return {
    mid,
    merchantKey,
    website,
    callbackTemplate,
    isStaging,
    baseUrl: isStaging
      ? "https://securestage.paytmpayments.com"
      : "https://secure.paytmpayments.com",
  };
};

const extractRawJsonProperty = (
  raw: string,
  property: string,
): string | undefined => {
  const match = new RegExp(`"${property}"\\s*:`).exec(raw);
  if (!match) return undefined;
  let start = match.index + match[0].length;
  while (start < raw.length && /\s/.test(raw[start])) start += 1;
  if (raw[start] !== "{" && raw[start] !== "[") return undefined;
  const open = raw[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const character = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return undefined;
};

const postPaytm = async (
  url: string,
  body: Record<string, unknown>,
  headExtras: Record<string, string> = {},
): Promise<PaytmApiEnvelope> => {
  const { merchantKey } = getConfig();
  // Keep this exact JSON string for signing and sending.
  const bodyJson = JSON.stringify(body);
  const signature = generatePaytmSignature(bodyJson, merchantKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ body, head: { ...headExtras, signature } }),
      signal: controller.signal,
    });
    const rawResponse = await response.text();
    if (!response.ok)
      throw new Error(`Paytm API returned HTTP ${response.status}`);
    let envelope: PaytmApiEnvelope;
    try {
      envelope = JSON.parse(rawResponse) as PaytmApiEnvelope;
    } catch {
      throw new Error("Paytm returned an invalid response");
    }
    if (!envelope?.body || typeof envelope.body !== "object") {
      throw new Error("Paytm response did not contain a body");
    }
    const responseSignature = envelope.head?.signature;
    const signedResponseBody = extractRawJsonProperty(rawResponse, "body");
    if (
      !responseSignature ||
      !signedResponseBody ||
      !verifyPaytmSignature(signedResponseBody, merchantKey, responseSignature)
    ) {
      throw new Error("Paytm response signature verification failed");
    }
    return envelope;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Paytm request timed out. Check payment status before retrying.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const createPaytmTransaction = async (args: {
  orderId: string;
  amount: number;
  customerId: string;
  address?: string;
  mobile?: string;
  email?: string;
  firstName?: string;
}) => {
  if (!Number.isFinite(args.amount) || args.amount <= 0)
    throw new Error("Invalid Paytm payment amount");
  if (!/^[A-Za-z0-9@._-]{1,50}$/.test(args.orderId))
    throw new Error("Invalid Paytm order ID format");

  const config = getConfig();
  const callbackUrl = config.callbackTemplate.includes(":orderId")
    ? config.callbackTemplate.replace(
        ":orderId",
        encodeURIComponent(args.orderId),
      )
    : config.callbackTemplate.replace(
        "#OrderId#",
        encodeURIComponent(args.orderId),
      );
  const body: Record<string, unknown> = {
    requestType: "Payment",
    mid: config.mid,
    websiteName: config.website,
    orderId: args.orderId,
    callbackUrl,
    txnAmount: { value: args.amount.toFixed(2), currency: "INR" },
    userInfo: {
      custId: args.customerId.replace(/[^A-Za-z0-9@!=$._-]/g, "").slice(0, 50),
      ...(args.mobile
        ? { mobile: args.mobile.replace(/\D/g, "").slice(-10) }
        : {}),
      ...(args.email ? { email: args.email.slice(0, 100) } : {}),
      ...(args.firstName ? { firstName: args.firstName.slice(0, 50) } : {}),
    },
  };

  const url = `${config.baseUrl}/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(config.mid)}&orderId=${encodeURIComponent(args.orderId)}`;
  const response = await postPaytm(url, body, { channelId: "WAP" });
  const result = response.body?.resultInfo ?? {};
  const token = response.body?.txnToken ?? response.body?.txn_token;
  if (result.resultStatus !== "S" || !token) {
    throw new Error(
      `Paytm could not initiate the transaction${result.resultMsg ? `: ${String(result.resultMsg)}` : ""}`,
    );
  }

  return {
    mid: config.mid,
    orderId: args.orderId,
    txnToken: String(token),
    amount: args.amount.toFixed(2),
    callbackUrl,
    isStaging: config.isStaging,
  };
};

export const fetchPaytmTransactionStatus = async (
  orderId: string,
): Promise<PaytmTransactionStatus> => {
  const config = getConfig();
  const body = { mid: config.mid, orderId };
  const url = `${config.baseUrl}/merchant-status/api/v1/getPaymentStatus?mid=${encodeURIComponent(config.mid)}&orderId=${encodeURIComponent(orderId)}`;
  const response = await postPaytm(url, body);
  const result = response.body?.resultInfo ?? {};
  const rawStatus = String(
    response.body?.txnStatus ?? response.body?.STATUS ?? "",
  ).toUpperCase();
  const returnedOrderId = String(
    response.body?.orderId ?? response.body?.ORDERID ?? "",
  );
  const amountValue =
    response.body?.txnAmount ??
    response.body?.TXNAMOUNT ??
    response.body?.amount;
  const amount = amountValue === undefined ? undefined : Number(amountValue);
  const transactionId =
    response.body?.txnId ??
    response.body?.TXNID ??
    response.body?.bankTxnId ??
    response.body?.BANKTXNID;
  const returnedMid = response.body?.mid ?? response.body?.MID;
  const currency = response.body?.currency ?? response.body?.CURRENCY;

  let status: PaytmTransactionStatus["status"] = "pending";
  if (rawStatus === "TXN_SUCCESS") status = "paid";
  else if (["TXN_FAILURE", "TXN_CANCELLED"].includes(rawStatus))
    status = "failed";
  // NO_RECORD_FOUND and unknown statuses remain pending: never fail a payment
  // merely because Paytm has not propagated it to the status endpoint yet.

  return {
    status,
    orderId: returnedOrderId,
    amount,
    currency: currency ? String(currency) : undefined,
    mid: returnedMid ? String(returnedMid) : undefined,
    transactionId: transactionId ? String(transactionId) : undefined,
    rawStatus: rawStatus || String(result.resultStatus ?? "UNKNOWN"),
  };
};

export const getPaytmPublicConfig = () => {
  const config = getConfig();
  return { mid: config.mid, isStaging: config.isStaging };
};

export const getPaytmWebhookVerificationConfig = () => {
  const config = getConfig();
  return { mid: config.mid, merchantKey: config.merchantKey };
};
