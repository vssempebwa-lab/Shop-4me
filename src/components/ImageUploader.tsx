import { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Link, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function getFileExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension) return extension;
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  productName?: string;
}

export default function ImageUploader({
  value,
  onChange,
  productName = 'product',
}: ImageUploaderProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(value);
  const [externalUrl, setExternalUrl] = useState(value);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreviewUrl(value);
    setExternalUrl(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const clearBlobPreview = () => {
    if (previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  const validateFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return 'Upload a JPG, PNG, or WebP image.';
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return 'Image must be 5MB or smaller.';
    }

    return '';
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    clearBlobPreview();
    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setError('');
    setUploading(true);
    setProgress(12);

    const progressTimer = window.setInterval(() => {
      setProgress((current) => Math.min(current + 14, 86));
    }, 350);

    const safeName = sanitizeFileName(productName || 'product');
    const filePath = `${safeName || 'product'}-${crypto.randomUUID()}.${getFileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    window.clearInterval(progressTimer);

    if (uploadError) {
      setUploading(false);
      setProgress(0);
      setError(
        uploadError.message.includes('Bucket not found')
          ? 'Product image storage is not set up yet. Create the product-images bucket in Supabase, or paste an image URL below.'
          : uploadError.message || 'Could not upload image.',
      );
      return;
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    setProgress(100);
    setPreviewUrl(data.publicUrl);
    setExternalUrl(data.publicUrl);
    onChange(data.publicUrl);

    window.setTimeout(() => {
      setUploading(false);
      setProgress(0);
    }, 350);
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      void uploadFile(file);
    }
  };

  const handleRemove = () => {
    clearBlobPreview();
    setPreviewUrl('');
    setExternalUrl('');
    setError('');
    setUploading(false);
    setProgress(0);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExternalUrlChange = (nextUrl: string) => {
    clearBlobPreview();
    setExternalUrl(nextUrl);
    setPreviewUrl(nextUrl.trim());
    setError('');
    onChange(nextUrl);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-gray-600">Product Image</span>
        <span className="text-[11px] font-medium text-gray-400">JPG, PNG or WebP, max 5MB</span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`relative overflow-hidden rounded-2xl border border-dashed bg-gray-50 transition ${
          dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'
        }`}
      >
        {previewUrl ? (
          <div className="relative aspect-[16/10] bg-gray-100">
            <img
              src={previewUrl}
              alt="Product preview"
              className="h-full w-full object-cover"
              onError={() => setError('This image URL could not be previewed. Check the link or upload a file.')}
            />
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-gray-700 shadow-sm transition hover:bg-brand-50 hover:text-brand-700"
                aria-label="Replace image"
              >
                <Upload className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-gray-700 shadow-sm transition hover:bg-red-50 hover:text-red-600"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-44 w-full flex-col items-center justify-center px-4 py-8 text-center"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm">
              <ImagePlus className="h-6 w-6" />
            </span>
            <span className="mt-3 text-sm font-bold text-gray-800">Upload Image</span>
            <span className="mt-1 text-xs text-gray-500">Drag and drop, or click to browse</span>
          </button>
        )}

        {uploading && (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading image
              <span className="ml-auto">{progress}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => handleFiles(event.target.files)}
      />

      <label className="mt-3 block">
        <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
          <Link className="h-3.5 w-3.5" />
          Or paste image URL
        </span>
        <input
          value={externalUrl}
          onChange={(event) => handleExternalUrlChange(event.target.value)}
          placeholder="https://..."
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
        />
      </label>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
