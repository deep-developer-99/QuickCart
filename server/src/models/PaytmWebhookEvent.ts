import mongoose, { Document, Schema } from "mongoose";

export interface IPaytmWebhookEvent extends Document {
  eventKey: string;
  orderId: string;
  status: string;
  txnType: string;
  processedAt: Date;
  createdAt: Date;
}

const paytmWebhookEventSchema = new Schema<IPaytmWebhookEvent>(
  {
    eventKey: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    status: { type: String, required: true },
    txnType: { type: String, required: true, default: "SALE" },
    processedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const PaytmWebhookEvent = mongoose.model<IPaytmWebhookEvent>(
  "PaytmWebhookEvent",
  paytmWebhookEventSchema,
);
export default PaytmWebhookEvent;
