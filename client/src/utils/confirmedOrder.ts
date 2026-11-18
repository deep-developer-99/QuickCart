export interface OrderConfirmationResponse<T extends { _id: string }> {
  success?: boolean;
  message?: string;
  data?: { order?: T };
}

export const getConfirmedOrder = <T extends { _id: string }>(
  response: OrderConfirmationResponse<T> | null | undefined,
  failureMessage: string,
): T => {
  const order = response?.success === true ? response.data?.order : undefined;
  if (!order?._id) throw new Error(response?.message || failureMessage);
  return order;
};
