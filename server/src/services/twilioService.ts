import "dotenv/config";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifyServiceSid) {
  throw new Error("Twilio environment variables are missing");
}

const twilioClient = twilio(accountSid, authToken);

// Convert Indian 10-digit number to E.164 format
const formatPhoneNumber = (phone: string): string => {
  const cleanedPhone = phone.trim();

  if (/^\d{10}$/.test(cleanedPhone)) {
    return `+91${cleanedPhone}`;
  }

  return cleanedPhone;
};

export const sendPhoneOtp = async (phone: string): Promise<void> => {
  const formattedPhone = formatPhoneNumber(phone);

  await twilioClient.verify.v2.services(verifyServiceSid).verifications.create({
    to: formattedPhone,
    channel: "sms",
  });
};

export const verifyPhoneOtp = async (
  phone: string,
  code: string,
): Promise<boolean> => {
  const formattedPhone = formatPhoneNumber(phone);

  const verificationCheck = await twilioClient.verify.v2
    .services(verifyServiceSid)
    .verificationChecks.create({
      to: formattedPhone,
      code,
    });

  return verificationCheck.status === "approved";
};
