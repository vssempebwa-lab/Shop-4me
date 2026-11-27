/**
 * Firebase Analytics, loaded only after the visitor opts in through the
 * consent banner (Uganda Data Protection and Privacy Act 2019 / GDPR).
 * The SDK is imported lazily, so visitors who decline never download it.
 * Firebase web config values are public identifiers, not secrets.
 */
export type AnalyticsConsent = 'granted' | 'denied';

const CONSENT_KEY = 'sfm-analytics-consent';

const firebaseConfig = {
  apiKey: "AIzaSyAQMEhsukryUlcMuJgZfAelTkJYIOYWbmw",
  authDomain: "shop4me-fef09.firebaseapp.com",
  projectId: "shop4me-fef09",
  storageBucket: "shop4me-fef09.firebasestorage.app",
  messagingSenderId: "406512516513",
  appId: "1:406512516513:web:0231a36bc7e36c5b1f5fe0",
  measurementId: "G-WXJ6JNLE72"
};

let started = false;

export function readAnalyticsConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(consent: AnalyticsConsent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, consent);
  } catch {
    // Storage blocked: the choice applies to this visit only.
  }
  if (consent === 'granted') void startAnalytics();
}

export async function startAnalytics() {
  if (started || import.meta.env.DEV) return;
  started = true;
  try {
    const [{ initializeApp }, { getAnalytics, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/analytics'),
    ]);
    if (!(await isSupported())) return;
    getAnalytics(initializeApp(firebaseConfig));
  } catch (error) {
    console.warn('Analytics could not start.', error);
  }
}

/** Call once at startup: resumes analytics for visitors who already opted in. */
export function startAnalyticsIfConsented() {
  if (readAnalyticsConsent() === 'granted') void startAnalytics();
}
