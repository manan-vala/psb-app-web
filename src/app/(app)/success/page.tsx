'use client';

import { Suspense, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { formatCurrency } from '@/constants/mock';
import { useTelemetry } from '@/context/TelemetryContext';
import { reportPayment } from '@/services/api';

const CONFETTI_COLORS = ['#FF6600', '#4ade80', '#60a5fa', '#f472b6', '#facc15', '#a78bfa'];

/** Port of the Expo app's `(app)/success.tsx`. */
function SuccessScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { lastAssessment } = useTelemetry();

  const amount = params.get('amount') ?? '0';
  const payeeName = params.get('payeeName') ?? 'Unknown Payee';

  const refNo = useRef(`PSB${Date.now().toString().slice(-9)}`).current;
  const transactionDate = useRef(new Date()).current;
  const reported = useRef(false);

  const confetti = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        rotate: Math.random() > 0.5 ? 360 : -360,
      })),
    []
  );

  useEffect(() => {
    if (reported.current || !amount) return;
    reported.current = true;

    // Unlike the native app (which hardcoded riskScore 10 / ALLOW), report the
    // real verdict this transaction was actually approved under.
    reportPayment(
      amount,
      payeeName,
      refNo,
      lastAssessment?.riskScore ?? 10,
      lastAssessment?.action ?? 'ALLOW',
      transactionDate.getTime()
    );
  }, [amount, payeeName, refNo, transactionDate, lastAssessment]);

  const handleShare = async () => {
    const message = `Payment of ₹${amount} to ${payeeName} was successful!\nRef No: ${refNo}\nDate: ${transactionDate.toLocaleString()}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
      } else {
        await navigator.clipboard.writeText(message);
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="screen">
      <style>{`
        @keyframes confetti-fall {
          from { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          70%  { opacity: 1; }
          to   { transform: translateY(420px) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes check-pop {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes card-rise {
          from { transform: translateY(60px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 400,
          overflow: 'hidden',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {confetti.map((p) => (
          <span
            key={p.id}
            style={
              {
                position: 'absolute',
                top: 0,
                left: `${p.left}%`,
                width: 8,
                height: 8,
                borderRadius: p.id % 2 ? 4 : 1,
                background: p.color,
                '--rot': `${p.rotate}deg`,
                animation: `confetti-fall 1.2s ${p.delay}s ease-in forwards`,
                opacity: 0,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="scroll">
        <div className="scroll__content text-center" style={{ paddingTop: 48 }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 112,
              height: 112,
              borderRadius: '50%',
              background: 'rgba(74,222,128,0.2)',
              margin: '0 auto var(--stack-lg)',
              animation: 'check-pop 0.4s 0.2s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            <span
              className="flex items-center justify-center"
              style={{
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: 'var(--success)',
                color: '#fff',
                boxShadow: 'var(--shadow-high)',
              }}
            >
              <Icon name="check" size={52} />
            </span>
          </div>

          <h1 className="t-headline-md mb-sm">Payment Successful!</h1>
          <p className="t-body-sm c-variant" style={{ marginBottom: 32 }}>
            Your transfer has been processed securely.
          </p>

          <div
            className="card"
            style={{ animation: 'card-rise 0.45s 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <div style={{ height: 4, background: 'var(--success)' }} />

            <div style={{ padding: '28px 20px' }}>
              <div
                className="t-label-md c-variant mb-sm"
                style={{ textTransform: 'uppercase' }}
              >
                Amount Paid
              </div>
              <div className="t-display-lg c-primary" style={{ fontSize: 36 }}>
                ₹ {formatCurrency(parseFloat(amount || '0'))}
              </div>
            </div>

            <div
              style={{
                margin: '0 20px',
                borderTop: '1px dashed var(--outline-variant)',
              }}
            />

            <div style={{ padding: '8px 20px' }}>
              <DetailRow icon="person" label="Paid To" value={payeeName} />
              <DetailRow
                icon="calendar-today"
                label="Date & Time"
                value={formatDate(transactionDate)}
              />
              <DetailRow icon="receipt-long" label="Reference No." value={refNo} />
              <DetailRow icon="lock" label="Security" value="256-bit Encrypted" highlight />
            </div>

            <div
              style={{
                margin: '0 20px',
                borderTop: '1px dashed var(--outline-variant)',
              }}
            />

            <div
              className="flex justify-between items-center"
              style={{ padding: '14px 20px', background: 'var(--surface-low)' }}
            >
              <span className="flex items-center" style={{ gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--success)',
                  }}
                />
                <span
                  className="t-label-md c-success"
                  style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                >
                  Completed
                </span>
              </span>
              <button
                className="flex items-center"
                style={{
                  gap: 4,
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(255,219,208,0.5)',
                  color: 'var(--primary)',
                }}
                onClick={handleShare}
              >
                <Icon name="share" size={18} />
                <span className="t-label-md">Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '12px var(--margin-mobile) 16px',
          borderTop: '1px solid var(--surface-highest)',
          display: 'grid',
          gap: 10,
        }}
      >
        <button
          className="flex items-center justify-center"
          style={{
            gap: 8,
            background: 'var(--primary)',
            color: '#fff',
            borderRadius: 'var(--radius)',
            height: 52,
          }}
          onClick={() => router.replace('/home')}
        >
          <Icon name="home" size={20} />
          <span className="t-body-md fw-medium">Back to Home</span>
        </button>
        <button
          className="t-label-md c-variant"
          style={{ height: 44 }}
          onClick={() => router.replace('/transfer')}
        >
          New Transfer
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center" style={{ padding: '10px 0' }}>
      <span className="flex items-center flex-1" style={{ gap: 6 }}>
        <Icon name={icon} size={14} color="var(--on-surface-variant)" />
        <span className="t-body-sm c-variant">{label}</span>
      </span>
      <span
        className={`t-body-md fw-medium text-right${highlight ? ' c-success' : ''}`}
        style={{ marginLeft: 12 }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="loading-screen">
          <span className="spinner" style={{ width: 34, height: 34 }} />
        </div>
      }
    >
      <SuccessScreen />
    </Suspense>
  );
}
