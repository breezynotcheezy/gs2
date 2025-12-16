'use client';

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { getStripePublishableKey } from '@/lib/stripe';

export function StripeProvider({ children }: { children: React.ReactNode }) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    const key = getStripePublishableKey();
    if (!key) {
      console.warn('Stripe publishable key missing; rendering without Stripe Elements');
      setStripePromise(null);
      return;
    }
    setStripePromise(loadStripe(key));
  }, []);

  if (!stripePromise) {
    // No Stripe, render children normally
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
