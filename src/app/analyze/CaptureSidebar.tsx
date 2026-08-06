'use client';

import { useAnalyzeCapture } from '@/context/AnalyzeCaptureContext';
import styles from './analyze.module.css';

function fmt(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined ? '—' : `${value}${suffix}`;
}

export function CaptureSidebar() {
  const {
    categories,
    totalCaptured,
    totalFeatures,
    liveSignals,
    keystrokeCount,
    keystrokeEntries,
    motion,
    motionVariance,
    touch,
    touchMetrics,
    deviceInfo,
    locationInfo,
    tabSwitches,
    payloadJson,
  } = useAnalyzeCapture();

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.liveDot} />
        <span className={styles.liveLabel}>LIVE CAPTURE</span>
        <span className={styles.liveCount}>
          {totalCaptured}/{totalFeatures}
        </span>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>Features captured</h3>
          <span className={styles.bigCount}>
            {totalCaptured}
            <span className={styles.bigCountTotal}>/{totalFeatures}</span>
          </span>
        </div>
        <div className={styles.segBar}>
          {categories.map((c) => (
            <div key={c.key} className={styles.segGroup} style={{ flex: c.total }}>
              {Array.from({ length: c.total }).map((_, i) => (
                <span
                  key={i}
                  className={styles.seg}
                  style={{
                    background: i < c.captured ? c.color : '#e2e5ea',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className={styles.categoryGrid}>
          {categories.map((c) => (
            <div key={c.key} className={styles.categoryItem}>
              <span className={styles.dot} style={{ background: c.color }} />
              <span className={styles.categoryLabel}>{c.label}</span>
              <span className={styles.categoryCount}>
                {c.captured}/{c.total}
              </span>
            </div>
          ))}
        </div>
      </section>

      {liveSignals.length > 0 && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>Live signals</h3>
          <ul className={styles.signalList}>
            {liveSignals.map((s) => (
              <li key={s.label} className={styles.signalRow}>
                <span className={styles.signalDot} data-tone={s.tone} />
                <span className={styles.signalLabel}>{s.label}</span>
                <span className={styles.signalValue} data-tone={s.tone}>
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>Keystroke dynamics</h3>
          <span className={styles.cardMeta}>{keystrokeCount} keys</span>
        </div>
        {keystrokeEntries.length === 0 ? (
          <p className={styles.placeholder}>Type a PIN or amount to stream dwell / flight times…</p>
        ) : (
          <div className={styles.keyList}>
            {keystrokeEntries.map((e, i) => {
              const maxDwell = 250;
              const pct = Math.min(100, (e.dwell / maxDwell) * 100);
              return (
                <div key={i} className={styles.keyRow}>
                  <span className={styles.keyIndex}>#{keystrokeEntries.length - i}</span>
                  <span className={styles.keyBarTrack}>
                    <span className={styles.keyBarFill} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.keyStat}>
                    {e.dwell} <em>ms dwell</em>
                  </span>
                  <span className={styles.keyStat}>
                    {e.flight !== null ? `${e.flight} ` : '— '}
                    <em>flight</em>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>Device motion</h3>
          <span className={styles.cardMeta}>
            {deviceInfo.touchInput ? 'mobile' : 'desktop'} ·{' '}
            {motion.available ? 'live' : 'n/a'}
          </span>
        </div>
        <div className={styles.motionRow}>
          <div className={styles.motionIconWrap}>
            <span className={styles.motionIcon} />
          </div>
          <div className={styles.motionStats}>
            <div className={styles.kv}>
              <span>pitch β</span>
              <span className={styles.mono}>{fmt(motion.pitch, '°')}</span>
            </div>
            <div className={styles.kv}>
              <span>roll γ</span>
              <span className={styles.mono}>{fmt(motion.roll, '°')}</span>
            </div>
            <div className={styles.kv}>
              <span>yaw α</span>
              <span className={styles.mono}>{fmt(motion.yaw, '°')}</span>
            </div>
          </div>
        </div>
        {motion.available && (
          <div className={styles.kvGrid}>
            <div className={styles.kv}>
              <span>accel x</span>
              <span className={styles.mono}>{fmt(motion.accelX)}</span>
            </div>
            <div className={styles.kv}>
              <span>accel y</span>
              <span className={styles.mono}>{fmt(motion.accelY)}</span>
            </div>
            <div className={styles.kv}>
              <span>accel z</span>
              <span className={styles.mono}>{fmt(motion.accelZ)}</span>
            </div>
            <div className={styles.kv}>
              <span>var σ²</span>
              <span className={styles.mono}>
                {motionVariance.x + motionVariance.y + motionVariance.z > 0
                  ? (motionVariance.x + motionVariance.y + motionVariance.z).toFixed(3)
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>Touch &amp; pressure sensitivity</h3>
          <span className={styles.cardMeta}>
            {touch.awaitingTouch ? 'awaiting touch' : 'live'}
          </span>
        </div>
        {touch.awaitingTouch ? (
          <p className={styles.placeholder}>
            Tap or drag on the phone screen to see force / contact-area per tap.
          </p>
        ) : (
          <>
            <div className={styles.pressureBlock}>
              <div className={styles.kv}>
                <span>
                  Pressure <span className={styles.pip} />
                </span>
                <span className={styles.mono}>{fmt(touchMetrics.pressure)}</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${Math.min(100, (touchMetrics.pressure ?? 0) * 100)}%` }}
                />
              </div>
            </div>
            <div className={styles.kvGrid}>
              <div className={styles.kv}>
                <span>Tap area</span>
                <span className={styles.mono}>{fmt(touchMetrics.tapArea, 'px²')}</span>
              </div>
              <div className={styles.kv}>
                <span>Tap duration</span>
                <span className={styles.mono}>{fmt(touchMetrics.tapDuration, 'ms')}</span>
              </div>
              <div className={styles.kv}>
                <span>Center offset</span>
                <span className={styles.mono}>{fmt(touchMetrics.centerOffset, 'px')}</span>
              </div>
              <div className={styles.kv}>
                <span>Swipe velocity</span>
                <span className={styles.mono}>{fmt(touchMetrics.swipeVelocity, ' px/ms')}</span>
              </div>
              <div className={styles.kv}>
                <span>Pressure σ</span>
                <span className={styles.mono}>{fmt(touchMetrics.pressureStdDev)}</span>
              </div>
              <div className={styles.kv}>
                <span>Pointer</span>
                <span className={styles.mono}>{touchMetrics.pointerType ?? '—'}</span>
              </div>
            </div>
            <p className={styles.footnote}>taps: {touchMetrics.tapCount} · max concurrent: {touchMetrics.multitouchMax}</p>
          </>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>Location &amp; network intelligence</h3>
        {tabSwitches > 0 && <span className={styles.tag}>Frequent tab switching</span>}
        <div className={styles.kvList}>
          <div className={styles.kvRow}>
            <span>GPS</span>
            <span className={styles.mono}>
              {locationInfo.hasFix
                ? `${locationInfo.lat.toFixed(5)}, ${locationInfo.lon.toFixed(5)}`
                : 'not enabled'}
            </span>
          </div>
          <div className={styles.kvRow}>
            <span>Connection</span>
            <span className={styles.mono}>
              {locationInfo.connectionType}
              {locationInfo.rtt !== null ? ` · ${locationInfo.rtt}ms` : ''}
            </span>
          </div>
          <div className={styles.kvRow}>
            <span>Downlink</span>
            <span className={styles.mono}>
              {locationInfo.downlinkMbps !== null ? `${locationInfo.downlinkMbps} Mbps` : '—'}
            </span>
          </div>
          <div className={styles.kvRow}>
            <span>GPU</span>
            <span className={styles.monoTruncate} title={locationInfo.gpuRenderer}>
              {locationInfo.gpuRenderer}
            </span>
          </div>
          <div className={styles.kvRow}>
            <span>Online</span>
            <span className={styles.mono}>{locationInfo.online ? 'yes' : 'no'}</span>
          </div>
          <div className={styles.kvRow}>
            <span>Tab switches</span>
            <span className={styles.mono}>{tabSwitches}</span>
          </div>
        </div>
        <div className={styles.divider} />
        <p className={styles.nativeOnlyLabel}>NATIVE-SDK ONLY · NOT WEB-CAPTURABLE</p>
        <div className={styles.pillRow}>
          {['IP / ISP / ASN', 'Cell tower ID', 'IMEI', 'SIM serial', 'Wi-Fi BSSID'].map((p) => (
            <span key={p} className={styles.pill}>
              {p}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>What this device exposes</h3>
          <span className={styles.cardMeta}>{deviceInfo.fingerprintShort}</span>
        </div>
        <div className={styles.kvList}>
          <div className={styles.kvRow}>
            <span>Platform</span>
            <span className={styles.mono}>{deviceInfo.platform}</span>
          </div>
          <div className={styles.kvRow}>
            <span>Secure context</span>
            <span className={styles.mono}>{deviceInfo.secureContext ? 'yes (HTTPS)' : 'no'}</span>
          </div>
          <div className={styles.kvRow}>
            <span>Pointer events</span>
            <span className={styles.mono}>{deviceInfo.pointerEvents ? 'yes' : 'no'}</span>
          </div>
          <div className={styles.kvRow}>
            <span>Touch input</span>
            <span className={styles.mono}>{deviceInfo.touchInput ? 'yes' : 'no'}</span>
          </div>
          <div className={styles.kvRow}>
            <span>CPU cores</span>
            <span className={styles.mono}>{deviceInfo.cpuCores || '—'}</span>
          </div>
          <div className={styles.kvRow}>
            <span>Device memory</span>
            <span className={styles.mono}>
              {deviceInfo.deviceMemory ? `${deviceInfo.deviceMemory} GB` : '—'}
            </span>
          </div>
          <div className={styles.kvRow}>
            <span>Screen</span>
            <span className={styles.mono}>{deviceInfo.screenRes}</span>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeadRow}>
          <h3 className={styles.cardTitle}>Live capture · JSON</h3>
          <span className={styles.cardMeta}>building in real time</span>
        </div>
        <pre className={styles.jsonBlock}>{JSON.stringify(payloadJson, null, 2)}</pre>
      </section>
    </div>
  );
}
