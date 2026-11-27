import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Loader2, MessageSquareWarning, X } from 'lucide-react';
import type { FinalBillItem, FinalBillLineStatus, Order } from '../types';
import { formatUGX } from '../lib/format';
import { draftFinalBillItems, summarizeFinalBill, validateFinalBillItems } from '../lib/finalBill';
import { isAcceptedBillPhoto, MAX_BILL_PHOTOS } from '../lib/billPhotos';

const LINE_STATUS_OPTIONS: Array<{ value: FinalBillLineStatus; label: string }> = [
  { value: 'bought', label: 'Bought' },
  { value: 'substituted', label: 'Replaced' },
  { value: 'unavailable', label: 'Not available' },
];

interface FinalBillEditorProps {
  order: Order;
  saving: boolean;
  onClose: () => void;
  onSubmit: (items: FinalBillItem[], photos: BillPhotoChanges) => void;
}

export interface BillPhotoChanges {
  /** Already-uploaded photos to keep. */
  kept: string[];
  /** New photos to upload. */
  added: File[];
}

/**
 * Attendant enters what each line actually cost after shopping. The result is
 * the final bill the customer pays.
 */
export default function FinalBillEditor({ order, saving, onClose, onSubmit }: FinalBillEditorProps) {
  const [items, setItems] = useState<FinalBillItem[]>(() => draftFinalBillItems(order));
  const [error, setError] = useState<string | null>(null);
  const summary = useMemo(() => summarizeFinalBill(order, items), [items, order]);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(() => order.bill_photos ?? []);
  const [addedPhotos, setAddedPhotos] = useState<Array<{ file: File; preview: string }>>([]);
  const photoCount = keptPhotos.length + addedPhotos.length;

  useEffect(
    () => () => addedPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview)),
    // Revoke previews only on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const accepted = Array.from(files).filter(isAcceptedBillPhoto);
    if (accepted.length < files.length) setError('Only JPG, PNG or WebP photos can be added.');
    const room = MAX_BILL_PHOTOS - photoCount;
    if (accepted.length > room) setError(`You can attach up to ${MAX_BILL_PHOTOS} photos.`);
    setAddedPhotos((current) => [
      ...current,
      ...accepted.slice(0, Math.max(0, room)).map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
  };

  const removeAddedPhoto = (index: number) => {
    setAddedPhotos((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  };

  const updateItem = (index: number, patch: Partial<FinalBillItem>) => {
    setError(null);
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = () => {
    const problem = validateFinalBillItems(items);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(
      items.map((item) => ({
        ...item,
        actual_line_total: item.status === 'unavailable' ? 0 : Math.round(item.actual_line_total),
        substitute_name: item.status === 'substituted' ? item.substitute_name?.trim() || null : null,
        note: item.note?.trim() || null,
      })),
      { kept: keptPhotos, added: addedPhotos.map((photo) => photo.file) },
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-extrabold text-gray-800">Final bill</h3>
            <p className="mt-0.5 text-sm text-gray-500">
              #{order.id.slice(0, 8).toUpperCase()} · {order.contact_name}. Enter what you actually paid for each item.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {order.bill_status === 'queried' && order.bill_customer_note && (
            <div className="flex gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
              <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">The customer queried the last bill</p>
                <p className="mt-0.5">"{order.bill_customer_note}"</p>
              </div>
            </div>
          )}

          {items.map((item, index) => {
            const estimatedLine = item.estimated_unit_price * item.quantity;
            const unavailable = item.status === 'unavailable';
            const lineDiff = unavailable ? 0 : (item.actual_line_total || 0) - estimatedLine;

            return (
              <div key={`${item.product_id}-${index}`} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">
                      {item.name} <span className="font-medium text-gray-500">({item.unit}) × {item.quantity}</span>
                    </p>
                    <p className="text-xs text-gray-500">Estimated {formatUGX(estimatedLine)}</p>
                  </div>
                  <div className="flex rounded-full bg-gray-100 p-0.5" role="radiogroup" aria-label={`${item.name} status`}>
                    {LINE_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={item.status === option.value}
                        onClick={() => updateItem(index, { status: option.value })}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                          item.status === option.value
                            ? option.value === 'unavailable'
                              ? 'bg-white text-red-600 shadow-sm'
                              : 'bg-white text-brand-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!unavailable && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {item.status === 'substituted' && (
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-gray-600">Replaced with</span>
                        <input
                          value={item.substitute_name ?? ''}
                          onChange={(event) => updateItem(index, { substitute_name: event.target.value })}
                          placeholder="e.g. Red onions, 1 kg"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-gray-600">Paid for this line (UGX)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={500}
                        value={Number.isFinite(item.actual_line_total) ? item.actual_line_total : ''}
                        onChange={(event) =>
                          updateItem(index, { actual_line_total: event.target.valueAsNumber || 0 })
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                    </label>
                    <div className="flex items-end">
                      {lineDiff !== 0 && (
                        <span
                          className={`text-xs font-bold ${lineDiff > 0 ? 'text-red-600' : 'text-brand-700'}`}
                        >
                          {lineDiff > 0 ? '+' : '−'}
                          {formatUGX(Math.abs(lineDiff))} vs estimate
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <input
                  value={item.note ?? ''}
                  onChange={(event) => updateItem(index, { note: event.target.value })}
                  placeholder="Note for the customer (optional)"
                  className="mt-2 w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-brand-300 focus:bg-white"
                />
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-gray-700">
                Photos of the goods or market receipt{' '}
                <span className="font-medium text-gray-400">
                  ({photoCount}/{MAX_BILL_PHOTOS}{summary.autoApproves ? ', optional' : ', recommended'})
                </span>
              </p>
              {photoCount < MAX_BILL_PHOTOS && (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-100">
                  <Camera className="h-3.5 w-3.5" />
                  Add photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    multiple
                    className="sr-only"
                    disabled={saving}
                    onChange={(event) => {
                      addPhotos(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>
            {photoCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {keptPhotos.map((url) => (
                  <PhotoThumb
                    key={url}
                    src={url}
                    disabled={saving}
                    onRemove={() => setKeptPhotos((current) => current.filter((item) => item !== url))}
                  />
                ))}
                {addedPhotos.map((photo, index) => (
                  <PhotoThumb
                    key={photo.preview}
                    src={photo.preview}
                    disabled={saving}
                    onRemove={() => removeAddedPhoto(index)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <SummaryRow label="Estimated total" value={formatUGX(summary.estimatedTotal)} muted />
            <SummaryRow label="Items bought" value={formatUGX(summary.subtotal)} />
            <SummaryRow label="Delivery fee" value={formatUGX(summary.deliveryFee)} />
            <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
              <span className="font-bold text-gray-800">Final total</span>
              <span className="text-lg font-extrabold text-brand-700">{formatUGX(summary.total)}</span>
            </div>
          </div>

          {summary.autoApproves ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Within the estimate with no replacements, so it is approved automatically and you can dispatch.
            </p>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {summary.hasSubstitution
                ? 'Has replacements, so the customer must approve before dispatch.'
                : `${formatUGX(summary.difference)} over the estimate, so the customer must approve before dispatch.`}
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:bg-gray-300"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {summary.autoApproves ? 'Save final bill' : 'Send bill to customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
      <span className={muted ? 'text-gray-400' : 'font-semibold text-gray-800'}>
        {value}
      </span>
    </div>
  );
}

function PhotoThumb({ src, disabled, onRemove }: { src: string; disabled: boolean; onRemove: () => void }) {
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <img src={src} alt="Bill photo" className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label="Remove photo"
        className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
