import Link from 'next/link';
import { BobLogo } from '@/components/ui/BobLogo';
import { Icon } from '@/components/ui/Icon';

/**
 * Scenario menu, shown between the landing page and the live demos.
 *
 * One screenful, three columns, one card per scenario. It exists to say what
 * the audience is about to watch and then get out of the way, so each card
 * carries a single sentence rather than a briefing.
 */

const SCENARIOS = [
  {
    step: 'Scenario A',
    icon: 'fact-check',
    title: 'Opening an account',
    text: 'Anyone can type an account number. Someone at the bank checks it against the passbook before the account can be used.',
    watch: 'Watch the Onboarding queue',
    href: '/register',
    cta: 'Start onboarding',
  },
  {
    step: 'Scenario B',
    icon: 'devices',
    title: 'Signing in from somewhere new',
    text: 'A stolen password gets you nowhere on its own. The phone she already carries has to approve the laptop she does not.',
    watch: 'Watch Device Trust',
    href: '/device-demo',
    cta: 'Open both devices',
  },
  {
    step: 'Scenario C',
    icon: 'query-stats',
    title: 'A payment that feels off',
    text: 'Typing like a machine, or sending far more than she usually does, brings up a PIN and a face check.',
    watch: 'Watch Sessions',
    href: '/session-monitor',
    cta: 'Try a transfer',
  },
];

export default function DemoHubPage() {
  return (
    <main className="scenario">
      <div className="scenario__glow scenario__glow--orange" />
      <div className="scenario__glow scenario__glow--blue" />
      <div className="scenario__grid" />

      <nav className="scenario__nav" aria-label="Main navigation">
        <Link href="/" className="scenario__brand" aria-label="Bob World home">
          <span className="scenario__brand-mark">
            <BobLogo size={30} />
          </span>
          <span>Bob World</span>
        </Link>
        <Link href="/" className="scenario__back">
          <Icon name="arrow-back" size={17} />
          Back
        </Link>
      </nav>

      <section className="scenario__hero">
        <h1>
          Three moments where we <span>stop fraud.</span>
        </h1>
        <p>
          Pick one and watch it happen on the phone and in the bank console at the same
          time.
        </p>
      </section>

      <section className="scenario__cards">
        {SCENARIOS.map((scenario) => (
          <article className="scenario__card" key={scenario.step}>
            <span className="scenario__card-icon">
              <Icon name={scenario.icon} size={21} />
            </span>

            <p className="scenario__card-step">{scenario.step}</p>
            <h2>{scenario.title}</h2>
            <p>{scenario.text}</p>

            <p className="scenario__card-meta">
              <Icon name="monitor" size={14} />
              {scenario.watch}
            </p>

            <Link href={scenario.href} className="scenario__card-action">
              {scenario.cta}
              <Icon name="arrow-forward" size={18} />
            </Link>
          </article>
        ))}
      </section>

      <footer className="scenario__foot">
        <Icon name="info-outline" size={15} />
        Open the bank console beside this window to see both sides at once.
      </footer>
    </main>
  );
}
