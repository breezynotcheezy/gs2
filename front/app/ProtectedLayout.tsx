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

const BottomNav = dynamic(
  () => import('@/components/BottomNav'),
  { ssr: false }
);

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PasswordProtect>
      <div className="pb-28">{children}</div>
      <div className="relative z-50">
        <Chatbot />
      </div>
      <BottomNav />
    </PasswordProtect>
  );
}
