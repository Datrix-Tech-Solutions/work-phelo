'use client';

import { useState } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { ZoomIn } from 'lucide-react';

interface AvatarCropperProps {
  imageSrc: string;
  onCropComplete: (croppedAreaPixels: Area) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Pan/zoom crop frame for a freshly-picked avatar file. Reports pixel crop
 * bounds on every change; the caller reads the latest value when saving
 * rather than storing an intermediate cropped image.
 */
export function AvatarCropper({ imageSrc, onCropComplete }: AvatarCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full h-72 rounded-2xl overflow-hidden bg-gray-900">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, areaPixels) => onCropComplete(areaPixels)}
        />
      </div>

      <div className="flex items-center gap-3 w-full max-w-xs">
        <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-brand"
          aria-label="Zoom"
        />
      </div>

      <p className="text-xs text-gray-400">Drag to reposition, use the slider to zoom.</p>
    </div>
  );
}
