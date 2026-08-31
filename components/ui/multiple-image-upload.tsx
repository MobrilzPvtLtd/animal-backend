"use client";

import React, { useState, useRef } from 'react';
import { X, Loader2, Image as ImageIcon, GripVertical, Plus, Upload, Link as LinkIcon, FileUp, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUploadService } from '@/lib/image-upload';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface ServiceProviderImage {
  service_provider_image?: number;
  image_url: string;
  order: number;
  isNew?: boolean;
}

interface MultipleImageUploadProps {
  value: ServiceProviderImage[];
  onChange: (images: ServiceProviderImage[]) => void;
  onError?: (error: string) => void;
  folder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  maxImages?: number;
  maxSize?: number;
}

interface UploadingFile {
  id: string;
  name: string;
  completed: boolean;
  error?: string;
}

interface SortableImageItemProps {
  image: ServiceProviderImage;
  index: number;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export const getImageId = (image: ServiceProviderImage, index: number): string => {
  if (image.service_provider_image) return `id-${image.service_provider_image}`;
  if (image.image_url) return `url-${image.image_url}`;
  return `idx-${index}`;
};

function SortableImageItem({ image, index, onRemove, disabled }: SortableImageItemProps) {
  const itemId = getImageId(image, index);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 0 : 1,
  };

  const [imgError, setImgError] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group touch-none cursor-grab active:cursor-grabbing ${
        isDragging ? 'ring-2 ring-primary/40 rounded-lg' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <Card className="overflow-hidden border transition-all hover:border-primary/50 hover:shadow-md select-none">
        <CardContent className="p-2">
          <div className="relative aspect-video w-full">
            {imgError ? (
              <div className="w-full h-32 flex items-center justify-center bg-muted rounded-md">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={image.image_url}
                alt={`Image ${index + 1}`}
                className="w-full h-32 object-cover rounded-md pointer-events-none select-none"
                onError={() => setImgError(true)}
              />
            )}

            {/* Drag Handle & Order Badge */}
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold rounded-md flex items-center gap-1 shadow-md select-none pointer-events-none">
              <GripVertical className="h-3.5 w-3.5 opacity-80" />
              <span>{index + 1}</span>
            </div>

            {/* Remove Button */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 h-7 w-7 p-0 rounded-full shadow-md z-20 opacity-80 group-hover:opacity-100 transition-opacity"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRemove(index);
              }}
              disabled={disabled}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImageCardOverlay({ image, index }: { image: ServiceProviderImage; index: number }) {
  return (
    <div className="w-full shadow-2xl ring-2 ring-primary rounded-lg cursor-grabbing scale-105 opacity-95">
      <Card className="overflow-hidden border border-primary bg-background">
        <CardContent className="p-2">
          <div className="relative aspect-video w-full">
            <img
              src={image.image_url}
              alt={`Image ${index + 1}`}
              className="w-full h-32 object-cover rounded-md pointer-events-none select-none"
            />
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold rounded-md flex items-center gap-1 shadow-md select-none pointer-events-none">
              <GripVertical className="h-3.5 w-3.5 opacity-80" />
              <span>{index + 1}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UploadingPlaceholder({ name }: { name: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2">
        <div className="w-full h-32 flex flex-col items-center justify-center bg-muted rounded-md gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground text-center px-2 truncate max-w-full">
            {name}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function MultipleImageUpload({
  value = [],
  onChange,
  onError,
  folder = "service-providers",
  label = "Images",
  className = "",
  disabled = false,
  maxImages = 10,
  maxSize = 50,
}: MultipleImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [pastedUrl, setPastedUrl] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFileUpload = async (files: FileList) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    const remainingSlots = maxImages - value.length - uploadingFiles.length;

    if (fileArray.length > remainingSlots) {
      toast.error(`You can only upload ${remainingSlots} more image(s)`);
      return;
    }

    const uploads = fileArray.map((file) => ({
      id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      completed: false,
    }));

    setUploadingFiles((prev) => [...prev, ...uploads]);

    const completedImages: ServiceProviderImage[] = [];

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];

        if (file.size > maxSize * 1024 * 1024) {
          const errorMsg = `${file.name} is too large. Maximum size is ${maxSize}MB`;
          toast.error(errorMsg);
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === uploads[i].id ? { ...u, error: errorMsg, completed: true } : u
            )
          );
          continue;
        }

        if (!file.type.startsWith('image/')) {
          const errorMsg = `${file.name} is not an image`;
          toast.error(errorMsg);
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === uploads[i].id ? { ...u, error: errorMsg, completed: true } : u
            )
          );
          continue;
        }

