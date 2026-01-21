'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirebaseAuth } from '@/components/firebase-auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, AlertCircle, UserPlus } from 'lucide-react';

const AUTH_KEY = 'streamverse_authenticated';
const ACCOUNT_KEY = 'streamverse_account_created';

async function verifyPin(pin: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export function PinGate({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { user, loading, signInWithGoogle } = useFirebaseAuth();

  useEffect(() => {
    // Check if account was created (signed in with Google at least once)
    const accountCreated = localStorage.getItem(ACCOUNT_KEY);
    setHasAccount(accountCreated === 'true');
    
    // If user just signed in with Google for the first time, mark account as created
    if (!loading && user && !accountCreated) {
      localStorage.setItem(ACCOUNT_KEY, 'true');
      setHasAccount(true);
    }
    
    // Check if already authenticated via PIN in this session
    if (!loading) {
      const authenticated = sessionStorage.getItem(AUTH_KEY);
      setIsAuthenticated(authenticated === 'true');
    }
  }, [loading, user]);

  const handlePinChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError('');

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (value && index === 3 && newPin.every(d => d !== '')) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 4);
    if (/^\d{1,4}$/.test(pastedData)) {
      const newPin = [...pin];
      for (let i = 0; i < pastedData.length; i++) {
        newPin[i] = pastedData[i];
      }
      setPin(newPin);
      
      if (pastedData.length === 4) {
        handleSubmit(pastedData);
      } else {
        inputRefs.current[pastedData.length]?.focus();
      }
    }
  };

  const handleSubmit = async (pinCode?: string) => {
    const code = pinCode || pin.join('');
    if (code.length !== 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setIsVerifying(true);
    setError('');

    const isValid = await verifyPin(code);

    if (isValid) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }

    setIsVerifying(false);
  };

  // Show loading state while checking authentication
  if (isAuthenticated === null || hasAccount === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show Google sign-up screen if no account created yet
  if (!hasAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to StreamVerse</CardTitle>
            <CardDescription>
              Sign in with Google to create your account and enable fast downloads
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => signInWithGoogle()} className="w-full h-12 text-base">
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Get Started with Google
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-4">
              This enables 🚀 Turbo Mode for 40-60+ MB/s downloads from Google Drive
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show PIN entry screen if account exists but not authenticated this session
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription>
              Enter your 4-digit PIN to access StreamVerse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex justify-center gap-3">
                {pin.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="h-14 w-14 text-center text-2xl font-bold"
                    autoFocus={index === 0}
                    disabled={isVerifying}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button
                onClick={() => handleSubmit()}
                disabled={pin.some(d => d === '') || isVerifying}
                className="w-full"
              >
                {isVerifying ? 'Verifying...' : 'Unlock'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is authenticated, show the app
  return <>{children}</>;
}
