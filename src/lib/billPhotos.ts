import { supabase } from './supabase';

export const MAX_BILL_PHOTOS = 6;
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function isAcceptedBillPhoto(file: File) {
  return ACCEPTED_TYPES.includes(file.type);
}

/** Downscale to at most 1600px on the long edge and re-encode as JPEG. */
export async function compressBillPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process the photo.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the photo.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** Uploads to bill-photos/<orderId>/<random>.jpg and returns the public URL. */
export async function uploadBillPhoto(orderId: string, photo: Blob) {
  const path = `${orderId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from('bill-photos')
    .upload(path, photo, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(error.message || 'Could not upload the photo.');
  return supabase.storage.from('bill-photos').getPublicUrl(path).data.publicUrl;
}

/** Local demo orders (dev only) keep photos inline as data URLs. */
export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
