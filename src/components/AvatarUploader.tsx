import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import UserAvatar from './UserAvatar';
import type { UserRoleProfile } from '../types';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const AVATAR_SIZE = 320;

interface AvatarUploaderProps {
  fullName: string;
  email: string;
  file: File | null;
  previewUrl: string;
  onFileChange: (file: File | null, previewUrl: string) => void;
}

export default function AvatarUploader({
  fullName,
  email,
  file,
  previewUrl,
  onFileChange,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const hasImage = Boolean(previewUrl);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const chooseFile = async (nextFile?: File) => {
    if (!nextFile) return;
    setError('');

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setError('Upload a JPG, PNG, or WebP profile photo.');
      return;
    }

    if (nextFile.size > MAX_AVATAR_SIZE) {
      setError('Profile photo must be 2MB or smaller.');
      return;
    }

    const compressedFile = await resizeAvatarFile(nextFile);
    const nextPreviewUrl = URL.createObjectURL(compressedFile);
    onFileChange(compressedFile, nextPreviewUrl);
  };

  const removeFile = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    onFileChange(null, '');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const fallbackUser: UserRoleProfile = {
    user_id: 'preview',
    full_name: fullName || null,
    email: email || null,
    avatar_url: previewUrl || null,
    role: 'attendant',
  };

  return (
    <div className="md:col-span-2">
      <span className="mb-1 block text-xs font-semibold text-gray-600">Profile Picture</span>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void chooseFile(event.dataTransfer.files[0]);
        }}
        className={`flex flex-wrap items-center gap-4 rounded-2xl border border-dashed bg-gray-50 p-4 transition ${
          dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-200'
        }`}
      >
        <UserAvatar user={fallbackUser} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-800">
            {file ? file.name : hasImage ? 'Profile photo selected' : 'Upload profile photo'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Drag and drop, or browse. Optional, JPG/PNG/WebP up to 2MB.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-brand-300 hover:bg-brand-50"
            >
              {file ? <Upload className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
              {file ? 'Replace' : 'Browse'}
            </button>
            {hasImage && (
              <button
                type="button"
                onClick={removeFile}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

async function resizeAvatarFile(file: File) {
  const image = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_SIZE / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return file;

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86);
  });

  if (!blob) return file;

  return new File([blob], file.name, { type: blob.type || file.type });
}
