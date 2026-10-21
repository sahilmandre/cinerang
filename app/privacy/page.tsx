import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Privacy Policy — CineRang',
  description: 'What CineRang stores when you sign in with Google, and how to delete it.',
};

const CONTACT_EMAIL = 'sahilmandre@gmail.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-white/70">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto mt-8 max-w-3xl">
      <PageHeader title="Privacy Policy" />
      <p className="mt-3 px-1 text-xs text-white/40">Last updated: 21 October 2026 (watch history)</p>

      <div className="px-1">
        <Section title="What CineRang is">
          <p>
            CineRang is a discovery site for movies, series and anime. Signing in with Google is
            optional and only used to keep your taste, watchlist and watch history in sync across
            your devices.
          </p>
        </Section>

        <Section title="What we get from Google">
          <p>
            When you sign in with Google we receive your <strong>name</strong>,{' '}
            <strong>email address</strong> and <strong>profile picture</strong>. We never see your
            Google password, and we do not access Gmail, Drive, contacts or any other Google data.
          </p>
        </Section>

        <Section title="What we store for your account">
          <ul className="list-disc space-y-1 pl-5">
            <li>Your taste profile: favourite genres, liked and disliked titles.</li>
            <li>Your watchlist.</li>
            <li>
              Your Continue Watching list: which title, season and episode you were on, and which
              video server you used, so you can resume there.
            </li>
            <li>Your player setting for the popup blocker.</li>
            <li>
              Your watch history: each movie and episode you watch while signed in, when, on which
              server, how far you got and whether you finished it.
            </li>
            <li>
              A dated log of your likes, dislikes and watchlist changes.
            </li>
          </ul>
          <p>
            This is stored in a MongoDB Atlas database (Mumbai region) and used to sync your devices
            and to personalise and improve recommendations — including recommendation models built
            from viewing patterns. If you don&apos;t sign in, everything stays in your browser only
            and no history is kept.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            The site&apos;s administrators can see accounts, watch history and taste data to run the
            service (for example to block abuse) and to improve recommendations. Data prepared for
            recommendation models identifies accounts by an internal id, not by name or email.
          </p>
        </Section>

        <Section title="Cookies and analytics">
          <p>
            Signing in sets a session cookie so you stay signed in (up to 30 days). We use Vercel Web
            Analytics for anonymous page-view counts; it does not use cookies. We don&apos;t use
            advertising cookies.
          </p>
        </Section>

        <Section title="Third-party video players">
          <p>
            Videos play inside players embedded from third-party servers. Those services may set
            their own cookies or show ads, and their own privacy policies apply.
          </p>
        </Section>

        <Section title="Sharing">
          <p>We don&apos;t sell, rent or share your data with anyone.</p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Signing out removes your data from that device. To delete your account and everything
            stored for it — including your watch history — email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent hover:underline">
              {CONTACT_EMAIL}
            </a>{' '}
            from the Google account you signed in with.
          </p>
        </Section>
      </div>
    </article>
  );
}
