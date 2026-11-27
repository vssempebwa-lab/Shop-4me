import { supabase } from './supabase';

export type PaymentSettings = {
  mtnTillNumber: string;
  mtnDialCode: string;
  mtnLabel: string;
  airtelTillNumber: string;
  airtelLabel: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  mtnTillNumber: '700000',
  mtnDialCode: '1653#',
  mtnLabel: 'MoMo from MTN',
  airtelTillNumber: '700001',
  airtelLabel: 'Airtel Money Merchant',
};

let cachedPaymentSettings: PaymentSettings | null = null;

export function normalizePaymentSettings(settings: Partial<PaymentSettings> = {}): PaymentSettings {
  return {
    ...DEFAULT_PAYMENT_SETTINGS,
    ...settings,
    mtnTillNumber: sanitizeMerchantNumber(settings.mtnTillNumber ?? DEFAULT_PAYMENT_SETTINGS.mtnTillNumber),
    mtnDialCode: String(settings.mtnDialCode ?? DEFAULT_PAYMENT_SETTINGS.mtnDialCode).trim(),
    mtnLabel: String(settings.mtnLabel ?? DEFAULT_PAYMENT_SETTINGS.mtnLabel).trim() || DEFAULT_PAYMENT_SETTINGS.mtnLabel,
    airtelTillNumber: sanitizeMerchantNumber(settings.airtelTillNumber ?? DEFAULT_PAYMENT_SETTINGS.airtelTillNumber),
    airtelLabel:
      String(settings.airtelLabel ?? DEFAULT_PAYMENT_SETTINGS.airtelLabel).trim() || DEFAULT_PAYMENT_SETTINGS.airtelLabel,
  };
}

export async function fetchPaymentSettings(options: { fresh?: boolean } = {}) {
  if (cachedPaymentSettings && !options.fresh) return cachedPaymentSettings;

  const rpcResult = await supabase.rpc('get_payment_settings');
  let data = rpcResult.data as Record<string, unknown> | null;
  let error = rpcResult.error;

  if (error) {
    const tableResult = await supabase
      .from('payment_settings')
      .select('mtn_till_number,mtn_dial_code,mtn_label,airtel_till_number,airtel_label,updated_by,updated_at')
      .eq('id', 'default')
      .maybeSingle();

    data = tableResult.data as Record<string, unknown> | null;
    error = tableResult.error;
  }

  if (error || !data) {
    if (error) console.warn('Unable to load payment settings; using defaults.', error.message);
    cachedPaymentSettings = normalizePaymentSettings(cachedPaymentSettings ?? DEFAULT_PAYMENT_SETTINGS);
    return cachedPaymentSettings;
  }

  cachedPaymentSettings = normalizePaymentSettings({
    mtnTillNumber: String(data.mtn_till_number ?? ''),
    mtnDialCode: String(data.mtn_dial_code ?? ''),
    mtnLabel: String(data.mtn_label ?? ''),
    airtelTillNumber: String(data.airtel_till_number ?? ''),
    airtelLabel: String(data.airtel_label ?? ''),
    updatedBy: data.updated_by ? String(data.updated_by) : null,
    updatedAt: data.updated_at ? String(data.updated_at) : null,
  });
  return cachedPaymentSettings;
}

export async function savePaymentSettings(
  settings: PaymentSettings,
  actorUserId: string | null,
) {
  const normalized = normalizePaymentSettings(settings);
  const validationError = validatePaymentSettings(normalized);
  if (validationError) throw new Error(validationError);

  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from('payment_settings').upsert(
    {
      id: 'default',
      mtn_till_number: normalized.mtnTillNumber,
      mtn_dial_code: normalized.mtnDialCode,
      mtn_label: normalized.mtnLabel,
      airtel_till_number: normalized.airtelTillNumber,
      airtel_label: normalized.airtelLabel,
      updated_by: actorUserId,
      updated_at: updatedAt,
    },
    { onConflict: 'id' },
  );

  if (error) throw new Error(formatPaymentSettingsError(error.message));
  cachedPaymentSettings = { ...normalized, updatedBy: actorUserId, updatedAt };
  return cachedPaymentSettings;
}

export function validatePaymentSettings(settings: PaymentSettings) {
  const normalized = normalizePaymentSettings(settings);

  if (!isValidMerchantNumber(normalized.mtnTillNumber)) {
    return 'MTN merchant/till number must be 6 numeric digits.';
  }

  if (!isValidMerchantNumber(normalized.airtelTillNumber)) {
    return 'Airtel merchant/till number must be 6 numeric digits.';
  }

  if (!normalized.mtnDialCode.trim()) return 'MTN dial code cannot be empty.';
  if (!normalized.mtnLabel.trim()) return 'MTN display label cannot be empty.';
  if (!normalized.airtelLabel.trim()) return 'Airtel display label cannot be empty.';

  return null;
}

export function sanitizeMerchantNumber(value: string) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 6);
}

export function isValidMerchantNumber(value: string) {
  return /^\d{6}$/.test(value);
}

function formatPaymentSettingsError(message: string) {
  if (message.includes('payment_settings')) {
    return 'Payment settings table is missing in Supabase. Apply the payment settings migration, then try again.';
  }

  return message;
}
