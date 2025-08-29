'use client';

import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import SignOutButton from './SignOutButton';

export default function AuthProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <div className="fixed top-4 right-4 z-50">
        {session?.user ? <SignOutButton /> : null}
      </div>
      {children}
    </SessionProvider>
  );
}
