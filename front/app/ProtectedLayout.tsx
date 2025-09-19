'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const PasswordProtect = dynamic(
  () => import('@/components/PasswordProtect'),
  { ssr: false }
);

const Chatbot = dynamic(
  () => import('@/components/Chatbot'),
  { ssr: false }
);

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PasswordProtect>
      {children}
      <Chatbot />
    </PasswordProtect>
  );
}
