'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileAudio, X, Loader2, Edit3, Image as ImageIcon } from 'lucide-react';
import { UnifiedStorage, StorageSystem, StorageOptions, StorageResult } from '@/lib/storage/unifiedStorage';
import { parseBlob } from 'music-metadata';

interface UploadComponentProps {
  onUploadComplete?: (metadata: {
    title: string;
    artist: string;
    album: string;
    genre: string;
    year: number;
    duration: number;
    storageResult: StorageResult;
  }) => void;
}

interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number;
  duration: number;
  description: string;
  coverArtUrl?: string;
  coverArtData?: string; // Base64 encoded cover art
}

export const UploadComponent: React.FC<UploadComponentProps> = ({
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        validateAndSetFile(files[0]);
      }
    },
    []
  );

  const validateAndSetFile = (file: File) => {
    setError(null);

    // Check file type
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/wav',
      'audio/flac',
      'audio/m4a',
    ];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only audio files are allowed.');
      return;
    }

    // Check file size (100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 100MB.');
      return;
    }

    setSelectedFile(file);
    extractMetadata(file);
  };

  const extractMetadata = async (file: File) => {
    setIsExtractingMetadata(true);
    try {
      // Extract audio duration
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.addEventListener('loadedmetadata', () => {
          resolve(Math.floor(audio.duration));
          URL.revokeObjectURL(audio.src);
        });
        audio.addEventListener('error', () => {
          resolve(0);
          URL.revokeObjectURL(audio.src);
        });
      });

      // Force extract embedded metadata using music-metadata library
      let extractedMetadata: TrackMetadata = {
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: '',
        year: new Date().getFullYear(),
        duration,
        description: 'Uploaded via P2P Music Platform',
      };

      try {
        // Use parseBlob for browser compatibility
        const blob = new Blob([file], { type: file.type });
        const metadata = await parseBlob(blob);
        
        // Extract title from embedded metadata
        if (metadata.common && metadata.common.title) {
          extractedMetadata.title = metadata.common.title;
        }
        
        // Extract artist from embedded metadata
        if (metadata.common && metadata.common.artist) {
          extractedMetadata.artist = metadata.common.artist;
        } else if (metadata.common && metadata.common.artists && metadata.common.artists.length > 0) {
          extractedMetadata.artist = metadata.common.artists.join(', ');
        }
        
        // Extract album from embedded metadata
        if (metadata.common && metadata.common.album) {
          extractedMetadata.album = metadata.common.album;
        }
        
        // Extract genre from embedded metadata
        if (metadata.common && metadata.common.genre && metadata.common.genre.length > 0) {
          extractedMetadata.genre = metadata.common.genre[0];
        }
        
        // Extract year from embedded metadata
        if (metadata.common && metadata.common.year) {
          extractedMetadata.year = metadata.common.year;
        }
        
        // Extract cover art from embedded metadata
        if (metadata.common && metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          const mimeType = picture.format || 'image/jpeg';
          // Use browser-compatible base64 conversion
          const binaryString = picture.data.reduce((acc: string, byte: number) => acc + String.fromCharCode(byte), '');
          const base64 = btoa(binaryString);
          const dataUrl = `data:${mimeType};base64,${base64}`;
          extractedMetadata.coverArtUrl = dataUrl;
          extractedMetadata.coverArtData = base64;
        }
        
        console.log('Embedded metadata extracted successfully:', {
          title: extractedMetadata.title,
          artist: extractedMetadata.artist,
          album: extractedMetadata.album,
          hasCoverArt: !!extractedMetadata.coverArtUrl
        });
      } catch (metadataError) {
        console.warn('Could not extract embedded metadata, using defaults:', metadataError);
      }

      setMetadata(extractedMetadata);
    } catch (err) {
      console.error('Metadata extraction error:', err);
      setError('Failed to extract metadata');
    } finally {
      setIsExtractingMetadata(false);
    }
  };

  const handleUpdateMetadata = (field: keyof TrackMetadata, value: string | number) => {
    if (metadata) {
      setMetadata(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleConfirmMetadata = async () => {
    if (!selectedFile || !metadata) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Initialize upload with backend
      const initResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        throw new Error(error.error || 'Failed to initialize upload');
      }

      // Step 2: Upload to unified storage system
      const storageOptions: StorageOptions = {
        onProgress: (progress) => {
          setUploadProgress(Math.min(80, Math.round(progress)));
        },
        cache: true,
      };

      const storageResult = await UnifiedStorage.uploadFile(
        selectedFile,
        metadata,
        {
          ...storageOptions,
          redundant: true, // Upload to multiple systems for redundancy
        }
      );

      setUploadProgress(90);

      // Step 3: Save to backend database
      const saveResponse = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          genre: metadata.genre,
          year: metadata.year,
          duration: metadata.duration,
          ipfsCid: storageResult.ipfsCid || null,
          magnetUri: storageResult.magnetUri || null,
          storageSystem: storageResult.system,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
          coverArtUrl: metadata.coverArtUrl || null,
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || 'Failed to save track');
      }

      setUploadProgress(100);

      if (onUploadComplete) {
        onUploadComplete({
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          genre: metadata.genre,
          year: metadata.year,
          duration: metadata.duration,
          storageResult,
        });
      }

      clearFile();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setMetadata(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <FileAudio className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            Drag and drop your audio file
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse (MP3, OGG, WAV, FLAC, M4A up to 100MB)
          </p>
          <p className="text-sm text-blue-600 mb-4">
            Automatic fallback system: IPFS → WebTorrent → Local Storage
          </p>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            ref={fileInputRef}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Select File
          </Button>
        </div>
      ) : isExtractingMetadata ? (
        <div className="border rounded-lg p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-lg font-medium mb-2">Extracting Metadata...</p>
          <p className="text-sm text-muted-foreground">
            Analyzing your audio file
          </p>
        </div>
      ) : metadata ? (
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileAudio className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium truncate max-w-[200px]">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!isUploading && (
              <button
                onClick={clearFile}
                className="p-1 hover:bg-secondary rounded"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Track Metadata
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Title
                </label>
                <Input
                  value={metadata.title}
                  onChange={(e) => handleUpdateMetadata('title', e.target.value)}
                  disabled={isUploading}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Artist
                </label>
                <Input
                  value={metadata.artist}
                  onChange={(e) => handleUpdateMetadata('artist', e.target.value)}
                  disabled={isUploading}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Album
                </label>
                <Input
                  value={metadata.album}
                  onChange={(e) => handleUpdateMetadata('album', e.target.value)}
                  disabled={isUploading}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Genre
                </label>
                <Input
                  value={metadata.genre}
                  onChange={(e) => handleUpdateMetadata('genre', e.target.value)}
                  disabled={isUploading}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Year
                </label>
                <Input
                  type="number"
                  value={metadata.year}
                  onChange={(e) => handleUpdateMetadata('year', parseInt(e.target.value) || new Date().getFullYear())}
                  disabled={isUploading}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <Textarea
                  value={metadata.description}
                  onChange={(e) => handleUpdateMetadata('description', e.target.value)}
                  disabled={isUploading}
                  className="w-full"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  Duration
                </label>
                <Input
                  value={`${Math.floor(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, '0')}`}
                  disabled
                  className="w-full bg-muted"
                />
              </div>

              {/* Cover Art Preview */}
              {metadata.coverArtUrl && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">
                    Cover Art
                  </label>
                  <div className="relative inline-block">
                    <img
                      src={metadata.coverArtUrl}
                      alt="Album cover"
                      className="w-32 h-32 rounded-lg object-cover border"
                    />
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                      <ImageIcon className="h-3 w-3" />
                    </div>
                  </div>
                  <p className="text-xs text-green-600 mt-1">✓ Embedded cover art detected</p>
                </div>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="mb-4">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {uploadProgress < 10 && 'Initializing...'}
                {uploadProgress >= 10 && uploadProgress < 80 && 'Uploading to decentralized storage...'}
                {uploadProgress >= 80 && uploadProgress < 90 && 'Verifying upload...'}
                {uploadProgress >= 90 && uploadProgress < 100 && 'Saving to database...'}
                {uploadProgress === 100 && 'Complete!'}
                {' '}{uploadProgress}%
              </p>
            </div>
          )}

          <Button
            onClick={handleConfirmMetadata}
            disabled={isUploading}
            className="w-full"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? 'Uploading...' : 'Confirm & Upload Track'}
          </Button>
        </div>
      ) : null}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default UploadComponent;
