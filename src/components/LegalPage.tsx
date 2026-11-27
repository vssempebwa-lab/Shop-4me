import { useState, type ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SiteSettings } from '../lib/siteSettings';
import { readAnalyticsConsent, saveAnalyticsConsent } from '../lib/analytics';

/*
 * DRAFT legal text describing how the app actually handles data today.
 * Have it reviewed by a Ugandan lawyer before launch, and register with the
 * Personal Data Protection Office (PDPO) as a data controller.
 * Update LAST_UPDATED whenever the text changes.
 */
const LAST_UPDATED = '27 November 2026';

export type LegalPageKind = 'privacy' | 'terms';

export default function LegalPage({ kind, siteSettings }: { kind: LegalPageKind; siteSettings: SiteSettings }) {
  const contact = (
    <>
      {siteSettings.footerEmail} or {siteSettings.footerPhone}
    </>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <a href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to shop
      </a>
      <article className="mt-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
        {kind === 'privacy' ? <PrivacyPolicy contact={contact} /> : <Terms contact={contact} />}
        <p className="mt-8 text-xs text-gray-400">Last updated {LAST_UPDATED}</p>
      </article>
    </main>
  );
}

function PrivacyPolicy({ contact }: { contact: ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-900">Privacy policy</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        Shop For Me Uganda ("we") buys groceries and household items from Kampala markets on your behalf and
        delivers them to you. This policy explains what personal data we collect, why, and your rights under the
        Data Protection and Privacy Act, 2019.
      </p>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name, phone number and delivery location or landmark when you place an order.</li>
          <li>Your order: items, quantities, prices, the outlet that serves you, and order and payment status.</li>
          <li>If you create an account: your email address, and your name and profile photo if you sign in with Google.</li>
          <li>Final bill details recorded by our market attendant, including photos of your goods or market receipt.</li>
          <li>Usage analytics, only if you allow it in the privacy banner.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To buy, pack and deliver your order, and to contact you about it (for example to confirm a final bill).</li>
          <li>To let you track your order and approve or question the final bill.</li>
          <li>To keep records of orders and payments, prevent fraud and resolve complaints.</li>
          <li>With your consent, to understand how the site is used so we can improve it.</li>
        </ul>
        <p className="mt-2">We do not sell your personal data.</p>
      </Section>

      <Section title="Who sees it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Our admins, and the market attendant and boda-boda rider handling your order.</li>
          <li>
            Service providers that run the platform for us: Supabase (database, sign-in and file storage), Netlify
            (website hosting) and, only if you allow analytics, Google Firebase Analytics. Some of these providers
            store data outside Uganda.
          </li>
          <li>Authorities, where the law requires it.</li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        We keep order records for as long as needed to provide the service and meet accounting and legal
        obligations, then delete or anonymise them. You can ask us to delete your account at any time.
      </Section>

      <Section title="Your rights">
        You can ask to see the personal data we hold about you, correct it, delete it, or object to how we use it.
        Contact us at {contact}. You may also complain to the Personal Data Protection Office (PDPO) of Uganda.
      </Section>

      <Section title="Analytics choice">
        <AnalyticsChoice />
      </Section>
    </>
  );
}

function Terms({ contact }: { contact: ReactNode }) {
  return (
    <>
      <h1 className="text-2xl font-extrabold text-brand-900">Terms of service</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        By placing an order with Shop For Me Uganda you agree to these terms.
      </p>

      <Section title="Prices are estimates">
        Market prices change daily. Prices shown in the shop and at checkout are estimates. After shopping, your
        market attendant records what each item actually cost, any replacements, and anything that was not
        available. That final bill is the amount you pay.
      </Section>

      <Section title="Approving the final bill">
        If the final bill is at or below your estimate and nothing was replaced, it is approved automatically. If it
        is higher, or an item was replaced, we ask you to approve it in the app or by phone before your order is
        dispatched. You can query a bill instead of approving it, and items that were not available are not
        charged.
      </Section>

      <Section title="Delivery and payment">
        Orders are delivered from your chosen market outlet. You pay the final bill plus the delivery fee by Mobile
        Money when your order arrives, unless we agree otherwise. Please make sure someone is available at the
        delivery location you gave.
      </Section>

      <Section title="Quality and refunds">
        If something you receive is damaged, spoiled or not what you approved, contact us as soon as possible with
        your order code and we will make it right, in line with our "fresh or refunded" quality promise.
      </Section>

      <Section title="Accounts">
        Keep your sign-in details private. You are responsible for orders placed from your account. We may suspend
        accounts used for fraud or abuse.
      </Section>

      <Section title="Contact">Questions about these terms: {contact}.</Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-base font-extrabold text-gray-800">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

function AnalyticsChoice() {
  const [consent, setConsent] = useState(() => readAnalyticsConsent());

  return (
    <div>
      <p>
        Analytics is currently <strong>{consent === 'granted' ? 'on' : 'off'}</strong> on this device.
      </p>
      <button
        type="button"
        onClick={() => {
          const next = consent === 'granted' ? 'denied' : 'granted';
          saveAnalyticsConsent(next);
          setConsent(next);
          // Turning analytics off fully requires unloading the SDK.
          if (next === 'denied') window.location.reload();
        }}
        className="mt-2 rounded-full border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
      >
        {consent === 'granted' ? 'Turn analytics off' : 'Turn analytics on'}
      </button>
    </div>
  );
}
