export const getStripePublishableKey = (): string | null => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || null;
};
