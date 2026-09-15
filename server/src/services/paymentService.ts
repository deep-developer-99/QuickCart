interface FakePaymentResult {
  success: boolean;
  paymentId: string;
}

export const processFakeRazorpayPayment = async (
  amount: number,
): Promise<FakePaymentResult> => {
  if (amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  // Simulate Razorpay processing
  await new Promise((resolve) => {
    setTimeout(resolve, 1000);
  });

  return {
    success: true,
    paymentId: `fake_razorpay_${Date.now()}`,
  };
};
