'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordProtect({ children }: { children: React.ReactNode }) {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('isAuthenticated');
      if (auth === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'discoparty2025?!') {
      setIsAuthenticated(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('isAuthenticated', 'true');
      }
    } else {
      alert('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      color: 'white',
      flexDirection: 'column',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Enter Password</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '300px' }}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            padding: '10px',
            fontSize: '1rem',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            outline: 'none'
          }}
          placeholder="Enter password"
          autoFocus
        />
        <button
          type="submit"
          style={{
            padding: '10px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          Enter Site
        </button>
      </form>
    </div>
  );
}
