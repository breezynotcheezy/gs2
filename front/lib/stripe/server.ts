import Stripe from 'stripe';

// Do not throw at module load; allow consumers to handle missing secrets gracefully.
const secret = process.env.STRIPE_SECRET_KEY || '';

export const stripe = new Stripe(secret, {
  apiVersion: '2024-06-20',
  typescript: true,
});
