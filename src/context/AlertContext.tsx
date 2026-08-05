'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel';
  onPress?: () => void;
}

interface AlertState {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

interface AlertContextValue {
  /** Drop-in replacement for React Native's `Alert.alert`. */
  showAlert: (title: string, message?: string, buttons?: AlertButton[]) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

/**
 * Replaces React Native's native `Alert.alert` with an in-frame modal, so
 * dialogs render inside the phone screen instead of as a browser `alert()`.
 */
export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertState | null>(null);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]) => {
      setAlert({ title, message, buttons: buttons ?? [{ text: 'OK' }] });
    },
    []
  );

  const dismiss = (button: AlertButton) => {
    setAlert(null);
    button.onPress?.();
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {alert && (
        <div className="modal__overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal__title">{alert.title}</h2>
            {alert.message && <p className="modal__message">{alert.message}</p>}
            <div className="modal__actions">
              {alert.buttons.map((button, i) => (
                <button
                  key={i}
                  className={`modal__btn${
                    button.style === 'cancel' ? ' modal__btn--cancel' : ''
                  }`}
                  onClick={() => dismiss(button)}
                >
                  {button.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) throw new Error('useAlert must be used within an AlertProvider');
  return context.showAlert;
}
