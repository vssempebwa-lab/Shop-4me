import { describe, expect, it } from 'vitest';
import {
  applyFinalBillRules,
  draftFinalBillItems,
  getAmountToCollect,
  summarizeFinalBill,
  validateFinalBillItems,
} from '../lib/finalBill';
import type { Order } from '../types';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    contact_name: 'Test Customer',
    phone: '0772123456',
    delivery_address: 'Kawempe',
    items: [
      { product_id: 'tomatoes', name: 'Tomatoes', price: 8000, unit: 'Per basket', quantity: 2 },
      { product_id: 'onions', name: 'Onions', price: 6000, unit: 'Per kg', quantity: 1 },
    ],
    subtotal: 22000,
    delivery_fee: 5000,
    total_amount: 27000,
    status: 'Processing',
    created_at: '2026-11-27T08:00:00.000Z',
    ...overrides,
  };
}

describe('final bill', () => {
  it('drafts one bought line per ordered item at the estimated price', () => {
    const items = draftFinalBillItems(makeOrder());
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ status: 'bought', actual_line_total: 16000, estimated_unit_price: 8000 });
  });

  it('excludes unavailable lines and adds the delivery fee', () => {
    const order = makeOrder();
    const items = draftFinalBillItems(order);
    items[1].status = 'unavailable';
    const summary = summarizeFinalBill(order, items);
    expect(summary.subtotal).toBe(16000);
    expect(summary.total).toBe(21000);
    expect(summary.autoApproves).toBe(true);
  });

  it('needs customer approval when the bill goes over the estimate', () => {
    const order = makeOrder();
    const items = draftFinalBillItems(order);
    items[0].actual_line_total = 20000;
    const next = applyFinalBillRules(order, { final_items: items, bill_status: 'awaiting_approval' });
    expect(next.final_total).toBe(31000);
    expect(next.bill_status).toBe('awaiting_approval');
    expect(getAmountToCollect(next)).toBe(27000);
  });

  it('needs customer approval for any substitution, even when cheaper', () => {
    const order = makeOrder();
    const items = draftFinalBillItems(order);
    items[1] = { ...items[1], status: 'substituted', substitute_name: 'Red onions', actual_line_total: 5000 };
    const next = applyFinalBillRules(order, { final_items: items, bill_status: 'awaiting_approval' });
    expect(next.bill_status).toBe('awaiting_approval');
  });

  it('auto-approves a bill within the estimate and collects the final total', () => {
    const order = makeOrder();
    const items = draftFinalBillItems(order);
    items[0].actual_line_total = 14000;
    const next = applyFinalBillRules(order, { final_items: items, bill_status: 'awaiting_approval' });
    expect(next.bill_status).toBe('approved');
    expect(next.bill_approval_method).toBe('auto_within_estimate');
    expect(getAmountToCollect(next)).toBe(25000);
  });

  it('rejects bills with missing prices or unnamed substitutes', () => {
    const items = draftFinalBillItems(makeOrder());
    items[0].actual_line_total = 0;
    expect(validateFinalBillItems(items)).toMatch(/Tomatoes/);
    items[0].actual_line_total = 16000;
    items[1].status = 'substituted';
    expect(validateFinalBillItems(items)).toMatch(/replaced/);
  });
});
