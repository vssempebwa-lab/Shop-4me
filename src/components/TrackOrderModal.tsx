import { useState, type FormEvent } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import type { Order } from '../types';
import { normalizeOrderCode, trackOrder, type GuestOrderAccess } from '../lib/orderTracking';

interface TrackOrderModalProps {
  onClose: () => void;
  onFound: (order: Order, access: GuestOrderAccess) => void;
}

/** Look up any order with its order code + the phone number used at checkout. */
export default function TrackOrderModal({ onClose, onFound }: TrackOrderModalProps) {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const access = { code: normalizeOrderCode(code), phone: phone.trim() };
    if (access.code.length !== 8) {
      setError('Enter the 8-character order code, e.g. 3F9A12BC.');
      return;
    }
    if (access.phone.replace(/\D/g, '').length < 9) {
      setError('Enter the phone number you used at checkout.');
      return;
    }

    setLoading(true);
    const result = await trackOrder(access);
    setLoading(false);

    if (!result.order) {
      setError(result.error);
      return;
    }

    onFound(result.order, access);
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animate-slide-up sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-brand-600" />
            <h2 className="text-base font-extrabold text-gray-800">Track your order</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Use the order code shown after checkout and the phone number you ordered with.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">Order code</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="#3F9A12BC"
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-base uppercase sm:text-sm tracking-wider outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold text-gray-700">Phone number</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0772 123 456"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base outline-none sm:text-sm focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Find my order
        </button>
      </form>
    </div>
  );
}