        try {
          const result = await ImageUploadService.uploadImage(file, folder);
          completedImages.push({
            image_url: result.url,
            order: value.length + completedImages.length,
            isNew: true,
          });
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === uploads[i].id ? { ...u, completed: true } : u
            )
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : `Failed to upload ${file.name}`;
          toast.error(errorMsg);
          setUploadingFiles((prev) =>
            prev.map((u) =>
              u.id === uploads[i].id ? { ...u, error: errorMsg, completed: true } : u
            )
          );
        }
      }

      if (completedImages.length > 0) {
        onChange([...value, ...completedImages]);
      }
    } finally {
      setUploadingFiles((prev) => prev.filter((u) => !u.completed || u.error));
    }
  };

  const handleAddUrl = () => {
    const trimmed = pastedUrl.trim();
    if (!trimmed) {
      toast.error('Please enter a valid image URL');
      return;
    }

    if (value.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const newImage: ServiceProviderImage = {
      image_url: trimmed,
      order: value.length,
      isNew: true,
    };

    onChange([...value, newImage]);
    setPastedUrl('');
    toast.success('Image link added successfully');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = '';
  };

  const handleCameraSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleRemoveImage = (index: number) => {
    const newImages = value.filter((_, i) => i !== index);
    const reorderedImages = newImages.map((img, i) => ({
      ...img,
      order: i,
    }));
    onChange(reorderedImages);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id.toString());
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const activeIndex = value.findIndex((img, i) => getImageId(img, i) === active.id);
      const overIndex = value.findIndex((img, i) => getImageId(img, i) === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const newImages = arrayMove(value, activeIndex, overIndex);
        const reorderedImages = newImages.map((img, i) => ({
          ...img,
          order: i,
        }));
        onChange(reorderedImages);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeImageIndex = activeId ? value.findIndex((img, i) => getImageId(img, i) === activeId) : -1;
  const activeImage = activeImageIndex !== -1 ? value[activeImageIndex] : null;

  const totalSlots = value.length + uploadingFiles.length;
  const canAddMore = totalSlots < maxImages;
  const uploadingCount = uploadingFiles.length;

  return (
    <div className={`space-y-4 ${className}`}>
      {label && <Label className="text-base font-medium">{label}</Label>}

      <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`px-3 py-1.5 rounded-sm font-medium transition-colors ${
            activeTab === 'file' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileUp className="h-3.5 w-3.5 inline mr-1.5" />
          Upload / Camera
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`px-3 py-1.5 rounded-sm font-medium transition-colors ${
            activeTab === 'url' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LinkIcon className="h-3.5 w-3.5 inline mr-1.5" />
          Paste Image Link
        </button>
      </div>

      {canAddMore && (
        activeTab === 'file' ? (
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="space-y-3">
              {uploadingCount > 0 ? (
                <Upload className="h-8 w-8 mx-auto text-primary animate-pulse" />
              ) : (
                <div className="flex justify-center gap-2 text-gray-400">
                  <Camera className="h-7 w-7" />
                  <Upload className="h-7 w-7" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {uploadingCount > 0
                    ? `Uploading ${uploadingCount} file(s)...`
                    : 'Take a photo or choose from device gallery'}
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to {maxSize}MB ({totalSlots}/{maxImages} images)
                </p>
              </div>

              {!uploadingCount && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="gap-1.5 bg-primary hover:bg-primary/90 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    disabled={disabled}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Take Photo (Camera)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    disabled={disabled}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose Files (Gallery)
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-4 space-y-3 bg-card">
            <Label className="text-xs text-muted-foreground">Add image via direct URL link:</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Paste image link/URL here (e.g. https://example.com/photo.jpg)"
                value={pastedUrl}
                onChange={(e) => setPastedUrl(e.target.value)}
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrl();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddUrl}
                disabled={disabled || !pastedUrl.trim()}
              >
                Add Link
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Current count: {totalSlots}/{maxImages} images
            </p>
          </div>
        )
      )}

      {/* Hidden file input for gallery */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Hidden camera input for direct camera capture */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraSelect}
        className="hidden"
        disabled={disabled}
      />

      {(value.length > 0 || uploadingFiles.length > 0) && (
        <div className="space-y-2">
          {value.length > 0 && (
            <Label className="text-sm text-gray-600">
              Drag images to reorder them:
            </Label>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={value.map((img, i) => getImageId(img, i))}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {value.map((image, index) => (
                  <SortableImageItem
                    key={getImageId(image, index)}
                    image={image}
                    index={index}
                    onRemove={handleRemoveImage}
                    disabled={disabled}
                  />
                ))}
                {uploadingFiles.map((file) => (
                  <UploadingPlaceholder key={file.id} name={file.name} />
                ))}
              </div>
            </SortableContext>

            <DragOverlay adjustScale={false}>
              {activeImage ? (
                <ImageCardOverlay image={activeImage} index={activeImageIndex} />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {value.length === 0 && uploadingFiles.length === 0 && (
        <div className="text-center py-8 text-gray-500 border rounded-lg border-dashed">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images added yet</p>
        </div>
      )}
    </div>
  );
}

