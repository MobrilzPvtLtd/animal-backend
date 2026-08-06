"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, Image as ImageIcon, Link as LinkIcon, FileUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageUploadService } from '@/lib/image-upload';
import { toast } from 'sonner';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onError?: (error: string) => void;
  folder?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  variant?: 'default' | 'avatar' | 'card';
  disabled?: boolean;
  maxSize?: number; // in MB
  accept?: string;
}

export const ImageUpload = React.forwardRef<HTMLDivElement, ImageUploadProps>(
  (
    {
      value,
      onChange,
      onError,
      folder,
      label = "Image",
      placeholder = "Upload an image",
      className = "",
      variant = "default",
      disabled = false,
      maxSize = 20,
      accept = "image/*",
    },
    ref
  ) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');
  const [pastedUrl, setPastedUrl] = useState(value || '');
  const [imageLoadError, setImageLoadError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync pastedUrl with incoming value prop (for edit forms)
  useEffect(() => {
    if (value) {
      setPastedUrl(value);
      setImageLoadError(false);
    } else {
      setPastedUrl('');
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const handleFileUpload = async (file: File) => {
    if (disabled) return;

    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setIsUploading(true);

    try {
      if (file.size > maxSize * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxSize}MB`);
      }

      const result = await ImageUploadService.replaceImage(file, value, folder);
      onChange(result.url);
      setPastedUrl(result.url);
      setLocalPreview(null);
      toast.success('Image uploaded successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      toast.error(errorMessage);
      onError?.(errorMessage);
      setLocalPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileUpload(file);
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

  const handleRemoveImage = () => {
    onChange('');
    setLocalPreview(null);
    setPastedUrl('');
    setImageLoadError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlInputChange = (urlValue: string) => {
    setPastedUrl(urlValue);
    setImageLoadError(false);
    onChange(urlValue.trim());
  };

  const handleApplyUrl = () => {
    const trimmed = pastedUrl.trim();
    if (!trimmed) {
      toast.error('Please paste a valid image URL');
      return;
    }
    onChange(trimmed);
    setImageLoadError(false);
    toast.success('Image URL updated');
  };

  const displayUrl = localPreview || value || '';

  const renderImagePreview = () => {
    const hasImage = !!displayUrl;

    if (variant === 'avatar') {
      return (
        <div className="space-y-3">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={displayUrl} alt="Preview" />
              <AvatarFallback>
                <ImageIcon className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs w-fit mb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('file')}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    activeTab === 'file' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileUp className="h-3 w-3 inline mr-1" />
                  File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('url')}
                  className={`px-2 py-1 rounded-sm font-medium transition-colors ${
                    activeTab === 'url' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LinkIcon className="h-3 w-3 inline mr-1" />
                  Paste URL
                </button>
              </div>

              {activeTab === 'file' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {isUploading ? 'Uploading...' : 'Upload Image'}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com/image.jpg"
                    value={pastedUrl}
                    onChange={(e) => handleUrlInputChange(e.target.value)}
                    disabled={disabled}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyUrl}
                    disabled={disabled || !pastedUrl.trim()}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </div>
          </div>
          {hasImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive"
              onClick={handleRemoveImage}
            >
              <X className="h-3 w-3 mr-1" /> Remove Image
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Toggle Mode Header */}
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
                activeTab === 'file' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileUp className="h-3.5 w-3.5 inline mr-1.5" />
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-2.5 py-1 rounded-sm font-medium transition-colors ${
                activeTab === 'url' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5 inline mr-1.5" />
              Paste Image Link
            </button>
          </div>
          {hasImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleRemoveImage}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'file' ? (
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${dragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          >
            {hasImage ? (
              <div className="relative inline-block">
                <img
                  src={displayUrl}
                  alt="Preview"
                  className="max-h-40 mx-auto rounded-lg object-cover border"
                  onError={() => setImageLoadError(true)}
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center z-10">
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                      <span className="text-xs text-white font-medium">Uploading...</span>
                    </div>
                  </div>
                )}
                {!isUploading && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute -top-2 -right-2 z-10 h-6 w-6 p-0 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <span className="text-sm font-medium">Uploading...</span>
                  </div>
                ) : (
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                )}
                <div>
                  <p className="text-sm font-medium">{placeholder}</p>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, GIF up to {maxSize}MB
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Paste image link/URL here (e.g. https://example.com/photo.jpg)"
                value={pastedUrl}
                onChange={(e) => handleUrlInputChange(e.target.value)}
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyUrl();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleApplyUrl}
                disabled={disabled || !pastedUrl.trim()}
              >
                Apply Link
              </Button>
            </div>
            {hasImage && !imageLoadError && (
              <div className="relative inline-block border rounded-lg p-2 bg-muted/30">
                <img
                  src={displayUrl}
                  alt="URL Preview"
                  className="max-h-40 mx-auto rounded-lg object-cover"
                  onError={() => setImageLoadError(true)}
                />
              </div>
            )}
            {imageLoadError && displayUrl && (
              <p className="text-xs text-amber-600 font-medium">
                ⚠️ Unable to preview image from URL (it will still be saved).
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={ref} className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}

      {renderImagePreview()}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
}
);
ImageUpload.displayName = "ImageUpload";


