'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { TopAppBar } from '@/components/ui/TopAppBar';
import { useDrawer } from '@/context/DrawerContext';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { getAuthStatus } from '@/services/auth';
import type { FaceCapturePayload } from '@/components/ui/FaceCamera';
import { measureRTT } from '@/services/api';

// MediaPipe touches WebAssembly — must never be rendered during SSR.
const FaceCamera = dynamic(() => import('@/components/ui/FaceCamera').then((m) => m.FaceCamera), {
  ssr: false,
  loading: () => <div className="face-camera__frame" style={{ opacity: 0.4 }} />,
});

type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

interface PhaseState {
  status: TestStatus;
  latencyMs?: number;
  data?: any;
  error?: string;
}

export default function FaceIdTestPage() {
  const { openDrawer } = useDrawer();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const [healthState, setHealthState] = useState<PhaseState>({ status: 'idle' });
  const [cameraState, setCameraState] = useState<PhaseState>({ status: 'idle' });
  const [enrollState, setEnrollState] = useState<PhaseState>({ status: 'idle' });
  const [verifyState, setVerifyState] = useState<PhaseState>({ status: 'idle' });
  
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getAuthStatus().then(status => setIsAuthenticated(status.isAuthenticated));
  }, []);

  const toggleRaw = (phase: string) => setShowRaw(s => ({ ...s, [phase]: !s[phase] }));

  // --- Phase 1: Health ---
  const runHealthCheck = async () => {
    setHealthState({ status: 'running' });
    try {
      const res = await fetch('/api/face/health');
      const data = await res.json();
      if (data.ok) {
        setHealthState({ status: 'pass', latencyMs: data.latencyMs, data: data.python });
      } else {
        setHealthState({ status: 'fail', latencyMs: data.latencyMs, error: data.error, data });
      }
    } catch (e: any) {
      setHealthState({ status: 'fail', error: e.message });
    }
  };

  // --- Phase 2: Camera Setup ---
  // Camera state is mostly handled internally by the component, 
  // but we provide a "Start Camera" button to reveal it.
  const runCamera = () => {
    setCameraState({ status: 'running' });
  };
  
  const handleCameraReady = () => {
     setCameraState({ status: 'pass' });
  }

  // --- Phase 3: Enroll ---
  const runEnroll = () => {
    setEnrollState({ status: 'running' });
    // This just reveals the camera for enrollment
  };

  const handleEnrollCapture = async (payload: FaceCapturePayload) => {
    const t0 = Date.now();
    try {
      const res = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const latencyMs = Date.now() - t0;
      
      if (res.ok && data.ok) {
        setEnrollState({ status: 'pass', latencyMs, data });
      } else {
        setEnrollState({ status: 'fail', latencyMs, error: data.error, data });
      }
    } catch (e: any) {
      setEnrollState({ status: 'fail', latencyMs: Date.now() - t0, error: e.message });
    }
  };

  // --- Phase 4: Verify ---
  const runVerify = () => {
    setVerifyState({ status: 'running' });
    // Reveals the camera for verify
  };

  const handleVerifyCapture = async (payload: FaceCapturePayload) => {
     const t0 = Date.now();
     try {
       const res = await fetch('/api/face/verify', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(payload),
       });
       const data = await res.json();
       const latencyMs = Date.now() - t0;
       
       if (res.ok) {
          setVerifyState({ status: data.match ? 'pass' : 'fail', latencyMs, data, error: data.match ? undefined : 'No match' });
       } else {
          setVerifyState({ status: 'fail', latencyMs, error: data.error, data });
       }
     } catch (e: any) {
       setVerifyState({ status: 'fail', latencyMs: Date.now() - t0, error: e.message });
     }
  };

  const resetAll = () => {
    setHealthState({ status: 'idle' });
    setCameraState({ status: 'idle' });
    setEnrollState({ status: 'idle' });
    setVerifyState({ status: 'idle' });
  };

  const runAll = async () => {
     resetAll();
     await runHealthCheck();
     runCamera();
     // Phases 3 and 4 require user interaction (camera captures), 
     // so we can't fully automate them here.
  };

  return (
    <div className="screen">
      <TopAppBar title="Face ID Diagnostics" showMenuIcon onMenuPress={openDrawer} />

      <div className="scroll test-console">
        <div className="scroll__content pad-nav">
          
          <div className="flex items-center justify-between mb-lg">
             <h1 className="t-headline-sm">Test Console</h1>
             <div className="flex" style={{gap: 8}}>
                <Button label="Reset" variant="ghost" onClick={resetAll} />
             </div>
          </div>

          {isAuthenticated === false && (
            <div className="card mb-lg" style={{ background: 'var(--error-container)', color: 'var(--on-error-container)' }}>
               <div className="flex items-center" style={{ gap: 8 }}>
                  <Icon name="warning" size={24} />
                  <p className="t-body-md fw-semibold">Not logged in</p>
               </div>
               <p className="t-body-sm mt-sm mb-md">
                 Phases 3 and 4 require an active session. You can test the camera and health check, but enroll/verify will fail.
               </p>
               <Link href="/login" style={{ textDecoration: 'underline' }}>Go to Login</Link>
            </div>
          )}

          {/* Phase 1: Health */}
          <div className="test-console__phase">
             <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 12 }}>
                   <StatusBadge status={healthState.status} />
                   <h2 className="t-title-md">1. Service Health</h2>
                </div>
                {healthState.status === 'idle' && <Button label="Run" onClick={runHealthCheck} />}
             </div>
             
             {healthState.status !== 'idle' && (
               <div className="mt-md">
                 {healthState.data && (
                   <ul className="t-body-sm" style={{ paddingLeft: 20, margin: '8px 0', lineHeight: 1.6 }}>
                     <li>Status: {healthState.data.status}</li>
                     <li>Model: {healthState.data.model}</li>
                     <li>Stored embeddings: {healthState.data.embeddings_stored}</li>
                     <li>Version: {healthState.data.service_version}</li>
                   </ul>
                 )}
                 {healthState.latencyMs !== undefined && (
                   <p className="t-body-sm mt-sm">Latency: {healthState.latencyMs} ms</p>
                 )}
                 {healthState.error && (
                   <p className="t-body-sm" style={{ color: 'var(--error)' }}>Error: {healthState.error}</p>
                 )}
                 
                 <RawData data={healthState.data} show={showRaw['p1']} onToggle={() => toggleRaw('p1')} />
               </div>
             )}
          </div>

          {/* Phase 2: Camera */}
          <div className="test-console__phase">
             <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 12 }}>
                   <StatusBadge status={cameraState.status} />
                   <h2 className="t-title-md">2. MediaPipe Camera</h2>
                </div>
                {cameraState.status === 'idle' && <Button label="Run" onClick={runCamera} />}
             </div>

             {(cameraState.status === 'running' || cameraState.status === 'pass') && (
               <div className="mt-md">
                  {/* For phase 2, we just render FaceCamera in verify mode, but don't do anything with the capture yet. 
                      Actually, let's use a custom wrapper to show live stats if we had access to the hook.
                      Since the hook is inside FaceCamera, we can't easily extract the live readout without modifying FaceCamera.
                      For simplicity, we'll just run FaceCamera here.
                  */}
                  <FaceCamera mode="verify" onCapture={() => {}} onError={(err) => setCameraState({status: 'fail', error: err})} />
                  
                  {cameraState.error && (
                    <p className="t-body-sm mt-md" style={{ color: 'var(--error)', textAlign: 'center' }}>
                      {cameraState.error}
                    </p>
                  )}
                  <p className="t-body-sm c-variant text-center mt-sm">
                    Move around, blink, and verify the guide UI updates.
                  </p>
               </div>
             )}
          </div>

          {/* Phase 3: Enroll */}
          <div className="test-console__phase">
             <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 12 }}>
                   <StatusBadge status={enrollState.status} />
                   <h2 className="t-title-md">3. Enroll</h2>
                </div>
                {enrollState.status === 'idle' && <Button label="Run" onClick={runEnroll} />}
             </div>
             
             {enrollState.status === 'running' && (
                <div className="mt-md">
                  <p className="t-body-sm c-variant mb-md text-center">
                    ⚠ This will overwrite your current enrollment.
                  </p>
                  <FaceCamera mode="enroll" onCapture={handleEnrollCapture} onError={(err) => setEnrollState({status: 'fail', error: err})} />
                </div>
             )}

             {(enrollState.status === 'pass' || enrollState.status === 'fail') && (
               <div className="mt-md">
                 <p className="t-body-sm fw-semibold mb-sm">Result:</p>
                 <ul className="t-body-sm" style={{ paddingLeft: 20, margin: '0 0 8px', lineHeight: 1.6 }}>
                    <li>Latency: {enrollState.latencyMs} ms</li>
                    {enrollState.error && <li style={{color: 'var(--error)'}}>Error: {enrollState.error}</li>}
                 </ul>
                 <RawData data={enrollState.data} show={showRaw['p3']} onToggle={() => toggleRaw('p3')} />
                 <Button label="Run Again" variant="ghost" onClick={runEnroll} style={{ marginTop: 12 }} />
               </div>
             )}
          </div>

          {/* Phase 4: Verify */}
          <div className="test-console__phase">
             <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: 12 }}>
                   <StatusBadge status={verifyState.status} />
                   <h2 className="t-title-md">4. Verify</h2>
                </div>
                {verifyState.status === 'idle' && <Button label="Run" onClick={runVerify} />}
             </div>
             
             {verifyState.status === 'running' && (
                <div className="mt-md">
                  <FaceCamera mode="verify" onCapture={handleVerifyCapture} onError={(err) => setVerifyState({status: 'fail', error: err})} />
                </div>
             )}

             {(verifyState.status === 'pass' || verifyState.status === 'fail') && (
               <div className="mt-md">
                 <p className="t-body-sm fw-semibold mb-sm">Result:</p>
                 <ul className="t-body-sm" style={{ paddingLeft: 20, margin: '0 0 8px', lineHeight: 1.6 }}>
                    <li>Latency: {verifyState.latencyMs} ms</li>
                    {verifyState.data?.match !== undefined && (
                      <li>Match: <strong>{verifyState.data.match ? '✅ TRUE' : '❌ FALSE'}</strong></li>
                    )}
                    {verifyState.data?.similarity !== undefined && (
                      <li>Similarity: {verifyState.data.similarity}</li>
                    )}
                    {verifyState.data?.enrolled === false && (
                      <li>Not Enrolled (Fallback to password)</li>
                    )}
                    {verifyState.error && <li style={{color: 'var(--error)'}}>Error: {verifyState.error}</li>}
                 </ul>
                 <RawData data={verifyState.data} show={showRaw['p4']} onToggle={() => toggleRaw('p4')} />
                 <Button label="Run Again" variant="ghost" onClick={runVerify} style={{ marginTop: 12 }} />
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TestStatus }) {
  const colors = {
    idle: 'var(--surface-dim)',
    running: 'var(--warning)',
    pass: 'var(--success)',
    fail: 'var(--error)'
  };
  
  return (
    <div 
      style={{
        width: 12, 
        height: 12, 
        borderRadius: '50%', 
        background: colors[status],
        boxShadow: status === 'running' ? '0 0 0 4px rgba(250,204,21,0.2)' : 'none'
      }} 
    />
  );
}

function RawData({ data, show, onToggle }: { data: any, show: boolean, onToggle: () => void }) {
  if (!data) return null;
  return (
    <div className="mt-md">
      <button 
        onClick={onToggle}
        className="t-label-sm c-primary"
        style={{ textDecoration: 'underline' }}
      >
        {show ? 'Hide raw response' : 'Show raw response'}
      </button>
      {show && (
        <pre className="test-console__raw mt-sm t-body-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
