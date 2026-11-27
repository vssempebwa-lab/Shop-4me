import type { Order } from '../types';
import { supabase } from './supabase';

/** Code + phone that let a guest look up and act on their own order. */
export interface GuestOrderAccess {
  code: string;
  phone: string;
}

/** The 8-character code customers see, e.g. "3F9A12BC". */
export function getOrderCode(orderId: string) {
  return orderId.replace(/^demo-order-(guest-)?/, '').slice(0, 8).toUpperCase();
}

export function normalizeOrderCode(value: string) {
  return value.replace(/[^0-9a-f]/gi, '').slice(0, 8).toUpperCase();
}

function toOrder(data: unknown): Order {
  const row = data as Order;
  return { ...row, items: Array.isArray(row.items) ? row.items : [] };
}

export async function trackOrder(access: GuestOrderAccess) {
  const { data, error } = await supabase.rpc('track_order', {
    p_code: access.code,
    p_phone: access.phone,
  });

  if (error || !data) {
    return {
      order: null,
      error: error?.code === 'P0002' || !data
        ? 'No order matches that code and phone number. Check both and try again.'
        : 'We could not look up your order right now. Please try again.',
    };
  }

  return { order: toOrder(data), error: null };
}

export async function respondToBillWithCode(
  access: GuestOrderAccess,
  approve: boolean,
  note: string | null,
) {
  const { data, error } = await supabase.rpc('respond_to_final_bill_with_code', {
    p_code: access.code,
    p_phone: access.phone,
    p_approve: approve,
    p_note: note,
  });

  if (error || !data) {
    return { order: null, error: error?.message || 'Could not send your response. Please try again.' };
  }

  return { order: toOrder(data), error: null };
}
