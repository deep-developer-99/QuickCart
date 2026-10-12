import crypto from "crypto";
import { Request, Response } from "express";
import PaytmWebhookEvent from "../models/PaytmWebhookEvent";
import { getPaytmWebhookVerificationConfig } from "../services/paytmPaymentService";
import { reconcilePaytmAttemptByOrderId } from "../services/paytmReconciliationService";
import {
  verifyPaytmParameterSignature,
  verifyPaytmSignature,
} from "../utils/paytmChecksum";

type PaytmWebhookEnvelope = {
  head?: { signature?: string };
  body?: {
    mid?: string;
    orderId?: string;
    txnId?: string;
    txnAmount?: string | number;
    currency?: string;
    status?: string;
    txnType?: string;
  };
};

const extractRawJsonProperty = (
  raw: string,
  property: string,
): string | undefined => {
  const keyPattern = new RegExp(`"${property}"\\s*:`);
  const match = keyPattern.exec(raw);
  if (!match) return undefined;
  let start = match.index + match[0].length;
  while (start < raw.length && /\s/.test(raw[start])) start += 1;
  if (raw[start] !== "{" && raw[start] !== "[") return undefined;
  const open = raw[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return undefined;
};

const parseIncomingPayload = (rawBody: string, contentType: string) => {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payload: Record<string, string> = {};
    params.forEach((value, key) => {
      payload[key] = value;
    });
    return { kind: "form" as const, payload };
  }
  return {
    kind: "json" as const,
    payload: JSON.parse(rawBody) as PaytmWebhookEnvelope,
  };
};

/**
 * Paytm S2S webhook. Mount with express.raw() before express.json(). The event
 * is only acknowledged after signature validation and reconciliation succeeds.
 */
export const paytmWebhookController = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!raw || raw.length > 100_000) {
    res.status(400).send("Invalid webhook payload");
    return;
  }

  let parsed: ReturnType<typeof parseIncomingPayload>;
  try {
    parsed = parseIncomingPayload(
      raw,
      String(req.headers["content-type"] || "application/json").toLowerCase(),
    );
  } catch {
    res.status(400).send("Invalid webhook payload");
    return;
  }

  try {
    const { mid, merchantKey } = getPaytmWebhookVerificationConfig();
    let orderId = "";
    let eventStatus = "";
    let txnType = "SALE";

    if (parsed.kind === "json") {
      const envelope = parsed.payload;
      const body = envelope?.body;
      const signature = envelope?.head?.signature;
      const signedBody = extractRawJsonProperty(raw, "body");
      if (
        !body ||
        !signature ||
        !signedBody ||
        !verifyPaytmSignature(signedBody, merchantKey, signature)
      ) {
        res.status(401).send("Invalid signature");
        return;
      }
      if (String(body.mid || "") !== mid) {
        res.status(401).send("Invalid merchant");
        return;
      }
      orderId = String(body.orderId || "");
      eventStatus = String(body.status || "").toUpperCase();
      txnType = String(body.txnType || "SALE").toUpperCase();
    } else {
      const payload = parsed.payload;
      const signature = payload.CHECKSUMHASH;
      if (
        !signature ||
        !verifyPaytmParameterSignature(payload, merchantKey, signature)
      ) {
        res.status(401).send("Invalid signature");
        return;
      }
      if (String(payload.MID || "") !== mid) {
        res.status(401).send("Invalid merchant");
        return;
      }
      orderId = String(payload.ORDERID || "");
      eventStatus = String(payload.STATUS || "").toUpperCase();
      txnType = String(payload.TXNTYPE || "SALE").toUpperCase();
    }

    if (
      !orderId ||
      !["TXN_SUCCESS", "TXN_FAILURE", "PENDING"].includes(eventStatus)
    ) {
      res.status(400).send("Invalid payment event");
      return;
    }

    // Refunds and non-sale events are acknowledged but never treated as new orders.
    if (txnType !== "SALE" && txnType !== "QR_PAYMENT") {
      console.info("Paytm webhook ignored non-payment event", {
        orderId,
        txnType,
        eventStatus,
      });
      res.status(200).send("Event ignored");
      return;
    }

    const eventKey = crypto
      .createHash("sha256")
      .update(`${orderId}|${eventStatus}|${txnType}`)
      .digest("hex");
    const existingEvent = await PaytmWebhookEvent.findOne({ eventKey }).lean();
    if (existingEvent) {
      res.status(200).send("Duplicate event");
      return;
    }

    const reconciled = await reconcilePaytmAttemptByOrderId(orderId);
    // Paytm's webhook is a signal, not the final source of truth. Require the
    // server-to-server status API to reach the same terminal state first.
    if (eventStatus === "TXN_SUCCESS" && reconciled.status === "pending") {
      res.status(503).send("Payment status is not final yet");
      return;
    }
    if (eventStatus === "TXN_FAILURE" && reconciled.status === "pending") {
      res.status(503).send("Payment status is not final yet");
      return;
    }

    await PaytmWebhookEvent.create({
      eventKey,
      orderId,
      status: eventStatus,
      txnType,
      processedAt: new Date(),
    });

    if (reconciled.status === "paid_needs_review") {
      console.error("Paytm payment requires manual order reconciliation", {
        orderId,
        paymentId: reconciled.paymentId,
      });
    } else {
      console.info("Paytm webhook reconciled", {
        orderId,
        eventStatus,
        reconciledStatus: reconciled.status,
      });
    }

    res.status(200).send("OK");
  } catch (error: any) {
    if (error?.code === 11000) {
      res.status(200).send("Duplicate event");
      return;
    }
    console.error(
      "Paytm webhook processing error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    // A 5xx response asks Paytm to retry transient processing failures.
    res.status(503).send("Webhook processing failed; retry later");
  }
};
