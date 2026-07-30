import { describe, expect, it } from 'vitest';
import { formatUGX } from '../lib/format';

describe('formatUGX', () => {
  it('formats amounts with UGX and locale separators', () => {
    expect(formatUGX(5000)).toBe('UGX 5,000');
    expect(formatUGX(1500000)).toBe('UGX 1,500,000');
  });
});
