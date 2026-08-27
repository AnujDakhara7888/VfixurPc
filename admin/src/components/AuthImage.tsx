'use client';

import { useEffect, useState } from 'react';
import { deliveryApi } from '@/lib/api';
import { ImageOff } from 'lucide-react';

/** Renders a proof photo that lives behind an authenticated endpoint. */
export default function AuthImage({ photoId, className }: { photoId: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    deliveryApi.photoObjectUrl(photoId)
      .then((u) => { if (alive) { revoked = u; setUrl(u); } else { URL.revokeObjectURL(u); } })
      .catch(() => alive && setErr(true));
    return () => { alive = false; if (revoked) URL.revokeObjectURL(revoked); };
  }, [photoId]);

  if (err) {
    return <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className ?? ''}`}><ImageOff className="w-4 h-4" /></div>;
  }
  if (!url) {
    return <div className={`animate-pulse bg-gray-100 ${className ?? ''}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Proof" className={className} />;
}
