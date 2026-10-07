"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Crop,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCcw,
  Check,
  Loader2,
  Move,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import { ImageUploadService } from "@/lib/image-upload";

export type AspectRatioType = "free" | "1:1" | "4:3" | "16:9" | "4:5";

interface ImageCropperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onCropComplete: (croppedUrl: string) => void;
  folder?: string;
  defaultAspectRatio?: AspectRatioType;
}

export function ImageCropperModal({
  open,
  onOpenChange,
  imageUrl,
  onCropComplete,
  folder = "community_posts",
  defaultAspectRatio = "16:9",
}: ImageCropperModalProps) {
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>(defaultAspectRatio);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0); // in degrees: 0, 90, 180, 270
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isApplying, setIsApplying] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset controls when a new image is loaded or modal opens
  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setAspectRatio(defaultAspectRatio);
    }
  }, [open, imageUrl, defaultAspectRatio]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  // Compute crop box aspect ratio width/height relative to the container
  const getAspectRatioFraction = (ratio: AspectRatioType): number => {
    switch (ratio) {
      case "1:1":
        return 1;
      case "4:3":
        return 4 / 3;
      case "16:9":
        return 16 / 9;
      case "4:5":
        return 4 / 5;
      case "free":
      default:
        if (naturalDimensions.width && naturalDimensions.height) {
          return naturalDimensions.width / naturalDimensions.height;
        }
        return 16 / 9;
    }
  };

  // Pointer drag events for panning
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(3, Math.max(0.5, Number((prev + delta).toFixed(2)))));
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const applyCrop = async () => {
    if (!imageUrl) return;
    setIsApplying(true);

    try {
      // Load image on offscreen canvas
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load source image for cropping"));
        img.src = imageUrl;
      });

      const container = containerRef.current;
      if (!container) throw new Error("Cropper view not ready");

      const rect = container.getBoundingClientRect();
      const containerW = rect.width;
      const containerH = rect.height;

      // Crop box dimensions in screen pixels
      const ratioFraction = getAspectRatioFraction(aspectRatio);
      let cropW = containerW * 0.9;
      let cropH = cropW / ratioFraction;

      if (cropH > containerH * 0.9) {
        cropH = containerH * 0.9;
        cropW = cropH * ratioFraction;
      }

      // Desired export resolution
      const exportWidth = Math.min(1600, Math.round(cropW * 2.5));
      const exportHeight = Math.round(exportWidth / ratioFraction);

      const canvas = document.createElement("canvas");
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) throw new Error("Could not create 2D canvas context");

      // Fill background (white for clean borders)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, exportWidth, exportHeight);

      // Coordinate transformation
      // Scale from container coords to export canvas coords
      const scaleToCanvas = exportWidth / cropW;

      ctx.save();
      // Center canvas
      ctx.translate(exportWidth / 2, exportHeight / 2);

      // Apply Pan (scaled to canvas coordinates)
      ctx.translate(pan.x * scaleToCanvas, pan.y * scaleToCanvas);

      // Apply Rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Natural image aspect calculation
      const isRotated90or270 = rotation % 180 !== 0;
      const srcW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
      const srcH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

      // Base fit scaling in container:
      // In container, image base size:
      const baseScale = Math.min(cropW / srcW, cropH / srcH);
      const drawW = img.naturalWidth * baseScale * zoom * scaleToCanvas;
      const drawH = img.naturalHeight * baseScale * zoom * scaleToCanvas;

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });

      if (!blob) throw new Error("Could not process cropped image");

      const file = new File([blob], `cropped-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Upload using existing service
      const uploadResult = await ImageUploadService.uploadImage(file, folder);

      toast.success("Image cropped & updated successfully!");
      onCropComplete(uploadResult.url);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Cropping error:", err);
      toast.error(err.message || "Failed to crop image");
    } finally {
      setIsApplying(false);
    }
  };

  const ratioFraction = getAspectRatioFraction(aspectRatio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-4 sm:p-6 overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Crop className="h-5 w-5 text-primary" />
            Adjust & Crop Image
          </DialogTitle>
        </DialogHeader>

        {/* Aspect Ratio Preset Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 pb-1">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Aspect Ratio:</span>
          {(
            [
              { key: "16:9", label: "16:9 (Landscape)" },
              { key: "4:3", label: "4:3 (Standard)" },
              { key: "1:1", label: "1:1 (Square)" },
              { key: "4:5", label: "4:5 (Portrait)" },
              { key: "free", label: "Original / Free" },
            ] as const
          ).map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={aspectRatio === item.key ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => {
                setAspectRatio(item.key);
                setPan({ x: 0, y: 0 });
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>

        {/* Cropping Canvas Viewport */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-full h-[360px] sm:h-[420px] bg-slate-950 rounded-xl overflow-hidden select-none flex items-center justify-center cursor-grab active:cursor-grabbing border border-slate-800 touch-none shadow-inner"
        >
          {/* Draggable & Zoomable Source Image */}
          {imageUrl && (
            <div
              className="absolute transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Source to crop"
                onLoad={handleImageLoad}
                className="max-w-none max-h-[400px] object-contain drop-shadow-lg"
                crossOrigin="anonymous"
                draggable={false}
              />
            </div>
          )}

          {/* Mask & Crop Box Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className="relative border-2 border-primary/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] rounded-lg pointer-events-none transition-all duration-200"
              style={{
                width: ratioFraction >= 1 ? "85%" : `${Math.min(85, 85 * ratioFraction)}%`,
                aspectRatio: `${ratioFraction}`,
                maxHeight: "88%",
              }}
            >
              {/* Rule of Thirds Grid Guidelines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                <div className="border-r border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-r border-b border-white/50" />
                <div className="border-b border-white/50" />
                <div className="border-r border-white/50" />
                <div className="border-r border-white/50" />
                <div />
              </div>

              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary" />
            </div>
          </div>

          {/* Hint Overlay badge */}
          <div className="absolute bottom-2 left-2 z-10 px-2 py-1 bg-black/75 backdrop-blur-md rounded-md text-[11px] text-white/90 flex items-center gap-1.5 shadow pointer-events-none">
            <Move className="h-3 w-3 text-primary" />
            <span>Click & drag to reposition image</span>
          </div>
        </div>

        {/* Toolbar: Zoom, Rotate, Reset */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
            <ZoomOut
              className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
            />
            <Slider
              value={[zoom]}
              min={0.5}
              max={3}
              step={0.05}
              onValueChange={([val]) => setZoom(val)}
              className="flex-1"
            />
            <ZoomIn
              className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))))}
            />
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Rotate 90°
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Reset View
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-3 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={applyCrop}
            disabled={isApplying || !imageUrl}
            className="gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying Crop...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Apply & Save Crop
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
