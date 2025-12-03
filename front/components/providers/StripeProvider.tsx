'use client';

import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { getStripePublishableKey } from '@/lib/stripe';

// Initialize Stripe outside of the component to avoid recreating the object on each render
let stripePromise: ReturnType<typeof loadStripe> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = getStripePublishableKey();
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

export function StripeProvider({ children }: { children: React.ReactNode }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // You can fetch a client secret here if needed for setup intents or payment intents
  // This is just a placeholder - you might not need it for simple checkout flows
  useEffect(() => {
    // Fetch client secret if needed
  }, []);

  const options = {
    // clientSecret,
    // appearance: {
    //   theme: 'stripe',
    //   variables: {
    //     colorPrimary: '#2563eb',
    //   },
    // },
  };

  return (
    <Elements stripe={getStripe()} options={options}>
      {children}
    </Elements>
  );
}
