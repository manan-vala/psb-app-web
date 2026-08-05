'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BobLogo } from '@/components/ui/BobLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAlert } from '@/context/AlertContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { registerAccount } from '@/services/auth';

/** Port of the Expo app's `(auth)/register.tsx`. */
export default function RegisterScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { keystrokeInputProps, pasteHandlers } = useTelemetry();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (fullName.trim().length < 2) return 'Please enter your full name.';
    if (!/^[6-9]\d{9}$/.test(mobile.trim())) return 'Enter a valid 10-digit mobile number.';
    if (email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return 'Password must include both letters and numbers.';
    }
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleCreateAccount = () => {
    const error = validate();
    if (error) {
      showAlert('Check your details', error);
      return;
    }

    setLoading(true);
    // Simulated provisioning delay — the account lives on-device.
    setTimeout(async () => {
      try {
        await registerAccount(
          {
            fullName: fullName.trim(),
            mobile: mobile.trim(),
            email: email.trim() || undefined,
          },
          password
        );
        setLoading(false);
        router.replace('/set-pin');
      } catch {
        setLoading(false);
        showAlert('Something went wrong', 'Could not create your account. Please try again.');
      }
    }, 600);
  };

  return (
    <div className="screen">
      <span className="blob blob--top-right" />
      <div className="scroll">
        <div className="scroll__content" style={{ paddingTop: 40 }}>
          <div className="text-center mb-lg">
            <div className="hero-icon">
              <BobLogo size={64} />
            </div>
            <h1 className="t-headline-md c-primary">Create Your Account</h1>
            <p className="t-body-md c-variant" style={{ marginTop: 6 }}>
              Set up secure access to Bob World
            </p>
          </div>

          <div className="mb-md">
            <Input
              label="Full Name"
              placeholder="As per your bank records"
              leadingIcon="person"
              value={fullName}
              autoCapitalize="words"
              onValueChange={setFullName}
            />
            <Input
              label="Mobile Number"
              placeholder="10-digit mobile number"
              leadingIcon="smartphone"
              value={mobile}
              inputMode="numeric"
              maxLength={10}
              onValueChange={(v) => setMobile(v.replace(/[^0-9]/g, '').slice(0, 10))}
            />
            <Input
              label="Email (optional)"
              placeholder="you@example.com"
              leadingIcon="mail-outline"
              value={email}
              inputMode="email"
              onValueChange={setEmail}
            />
            <Input
              label="Password"
              placeholder="At least 8 characters"
              leadingIcon="lock-outline"
              isPassword
              value={password}
              onValueChange={setPassword}
              onPaste={pasteHandlers.onPaste}
              onFocusCapture={pasteHandlers.onFocusCapture}
              onChangeTextCapture={pasteHandlers.onChangeTextCapture}
              {...keystrokeInputProps()}
            />
            <Input
              label="Confirm Password"
              placeholder="Re-enter your password"
              leadingIcon="lock-outline"
              isPassword
              value={confirmPassword}
              onValueChange={setConfirmPassword}
            />
          </div>

          <Button
            label="Create Account"
            icon="arrow-forward"
            onClick={handleCreateAccount}
            loading={loading}
          />

          <p className="t-label-md c-variant text-center mt-md" style={{ padding: '0 8px' }}>
            By continuing, you agree to Bob World&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
