import { useState } from 'react';
import { readAnalyticsConsent, saveAnalyticsConsent, type AnalyticsConsent } from '../lib/analytics';

/** Asks once before loading analytics. Essential storage (cart, sign-in) needs no consent. */
export default function ConsentBanner() {
  const [choice, setChoice] = useState<AnalyticsConsent | null>(() => readAnalyticsConsent());
  if (choice) return null;

  const decide = (value: AnalyticsConsent) => {
    saveAnalyticsConsent(value);
    setChoice(value);
  };

  return (
    <div
      role="region"
      aria-label="Privacy choices"
      className="fixed inset-x-0 bottom-0 z-[55] px-4 pb-4 sm:left-auto sm:right-4 sm:max-w-sm sm:px-0"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm shadow-2xl">
        <p className="font-bold text-gray-800">Help us improve Shop For Me</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600">
          We'd like to use analytics to understand how the site is used. It's off unless you agree. Sign-in and
          your cart work either way. See our{' '}
          <a href="/privacy" className="font-semibold text-brand-700 underline">
            privacy policy
          </a>
          .
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => decide('denied')}
            className="flex-1 rounded-full border border-gray-200 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => decide('granted')}
            className="flex-1 rounded-full bg-brand-600 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
          >
            Allow analytics
          </button>
        </div>
      </div>
    </div>
  );
}
