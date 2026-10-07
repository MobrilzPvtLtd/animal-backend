"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  X,
  Move,
} from "lucide-react";

interface ImageLightboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  initialIndex?: number;
  title?: string;
}

export function ImageLightboxModal({
  open,
  onOpenChange,
  images = [],
  initialIndex = 0,
  title,
}: ImageLightboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState<"contain" | "cover">("contain");

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setFitMode("contain");
    }
  }, [open, initialIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
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
      // Ignore
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.min(4, Math.max(0.5, Number((prev + delta).toFixed(2)))));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      handleReset();
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      handleReset();
    }
  };

  const currentImage = images[currentIndex] || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 overflow-hidden bg-black/95 border-slate-800 text-white flex flex-col">
        {/* Top Header Controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium truncate max-w-xs text-white/90">
              {title || "Community Image"}
            </span>
            {images.length > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white/80">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-mono text-white/70 w-10 text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-white hover:bg-white/20 h-8 px-2 text-xs gap-1"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFitMode((m) => (m === "contain" ? "cover" : "contain"))}
              className="text-white hover:bg-white/20 h-8 px-2 text-xs gap-1"
              title="Toggle Fit / Fill"
            >
              {fitMode === "contain" ? (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  Fill
                </>
              ) : (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  Fit
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 h-8 w-8 p-0 ml-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Interactive Canvas Area */}
        <div
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex-1 w-full h-full overflow-hidden select-none flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          {currentImage ? (
            <div
              className="transition-transform duration-75 pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={currentImage}
                alt={title || "Full image"}
                className={`max-w-none transition-all ${
                  fitMode === "contain"
                    ? "max-h-[80vh] max-w-[90vw] object-contain"
                    : "h-[85vh] w-auto object-cover"
                }`}
                draggable={false}
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No image available</p>
          )}

          {/* Navigation Arrows for multi-image */}
          {images.length > 1 && (
            <>
              {currentIndex > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full h-10 w-10 z-20 shadow-lg"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              {currentIndex < images.length - 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full h-10 w-10 z-20 shadow-lg"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
            </>
          )}

          {/* Pan & Drag Prompt badge */}
          <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-md text-xs text-white/80 flex items-center gap-1.5 shadow pointer-events-none">
            <Move className="h-3 w-3 text-primary" />
            <span>Click & drag to pan • Scroll to zoom</span>
          </div>
        </div>

        {/* Bottom thumbnail strip if multiple images */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md border-t border-white/10 z-20 overflow-x-auto">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  handleReset();
                }}
                className={`h-12 w-12 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
                  currentIndex === idx ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img} alt={`Thumb ${idx + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
