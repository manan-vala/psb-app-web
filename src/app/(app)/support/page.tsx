'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useAlert } from '@/context/AlertContext';
import { useDrawer } from '@/context/DrawerContext';

const FAQS = [
  {
    q: 'How do I reset my PIN?',
    a: "Go to the PIN login screen and tap 'Forgot PIN?'. Verify your password to set a new one.",
  },
  {
    q: 'How is my PIN stored?',
    a: 'Your PIN is never stored directly. It is combined with a random salt and hashed, and only that hash is kept on this device.',
  },
  {
    q: 'How do I report a suspicious transaction?',
    a: "Use 'Call Us' or 'Email Us' below to reach our fraud desk immediately.",
  },
  {
    q: 'Can I use the app on a new device?',
    a: 'Yes, just create an account and set up your PIN on the new device.',
  },
];

/** Port of the Expo app's `(app)/support.tsx`. */
export default function SupportScreen() {
  const showAlert = useAlert();
  const { openDrawer } = useDrawer();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const CONTACTS = [
    {
      id: 'call',
      label: 'Call Us',
      sub: '1800-102-4455 (Toll Free)',
      icon: 'call',
      action: () => {
        window.location.href = 'tel:18001024455';
      },
    },
    {
      id: 'email',
      label: 'Email Us',
      sub: 'support@bobworld.example',
      icon: 'mail-outline',
      action: () => {
        window.location.href = 'mailto:support@bobworld.example';
      },
    },
    {
      id: 'chat',
      label: 'Chat with Us',
      sub: 'Average response time: 2 mins',
      icon: 'chat-bubble-outline',
      action: () =>
        showAlert('Coming Soon', 'Live chat will be available in a future update.'),
    },
  ];

  return (
    <div className="screen">
      <TopAppBar title="Support" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll">
        <div className="scroll__content pad-nav">
          <h2 className="t-headline-sm mb-md">Get in Touch</h2>
          <div className="card mb-lg">
            {CONTACTS.map((c, i) => (
              <div key={c.id}>
                {i > 0 && <div className="divider" />}
                <button className="row" onClick={c.action}>
                  <span className="row__icon">
                    <Icon name={c.icon} size={24} />
                  </span>
                  <span className="row__body">
                    <span className="row__label" style={{ display: 'block' }}>
                      {c.label}
                    </span>
                    <span className="row__sub" style={{ display: 'block' }}>
                      {c.sub}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={22} color="var(--on-surface-variant)" />
                </button>
              </div>
            ))}
          </div>

          <h2 className="t-headline-sm mb-md">Frequently Asked</h2>
          <div className="card">
            {FAQS.map((f, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={f.q}>
                  {i > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
                  <button
                    className="flex items-center justify-between w-full"
                    style={{ padding: 16, gap: 12, textAlign: 'left' }}
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                  >
                    <span className="t-body-md fw-medium flex-1">{f.q}</span>
                    <Icon
                      name={isOpen ? 'expand-less' : 'expand-more'}
                      size={22}
                      color="var(--on-surface-variant)"
                    />
                  </button>
                  {isOpen && (
                    <p className="t-body-sm c-variant" style={{ padding: '0 16px 16px' }}>
                      {f.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
