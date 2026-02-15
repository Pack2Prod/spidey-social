import React, { useState } from 'react';
import Button from '../components/Button';
import { login, register, confirmRegistration, configureAuth } from '../lib/auth';

interface OnboardingProps {
  onStart: () => void;
}

type Mode = 'signin' | 'signup' | 'confirm';

const Onboarding: React.FC<OnboardingProps> = ({ onStart }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      configureAuth();
      const result = await login(email, password);
      if (result.success) {
        onStart();
      } else if (result.needsConfirmation) {
        setMode('confirm');
      } else {
        setError(result.error ?? 'Invalid email or password.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      configureAuth();
      const result = await register(email, password);
      if (result.isSignUpComplete) {
        onStart();
      } else if (result.nextStep?.signUpStep === 'CONFIRM_SIGN_UP') {
        setMode('confirm');
      } else {
        setMode('confirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      configureAuth();
      await confirmRegistration(email, confirmCode);
      onStart();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex flex-col items-center justify-center px-8 text-center overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[url('https://picsum.photos/seed/noir-city/1080/1920')] bg-cover bg-center grayscale contrast-150 opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-noir-black/80 via-noir-black/40 to-noir-black z-0"></div>

      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full text-noir-light">
          <path d="M100 0v200M0 100h200M29 29l142 142M171 29l-142 142" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="50" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>
      </div>

      <div className="z-10 flex flex-col items-center gap-2 mb-16">
        <h1 className="font-display font-black text-5xl text-noir-light uppercase tracking-[0.2em] drop-shadow-[0_0_15px_rgba(139,26,26,0.6)]">
          SPIDEY
          <br />
          SOCIAL
        </h1>
        <div className="h-1 w-24 bg-web-red mb-2"></div>
        <p className="font-display text-noir-smoke italic text-lg tracking-wider">
          Your Friendly Neighborhood Network
        </p>
      </div>

      <div className="z-10 w-full flex flex-col gap-4 max-w-[320px]">
        <div className="bg-noir-charcoal/70 backdrop-blur-xl border border-noir-steel/50 rounded-2xl p-8 shadow-2xl">
          {mode === 'confirm' ? (
            <form onSubmit={handleConfirm} className="flex flex-col gap-4">
              <p className="text-noir-smoke text-sm">Check your email for a verification code.</p>
              <input
                type="text"
                placeholder="Verification code"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                className="w-full bg-noir-graphite border border-noir-steel rounded-lg py-3 px-4 text-sm text-noir-light placeholder:text-noir-ash focus:outline-none focus:border-web-crimson transition-all"
                required
              />
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Confirm'}
              </Button>
            </form>
          ) : mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Spider ID (Email)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-noir-graphite border border-noir-steel rounded-lg py-3 px-4 text-sm text-noir-light placeholder:text-noir-ash focus:outline-none focus:border-web-crimson transition-all"
                required
              />
              <input
                type="password"
                placeholder="Secret Identity Passcode"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-noir-graphite border border-noir-steel rounded-lg py-3 px-4 text-sm text-noir-light placeholder:text-noir-ash focus:outline-none focus:border-web-crimson transition-all"
                required
              />
              {error && <p className="text-web-red text-xs">{error}</p>}
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Swinging In...' : 'Swing In'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-xs uppercase tracking-widest mt-2"
                onClick={() => { setMode('signup'); setError(''); }}
              >
                Apply for an ID
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-noir-graphite border border-noir-steel rounded-lg py-3 px-4 text-sm text-noir-light placeholder:text-noir-ash focus:outline-none focus:border-web-crimson transition-all"
                required
              />
              <input
                type="password"
                placeholder="Password (8+ chars, upper, lower, number)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-noir-graphite border border-noir-steel rounded-lg py-3 px-4 text-sm text-noir-light placeholder:text-noir-ash focus:outline-none focus:border-web-crimson transition-all"
                required
                minLength={8}
              />
              {error && <p className="text-web-red text-xs">{error}</p>}
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Creating ID...' : 'Apply for an ID'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-xs uppercase tracking-widest mt-2"
                onClick={() => { setMode('signin'); setError(''); }}
              >
                Already have an ID? Swing In
              </Button>
            </form>
          )}
        </div>

        <p className="text-[0.6rem] text-noir-ash font-mono uppercase tracking-widest mt-4">
          Strictly for authorized neighborhood heroes only.
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
