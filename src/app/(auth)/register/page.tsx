'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BobLogo } from '@/components/ui/BobLogo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAlert } from '@/context/AlertContext';
import { useDemoAutofill } from '@/context/DemoAutofillContext';
import { useTelemetry } from '@/context/TelemetryContext';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { registerAccount } from '@/services/auth';

/**
 * Port of the Expo app's `(auth)/register.tsx`.
 *
 * Registration no longer lands in the app. It submits the account for bank
 * approval and hands off to `/pending-approval`, which polls until an analyst
 * decides — see DEMO-IMPLEMENTATION-PLAN.md §3.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const showAlert = useAlert();
  const { keystrokeInputProps, pasteHandlers } = useTelemetry();
  const { fingerprintHash } = useDeviceFingerprint();
  const { applicant, consume } = useDemoAutofill();

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // Demo autofill: the panel beside the phone publishes a generated applicant,
  // this writes it into the form. Consumed immediately so pressing the same
  // button again republishes and refills rather than being a no-op.
  useEffect(() => {
    if (!applicant) return;
    setFullName(applicant.fullName);
    setMobile(applicant.mobile);
    setAccountNumber(applicant.accountNumber);
    setPassword(applicant.password);
    setConfirmPassword(applicant.password);
    consume();
  }, [applicant, consume]);

  const passwordRules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'At least one number', met: /[0-9]/.test(password) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const validate = (): string | null => {
    if (fullName.trim().length < 2) return 'Please enter your full name.';
    if (!/^\d{10}$/.test(mobile.trim())) return 'Enter a valid 10-digit mobile number.';
    if (!/^\d{14}$/.test(accountNumber.trim())) return 'Enter a valid 14-digit account number.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
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
    // Small delay so the loading state is visible even on a fast connection.
    setTimeout(async () => {
      const result = await registerAccount(
        {
          fullName: fullName.trim(),
          mobile: mobile.trim(),
          accountNumber: accountNumber.trim(),
        },
        password,
        // The device this account was enrolled on. Approving the request also
        // marks this device trusted, which is what stops the very first login
        // from asking the user to verify against a trusted device they don't
        // have yet. If the fingerprint hook hasn't resolved, the server falls
        // back to a user-agent hash rather than dropping the binding.
        fingerprintHash ? { fingerprint: fingerprintHash, label: '' } : undefined
      );
      setLoading(false);
      if (!result.ok) {
        showAlert(
          'Something went wrong',
          result.error ?? 'Could not create your account. Please try again.'
        );
        return;
      }
      router.replace('/pending-approval');
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
              label="Account Number"
              placeholder="14-digit account number"
              leadingIcon="account-balance"
              value={accountNumber}
              inputMode="numeric"
              maxLength={14}
              onValueChange={(v) => setAccountNumber(v.replace(/[^0-9]/g, '').slice(0, 14))}
            />
            <Input
              label="Password"
              placeholder="Min 8 chars, 1 number & 1 special character"
              leadingIcon="lock-outline"
              isPassword
              value={password}
              onValueChange={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onPaste={pasteHandlers.onPaste}
              onFocusCapture={pasteHandlers.onFocusCapture}
              onChangeTextCapture={pasteHandlers.onChangeTextCapture}
              {...keystrokeInputProps()}
            />
            {(passwordFocused || password.length > 0) && (
              <div style={{
                marginTop: -6,
                marginBottom: 8,
                padding: '10px 14px',
                background: 'var(--surface-low)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                {passwordRules.map((rule) => (
                  <div
                    key={rule.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12,
                      fontFamily: 'var(--font-body)',
                      color: rule.met ? 'var(--success)' : 'var(--on-surface-variant)',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    <span
                      className="material-icons"
                      style={{ fontSize: 14, color: rule.met ? 'var(--success)' : 'var(--outline)' }}
                    >
                      {rule.met ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    {rule.label}
                  </div>
                ))}
              </div>
            )}
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
