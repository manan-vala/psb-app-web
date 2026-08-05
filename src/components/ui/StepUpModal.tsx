'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';

/**
 * Adaptive-friction step-up, shown when the risk orchestrator returns
 * `STEP_UP`.
 *
 * The native app used a biometric prompt here. There's no dependable web
 * equivalent (most desktops have no fingerprint or face sensor), so this uses
 * the mocked verification the PRD specifies for the demo: a short processing
 * pause that always resolves successfully.
 */
export function StepUpModal({
  reason,
  onSuccess,
  onCancel,
}: {
  reason?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [verifying, setVerifying] = useState(false);

  const verify = () => {
    setVerifying(true);
    setTimeout(onSuccess, 1500);
  };

  return (
    <div className="modal__overlay" role="dialog" aria-modal="true">
      <div className="modal stepup">
        <div className={`stepup__icon${verifying ? ' stepup__icon--scanning' : ''}`}>
          <Icon name="verified-user" size={44} />
        </div>

        <h2 className="modal__title text-center">Additional Verification</h2>
        <p className="modal__message text-center">
          {reason ??
            'This session showed unusual signals. Confirm to continue.'}
        </p>

        <div className="mt-lg" style={{ display: 'grid', gap: 10 }}>
          <Button
            label={verifying ? 'Verifying…' : 'Verify & Continue'}
            icon="check-circle"
            loading={verifying}
            onClick={verify}
          />
          <Button
            label="Cancel"
            variant="ghost"
            onClick={onCancel}
            disabled={verifying}
            style={{ height: 44 }}
          />
        </div>
      </div>
    </div>
  );
}
