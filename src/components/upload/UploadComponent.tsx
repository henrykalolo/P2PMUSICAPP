'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  FileAudio,
  X,
  Loader2,
  Edit3,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import { parseBlob } from 'music-metadata';

export interface StorageResult {
  fileId: string;
  url: string;
  storageType: string;
  size: number;
  mimeType: string;
  instantReady: boolean;
  ipfsCid?: string | null;
}

interface UploadCompletePayload {
  title: string;
  artist: string;
  album: string;
  genre: string;
  year: number;
  duration: number;
  description: string;
  trackId: string;
  streamUrl: string | null;
  storageResult: StorageResult;
}

interface UploadComponentProps {
  onUploadComplete?: (metadata: UploadCompletePayload) => void;
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
  coverArtData?: string;
  coverArtMimeType?: string;
}

interface UploadSuccess {
  trackId: string;
  title: string;
  streamUrl: string | null;
}

const MAX_AUDIO_SIZE = 100 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/flac',
  'audio/x-flac',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
];
const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.oga', '.wav', '.flac', '.m4a', '.mp4', '.aac'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function isSupportedAudio(file: File): boolean {
  const extension = file.name.includes('.')
    ? `.${file.name.split('.').pop()?.toLowerCase()}`
    : '';
  return (
    ALLOWED_AUDIO_TYPES.includes(file.type) ||
    (file.type.startsWith('audio/') && ALLOWED_AUDIO_EXTENSIONS.includes(extension))
  );
}

interface FormResponse {
  ok: boolean;
  status: number;
  data: any;
}

function postFormData(
  url: string,
  formData: FormData,
  token: string,
  onProgress?: (percent: number) => void
): Promise<FormResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 90));
        }
      };
    }

    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error('Network error. Please try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    xhr.send(formData);
  });
}

function normalizeImageMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') return 'image/jpeg';
  return ALLOWED_IMAGE_TYPES.includes(normalized) ? normalized : 'image/jpeg';
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export const UploadComponent: React.FC<UploadComponentProps> = ({ onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [success, setSuccess] = useState<UploadSuccess | null>(null);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) validateAndSetFile(file);
  }, []);

  const validateAndSetFile = (file: File) => {
    setError(null);
    setSuccess(null);

    if (!isSupportedAudio(file)) {
      setError('Unsupported audio format. Use MP3, OGG, WAV, FLAC, M4A, MP4, or AAC.');
      return;
    }
    if (file.size > MAX_AUDIO_SIZE) {
      setError('File too large. Maximum size is 100MB.');
      return;
    }

    setSelectedFile(file);
    extractMetadata(file);
  };

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Cover art must be a JPG, PNG, GIF, or WebP image.');
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError('Cover art must be 5MB or smaller.');
      return;
    }
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setError(null);
  };

  const extractMetadata = async (file: File) => {
    setIsExtractingMetadata(true);
    try {
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        const objectUrl = URL.createObjectURL(file);
        audio.preload = 'metadata';
        audio.src = objectUrl;
        audio.addEventListener('loadedmetadata', () => {
          resolve(Number.isFinite(audio.duration) ? Math.floor(audio.duration) : 0);
          URL.revokeObjectURL(objectUrl);
        });
        audio.addEventListener('error', () => {
          resolve(0);
          URL.revokeObjectURL(objectUrl);
        });
      });

      const extracted: TrackMetadata = {
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: '',
        year: new Date().getFullYear(),
        duration,
        description: '',
      };

      try {
        const info = await parseBlob(new Blob([file], { type: file.type }));
        if (info.common.title) extracted.title = info.common.title;
        if (info.common.artist) extracted.artist = info.common.artist;
        else if (info.common.artists?.length) extracted.artist = info.common.artists.join(', ');
        if (info.common.album) extracted.album = info.common.album;
        if (info.common.genre?.length) extracted.genre = info.common.genre[0];
        if (info.common.year) extracted.year = info.common.year;
        if (info.common.comment?.length) extracted.description = info.common.comment[0].text || '';

        const picture = info.common.picture?.[0];
        if (picture) {
          let binary = '';
          for (const byte of picture.data) binary += String.fromCharCode(byte);
          extracted.coverArtData = btoa(binary);
          extracted.coverArtMimeType = normalizeImageMimeType(picture.format || 'image/jpeg');
          extracted.coverArtUrl = `data:${extracted.coverArtMimeType};base64,${extracted.coverArtData}`;
        }
      } catch {
        // Embedded metadata is optional; editable defaults are already set.
      }

      setMetadata(extracted);
    } catch {
      setError('Failed to read this audio file');
    } finally {
      setIsExtractingMetadata(false);
    }
  };

  const handleUpdateMetadata = (
    field: keyof TrackMetadata,
    value: string | number
  ) => {
    setMetadata((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const uploadCoverArt = async (token: string, required: boolean): Promise<string | null> => {
    const embeddedBlob =
      !coverFile && metadata?.coverArtData
        ? base64ToBlob(
            metadata.coverArtData,
            normalizeImageMimeType(metadata.coverArtMimeType || 'image/jpeg')
          )
        : null;
    const blob = coverFile || embeddedBlob;
    if (!blob) return null;

    const formData = new FormData();
    formData.append('file', blob, coverFile?.name || 'embedded-cover.jpg');
    formData.append('fileType', 'coverArt');

    const response = await postFormData('/api/storage', formData, token);
    if (response.ok && response.data?.url) return response.data.url as string;

    if (required) {
      throw new Error(response.data?.error || 'Cover art upload failed');
    }
    return null;
  };

  const handleConfirmMetadata = async () => {
    if (!selectedFile || !metadata) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please sign in again before uploading.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const displayCoverUrl = coverPreview || metadata.coverArtUrl || null;
      const storedCoverUrl = await uploadCoverArt(token, Boolean(coverFile));
      setUploadProgress(12);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', metadata.title.trim());
      formData.append('artist', metadata.artist.trim() || 'Unknown Artist');
      formData.append('album', metadata.album.trim() || 'Unknown Album');
      formData.append('genre', metadata.genre.trim());
      formData.append('year', String(metadata.year));
      formData.append('duration', String(metadata.duration));
      formData.append('description', metadata.description.trim());
      if (storedCoverUrl || displayCoverUrl) {
        formData.append('coverArtUrl', storedCoverUrl || displayCoverUrl!);
      }

      const response = await postFormData('/api/tracks', formData, token, (percent) => {
        setUploadProgress(Math.min(90, 12 + percent));
      });
      if (!response.ok || !response.data?.track) {
        throw new Error(response.data?.error || 'Failed to upload track');
      }

      setUploadProgress(100);
      const track = response.data.track;
      const storageResult: StorageResult = {
        fileId: track.id,
        url: track.streamUrl || '',
        storageType: track.storageType,
        size: track.fileSize,
        mimeType: track.mimeType,
        instantReady: Boolean(track.instantReady),
        ipfsCid: track.ipfsCid,
      };

      setSuccess({
        trackId: track.id,
        title: track.title,
        streamUrl: track.streamUrl || null,
      });

      onUploadComplete?.({
        title: metadata.title.trim(),
        artist: metadata.artist.trim() || 'Unknown Artist',
        album: metadata.album.trim() || 'Unknown Album',
        genre: metadata.genre.trim(),
        year: metadata.year,
        duration: metadata.duration,
        description: metadata.description.trim(),
        trackId: track.id,
        streamUrl: track.streamUrl || null,
        storageResult,
      });

      resetSelection();
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setMetadata(null);
    setCoverFile(null);
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    setError(null);
    setUploadProgress(0);
  };

  const startAnother = () => {
    setSuccess(null);
    resetSelection();
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto border rounded-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Track uploaded</h3>
        <p className="text-sm text-muted-foreground mb-6 break-words">
          {success.title} is encrypted at rest and ready to play.
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/post/${success.trackId}`}>
            <Button className="w-full">View Track</Button>
          </Link>
          <Button variant="outline" className="w-full" onClick={startAnother}>
            Upload Another
          </Button>
        </div>
      </div>
    );
  }

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
          <p className="text-lg font-medium mb-2">Drag and drop your audio file</p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse (MP3, OGG, WAV, FLAC, M4A, MP4, AAC up to 100MB)
          </p>
          <p className="text-sm text-blue-600 mb-4">
            Stored securely on the server and playable immediately; IPFS is optional.
          </p>
          <input
            type="file"
            accept={[...ALLOWED_AUDIO_TYPES, ...ALLOWED_AUDIO_EXTENSIONS].join(',')}
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            ref={fileInputRef}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Select File
          </Button>
        </div>
      ) : isExtractingMetadata ? (
        <div className="border rounded-lg p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-lg font-medium mb-2">Reading track metadata...</p>
          <p className="text-sm text-muted-foreground">Analyzing your audio file</p>
        </div>
      ) : metadata ? (
        <div className="border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileAudio className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            {!isUploading && (
              <button onClick={resetSelection} className="p-1 hover:bg-secondary rounded" aria-label="Cancel upload">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
              <Input
                value={metadata.title}
                onChange={(e) => handleUpdateMetadata('title', e.target.value)}
                disabled={isUploading}
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Artist</label>
              <Input
                value={metadata.artist}
                onChange={(e) => handleUpdateMetadata('artist', e.target.value)}
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Album</label>
              <Input
                value={metadata.album}
                onChange={(e) => handleUpdateMetadata('album', e.target.value)}
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Genre</label>
              <Input
                value={metadata.genre}
                onChange={(e) => handleUpdateMetadata('genre', e.target.value)}
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Year</label>
              <Input
                type="number"
                value={metadata.year}
                onChange={(e) => handleUpdateMetadata('year', parseInt(e.target.value, 10) || new Date().getFullYear())}
                disabled={isUploading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
              <Textarea
                value={metadata.description}
                onChange={(e) => handleUpdateMetadata('description', e.target.value)}
                disabled={isUploading}
                rows={3}
                maxLength={1000}
                placeholder="Tell listeners about this track"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Duration</label>
              <Input
                value={`${Math.floor(metadata.duration / 60)}:${(metadata.duration % 60).toString().padStart(2, '0')}`}
                disabled
                className="bg-muted"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Cover art (optional)
              </label>
              <div className="flex items-center gap-3">
                {(coverPreview || metadata.coverArtUrl) && (
                  <img
                    src={coverPreview || metadata.coverArtUrl}
                    alt="Cover art preview"
                    className="h-16 w-16 rounded object-cover border"
                  />
                )}
                <input
                  type="file"
                  ref={coverInputRef}
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  onChange={handleCoverSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  {coverPreview || metadata.coverArtUrl ? 'Replace' : 'Choose image'}
                </Button>
                {coverPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => {
                      if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
                      setCoverFile(null);
                      setCoverPreview(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Embedded cover art is used automatically unless you choose an image.
              </p>
            </div>
          </div>

          {isUploading && (
            <div className="mt-6">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {uploadProgress < 12
                  ? 'Preparing cover art...'
                  : uploadProgress < 90
                    ? 'Encrypting and uploading audio...'
                    : uploadProgress < 100
                      ? 'Saving your track...'
                      : 'Complete!'}
                {' '}{uploadProgress}%
              </p>
            </div>
          )}

          <Button
            onClick={handleConfirmMetadata}
            disabled={isUploading || !metadata.title.trim()}
            className="w-full mt-6"
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
