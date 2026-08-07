'use client';

import { useState } from 'react';
import { Icon } from './ui/Icon';
import { useDemoAutofill, type DemoApplicant } from '@/context/DemoAutofillContext';

/**
 * Demo shortcut beside the phone on `/register`: generates an applicant from a
 * real unclaimed core-banking record and fills the registration form with it.
 *
 * Two buttons because the demo has two endings. A valid applicant sails
 * through the analyst's check; a wrong-surname one is the reject path — its
 * name won't match what the passbook says, so approval stays locked and the
 * analyst has a genuine reason to decline.
 *
 * Nothing is submitted automatically. The fields fill in and the form is left
 * for whoever is presenting to look over and send, so the audience sees the
 * details that are about to be verified.
 */
export function RegisterDemoPanel() {
  const { publish } = useDemoAutofill();

  const [loading, setLoading] = useState<'valid' | 'wrong-surname' | null>(null);
  const [last, setLast] = useState<DemoApplicant | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (variant: 'valid' | 'wrong-surname') => {
    setLoading(variant);
    setError(null);
    try {
      const res = await fetch(`/api/demo/applicant?variant=${variant}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not generate a demo applicant.');
        return;
      }
      publish(data as DemoApplicant);
      setLast(data as DemoApplicant);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="demo-panel">
      <div className="demo-panel__head">
        <Icon name="bolt" size={13} />
        <span>Demo autofill</span>
      </div>

      <div className="demo-panel__actions">
        <button
          type="button"
          className="demo-panel__btn demo-panel__btn--valid"
          onClick={() => generate('valid')}
          disabled={loading !== null}
        >
          {loading === 'valid' ? 'Generating…' : 'Valid applicant'}
        </button>
        <button
          type="button"
          className="demo-panel__btn demo-panel__btn--invalid"
          onClick={() => generate('wrong-surname')}
          disabled={loading !== null}
        >
          {loading === 'wrong-surname' ? 'Generating…' : 'Wrong surname'}
        </button>
      </div>

      {error ? (
        <p className="demo-panel__note demo-panel__note--error">{error}</p>
      ) : last ? (
        <div className="demo-panel__note">
          {last.variant === 'wrong-surname' ? (
            <>
              Filled <strong>{last.fullName}</strong> — the passbook says{' '}
              <strong>{last.passbookName}</strong>, so the bank will reject this one.
            </>
          ) : (
            <>
              Filled <strong>{last.fullName}</strong>, matching the passbook exactly.
            </>
          )}
          <span className="demo-panel__count">
            {last.accountsRemaining - 1} demo account
            {last.accountsRemaining - 1 === 1 ? '' : 's'} left
          </span>
        </div>
      ) : (
        <p className="demo-panel__note">
          Fills the form from a real core-banking record. Review it, then tap Create
          Account.
        </p>
      )}
    </div>
  );
}
