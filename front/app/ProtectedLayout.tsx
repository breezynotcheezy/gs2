'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const PasswordProtect = dynamic(
  () => import('../components/PasswordProtect'),
  { ssr: false }
);

const Chatbot = dynamic(
  () => import('../components/Chatbot'),
  { ssr: false }
);

const BottomNav = dynamic(
  () => import('../components/BottomNav'),
  { ssr: false }
);

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isPro = pathname?.startsWith('/pro');
  return (
    <PasswordProtect>
      <div className={`pb-28 ${isPro ? 'lg:pb-0' : ''}`}>{children}</div>
      <div className={'relative z-50'}>
        <Chatbot />
      </div>
      <div>
        <BottomNav />
      </div>
    </PasswordProtect>
  );
}
