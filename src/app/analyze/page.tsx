'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BobLogo } from '@/components/ui/BobLogo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PinDots, PinKeypad } from '@/components/ui/PinKeypad';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { PAYEES } from '@/constants/mock';
import { useAnalyzeCapture } from '@/context/AnalyzeCaptureContext';
import styles from './analyze.module.css';

const DEMO_PIN = '1234';
const MAX_ATTEMPTS = 5;

type Screen = 'splash' | 'lock' | 'transfer' | 'done';

/**
 * Live capture-layer demo. Same phone chrome and components as the real Bob
 * World screens (TopAppBar, BobLogo, PinKeypad, Button, mock payees) — this
 * page's job is only to prove that touch, motion, keystroke and transaction
 * signals can be captured live, not to look like a different product. The
 * live telemetry panel renders beside the phone (see CaptureSidebar).
 * Nothing here calls the Aegis backend; all capture is local and resets on
 * refresh.
 */
export default function AnalyzePage() {
  const router = useRouter();
  const {
    touchBind,
    keystrokeInputProps,
    registerVirtualKeypress,
    startSensors,
    visitScreen,
    recordFailedPin,
    recordTransaction,
    resetAll,
    keystrokeCount,
    touch,
  } = useAnalyzeCapture();

  const [screen, setScreen] = useState<Screen>('splash');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [payeeId, setPayeeId] = useState<string | null>(null);

  const go = (next: Screen) => {
    setScreen(next);
    visitScreen(next);
  };

  useEffect(() => {
    visitScreen('splash');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTapToBegin = () => {
    startSensors();
    go('lock');
  };

  const handlePinComplete = (value: string) => {
    setBusy(true);
    setTimeout(() => {
      if (value === DEMO_PIN) {
        go('transfer');
        setBusy(false);
        return;
      }
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      recordFailedPin();
      setPinError(true);
      setTimeout(() => {
        setPin('');
        setPinError(false);
        setBusy(false);
      }, 500);
    }, 250);
  };

  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - attempts);
  const canSend = amount.trim().length > 0 && payeeId !== null;

  const handleSend = () => {
    if (!canSend || payeeId === null) return;
    const payee = PAYEES.find((p) => p.id === payeeId);
    recordTransaction({
      amount: Number(amount) || 0,
      payee: payee?.name ?? 'Unknown',
      isNewPayee: false,
      payeeTxnCount: 3,
    });
    go('done');
  };

  const handleRestart = () => {
    resetAll();
    setScreen('splash');
    setPin('');
    setPinError(false);
    setAttempts(0);
    setAmount('');
    setPayeeId(null);
  };

  return (
    <div className="screen" {...touchBind}>
      <TopAppBar
        title="Live Capture Demo"
        showBackIcon
        onBackPress={() => router.push('/')}
        rightElement={<span className={styles.demoBadge}>DEMO</span>}
      />

      {screen === 'splash' && (
        <>
          <span className="blob blob--top-right" />
          <div className="scroll">
            <div
              className="scroll__content flex-col items-center justify-center"
              style={{ minHeight: '100%' }}
            >
              <div className="text-center" style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <BobLogo size={72} />
                </div>
                <h1 className="t-display-lg c-primary">Bob World</h1>
                <p className="t-body-md c-variant" style={{ marginTop: 8, padding: '0 12px' }}>
                  Watch touch, motion, keystroke and transaction signals get
                  captured live as you use the app.
                </p>
              </div>
              <Button label="Tap to begin" icon="touch-app" onClick={handleTapToBegin} />
              <p className="t-body-sm c-variant" style={{ marginTop: 20 }}>
                Enables motion &amp; touch sensors for this device
              </p>
            </div>
          </div>
        </>
      )}

      {screen === 'lock' && (
        <>
          <span className="blob blob--top-right" />
          <div className="scroll">
            <div
              className="scroll__content flex-col items-center justify-center"
              style={{ minHeight: '100%' }}
            >
              <div className="text-center" style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <BobLogo size={64} />
                </div>
                <h1 className="t-headline-md c-primary">Enter app PIN</h1>
                <p className="t-body-sm c-variant" style={{ marginTop: 8 }}>
                  Demo PIN: {DEMO_PIN}
                </p>
              </div>

              <div className="w-full">
                <PinDots length={4} filled={pin.length} error={pinError} />
                <p
                  className="t-body-sm text-center"
                  style={{ color: 'var(--error)', minHeight: 18, marginTop: -22, marginBottom: 18 }}
                >
                  {pinError ? `Incorrect PIN — ${attemptsLeft} attempts left` : ''}
                </p>
                <PinKeypad
                  pin={pin}
                  maxLength={4}
                  onChangePin={setPin}
                  onComplete={handlePinComplete}
                  onKeypress={registerVirtualKeypress}
                  disabled={busy}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {screen === 'transfer' && (
        <div className="scroll">
          <div className="scroll__content pad-nav">
            <div className="mb-lg">
              <p className="section-label text-center">AMOUNT</p>
              <div
                className="card flex-col items-center"
                style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}
              >
                <div className="flex items-center justify-center" style={{ gap: 4 }}>
                  <span className="t-display-lg c-secondary" style={{ opacity: 0.8 }}>
                    ₹
                  </span>
                  <input
                    className="t-display-lg c-primary"
                    style={{
                      textAlign: 'center',
                      minWidth: 120,
                      maxWidth: 200,
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                    }}
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    {...keystrokeInputProps()}
                  />
                </div>
              </div>
            </div>

            <div className="mb-lg">
              <p className="section-label">PAY TO</p>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  overflowX: 'auto',
                  paddingBottom: 4,
                  scrollbarWidth: 'none',
                }}
              >
                {PAYEES.map((p) => {
                  const isSelected = payeeId === p.id;
                  return (
                    <button
                      key={p.id}
                      className="flex-col items-center"
                      style={{ width: 72, flexShrink: 0 }}
                      onClick={() => setPayeeId(p.id)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image}
                        alt=""
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          marginBottom: 8,
                          border: `2px solid ${isSelected ? 'var(--primary)' : 'transparent'}`,
                          boxShadow: 'var(--shadow-low)',
                        }}
                      />
                      <span className="t-label-md text-center truncate w-full">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              label="Send payment"
              icon="arrow-forward"
              disabled={!canSend}
              onClick={handleSend}
            />
          </div>
        </div>
      )}

      {screen === 'done' && (
        <div className="scroll">
          <div
            className="scroll__content flex-col items-center justify-center"
            style={{ minHeight: '100%' }}
          >
            <div
              className="hero-icon hero-icon--sm"
              style={{ background: 'var(--success)', color: '#fff' }}
            >
              <Icon name="check" size={30} />
            </div>
            <h1 className="t-headline-md" style={{ marginTop: 12 }}>
              Session captured
            </h1>
            <p
              className="t-body-md c-variant text-center"
              style={{ marginTop: 8, marginBottom: 24, padding: '0 12px' }}
            >
              Behavioural, touch, motion and transaction signals were recorded
              live — see the panel for the full breakdown.
            </p>
            <div className="flex" style={{ gap: 32, marginBottom: 28 }}>
              <div className="text-center">
                <div className="t-headline-sm c-primary">{keystrokeCount}</div>
                <div className="t-body-sm c-variant">keys</div>
              </div>
              <div className="text-center">
                <div className="t-headline-sm c-primary">{touch.tapCount}</div>
                <div className="t-body-sm c-variant">touches</div>
              </div>
            </div>
            <Button label="Restart demo" variant="secondary" icon="refresh" onClick={handleRestart} />
          </div>
        </div>
      )}
    </div>
  );
}
