'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Film, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function UploadDropzone({
  onFileSelect,
  disabled,
}: {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: unknown[]) => {
      setError(null);

      if (rejectedFiles.length > 0) {
        setError('Invalid file type or size exceeded (5GB max)');
        return;
      }

      if (acceptedFiles[0]) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-matroska': ['.mkv'],
    },
    maxSize: 5 * 1024 * 1024 * 1024, // 5GB
    multiple: false,
    disabled,
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          disabled
            ? 'cursor-not-allowed border-white/5 opacity-50'
            : isDragReject
              ? 'border-danger/60 bg-danger/10'
              : isDragActive
                ? 'border-brand-border bg-white/[0.04] shadow-[0_0_36px_rgba(99,91,255,0.15)]'
                : 'border-white/10 bg-black/20 hover:border-brand-border/60 hover:bg-white/[0.02]'
        }`}
      >
        <input {...getInputProps()} />

        <AnimatePresence>
          {isDragActive && !isDragReject && (
            <motion.div
              layoutId="dropzone-glow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -left-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-xl border transition-colors ${
              isDragReject
                ? 'border-danger/45 bg-danger/10 text-danger'
                : isDragActive
                  ? 'border-brand-border bg-brand/10 text-brand-light'
                  : 'border-white/10 bg-black/45 text-textMuted group-hover:border-brand-border group-hover:text-brand-light'
            }`}
          >
            {isDragReject ? <AlertTriangle className="h-6 w-6" /> : <UploadCloud className="h-6 w-6" />}
          </div>

          <div className="space-y-1 group-hover:text-brand-light">
            <p className="text-base font-medium text-white transition-colors group-hover:text-brand-light">
              {isDragReject
                ? 'File not supported'
                : isDragActive
                  ? 'Drop video here'
                  : 'Drag & drop a video'}
            </p>
            <p className="text-sm text-textMuted">
              or click to browse from your computer
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-textMuted">
            <Film className="h-3 w-3 opacity-60" />
            <span>MP4, MOV, MKV up to 5GB</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs font-medium text-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
