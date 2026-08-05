import Link from 'next/link';
import { BobLogo } from '@/components/ui/BobLogo';
import { Icon } from '@/components/ui/Icon';

const BENEFITS = [
  {
    icon: 'security',
    title: 'Security that stays on',
    text: 'Smart signals help keep every session protected without getting in your way.',
  },
  {
    icon: 'bolt',
    title: 'Everyday banking, simplified',
    text: 'Move money, manage cards and see your whole financial life in one calm view.',
  },
  {
    icon: 'support-agent',
    title: 'Help when it matters',
    text: 'Get clear answers and human support whenever you need a hand.',
  },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <div className="landing__glow landing__glow--orange" />
      <div className="landing__glow landing__glow--blue" />
      <div className="landing__grid" />

      <nav className="landing__nav" aria-label="Main navigation">
        <Link href="/" className="landing__brand" aria-label="Bob World home">
          <span className="landing__brand-mark">
            <BobLogo size={34} />
          </span>
          <span>Bob World</span>
        </Link>

        <div className="landing__nav-links">
          <a href="#why-bob-world">Why Bob World</a>
          <a href="#security">Security</a>
        </div>

        <Link href="/login" className="landing__nav-login">
          Sign in
          <Icon name="arrow-forward" size={18} />
        </Link>
      </nav>

      <section className="landing__hero" aria-labelledby="landing-title">
        <div className="landing__copy">
          <h1 id="landing-title">
            Your money,
            <span>moving with you.</span>
          </h1>

          <p className="landing__intro">
            Bob World makes everyday banking clearer, with simple tools, thoughtful
            security and a calmer way to stay in control.
          </p>

          <div className="landing__actions">
            <Link href="/register" className="landing__primary-action">
              Get started
              <Icon name="arrow-forward" size={20} />
            </Link>
            <Link href="/login" className="landing__secondary-action">
              I already have an account
            </Link>
          </div>

          <div className="landing__trust-line">
            <span className="landing__trust-icon">
              <Icon name="verified-user" size={17} />
            </span>
            <span>Built for confident, secure banking</span>
          </div>
        </div>

        <div className="landing__visual" id="security" aria-label="Bob World security overview">
          <div className="landing__visual-orbit landing__visual-orbit--one" />
          <div className="landing__visual-orbit landing__visual-orbit--two" />

          <div className="landing__signal-card landing__signal-card--top">
            <span className="landing__signal-icon landing__signal-icon--blue">
              <Icon name="lock" size={18} />
            </span>
            <span>
              <strong>Always protected</strong>
              <small>Trust signals active</small>
            </span>
            <span className="landing__signal-check">
              <Icon name="check" size={15} />
            </span>
          </div>

          <div className="landing__visual-card">
            <div className="landing__visual-card-header">
              <span className="landing__visual-label">Your financial pulse</span>
              <span className="landing__visual-menu">
                <Icon name="more-horiz" size={20} />
              </span>
            </div>

            <div className="landing__visual-balance">₹24,680.00</div>
            <div className="landing__visual-caption">
              <span>Available balance</span>
              <span className="landing__positive">+8.4%</span>
            </div>

            <div className="landing__chart" aria-hidden="true">
              <span className="landing__chart-line" />
              <span className="landing__chart-dot landing__chart-dot--one" />
              <span className="landing__chart-dot landing__chart-dot--two" />
              <span className="landing__chart-dot landing__chart-dot--three" />
              <span className="landing__chart-dot landing__chart-dot--four" />
            </div>

            <div className="landing__visual-footer">
              <span className="landing__footer-icon">
                <Icon name="trending-up" size={16} />
              </span>
              <span>Good momentum this month</span>
            </div>
          </div>

          <div className="landing__signal-card landing__signal-card--bottom">
            <span className="landing__signal-icon landing__signal-icon--orange">
              <Icon name="bolt" size={18} />
            </span>
            <span>
              <strong>One clear view</strong>
              <small>Balance, cards and more</small>
            </span>
          </div>
        </div>
      </section>

      <section className="landing__benefits" id="why-bob-world" aria-label="Bob World benefits">
        {BENEFITS.map((benefit) => (
          <article className="landing__benefit" key={benefit.title}>
            <span className="landing__benefit-icon">
              <Icon name={benefit.icon} size={22} />
            </span>
            <div>
              <h2>{benefit.title}</h2>
              <p>{benefit.text}</p>
            </div>
          </article>
        ))}
      </section>

      <footer className="landing__footer">
        <span>Bob World</span>
        <span>Banking made more human.</span>
      </footer>
    </main>
  );
}
