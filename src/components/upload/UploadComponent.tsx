'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  FileAudio,
  X,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Disc3,
  Trash2,
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

interface BatchTrack {
  key: string;
  file: File;
  metadata: TrackMetadata;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  uploaded?: { trackId: string; title: string; streamUrl: string | null };
}

interface SharedMetadata {
  album: string;
  artist: string;
  genre: string;
  year: number;
  description: string;
}

type ReleaseMode = 'none' | 'existing' | 'new';

interface AlbumDraft {
  mode: ReleaseMode;
  existingId: string;
  title: string;
  artist: string;
  genre: string;
  releaseDate: string;
}

interface UploadSuccess {
  uploaded: Array<{ trackId: string; title: string }>;
  failed: Array<{ title: string; error: string }>;
  albumTitle: string | null;
  albumId: string | null;
}

const MAX_AUDIO_SIZE = 100 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;
const MAX_BATCH_SIZE = 30;
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

function createTrackKey(index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `track-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
}

const emptyAlbumDraft: AlbumDraft = {
  mode: 'none',
  existingId: '',
  title: '',
  artist: '',
  genre: '',
  releaseDate: '',
};

export const UploadComponent: React.FC<UploadComponentProps> = ({ onUploadComplete }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tracks, setTracks] = useState<BatchTrack[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isExtractingMetadata, setIsExtractingMetadata] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UploadSuccess | null>(null);
  const [albums, setAlbums] = useState<Array<{ id: string; title: string; artist?: string | null }>>([]);
  const [shared, setShared] = useState<SharedMetadata>({
    album: '',
    artist: '',
    genre: '',
    year: new Date().getFullYear(),
    description: '',
  });
  const [albumDraft, setAlbumDraft] = useState<AlbumDraft>(emptyAlbumDraft);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/albums', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setAlbums(data?.albums || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const isBatch = tracks.length > 1;

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
    void addFiles(Array.from(event.dataTransfer.files || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files || []));
    event.target.value = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extractFileMetadata = async (file: File): Promise<TrackMetadata> => {
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
    return extracted;
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError(null);
    setSuccess(null);

    const accepted: File[] = [];
    const problems: string[] = [];
    for (const file of files) {
      if (!isSupportedAudio(file)) {
        problems.push(`${file.name}: unsupported audio format`);
      } else if (file.size > MAX_AUDIO_SIZE) {
        problems.push(`${file.name}: larger than 100MB`);
      } else {
        accepted.push(file);
      }
    }

    const remaining = MAX_BATCH_SIZE - tracks.length;
    if (remaining <= 0) {
      setError(`You can upload up to ${MAX_BATCH_SIZE} files at a time.`);
      return;
    }
    if (accepted.length > remaining) {
      problems.push(`Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added to this batch`);
      accepted.length = remaining;
    }
    if (accepted.length === 0) {
      setError(problems[0] || 'No supported audio files found.');
      return;
    }

    setIsExtractingMetadata(true);
    try {
      const extracted = await Promise.all(accepted.map((file) => extractFileMetadata(file)));
      const newTracks: BatchTrack[] = extracted.map((metadata, index) => ({
        key: createTrackKey(index),
        file: accepted[index],
        metadata,
        status: 'pending',
        progress: 0,
      }));
      setTracks((current) => [...current, ...newTracks]);
      setShared((current) => {
        const first = extracted[0];
        return {
          album: current.album || (newTracks.length > 1 ? first.album : current.album),
          artist:
            current.artist ||
            (first.artist !== 'Unknown Artist' ? first.artist : current.artist),
          genre: current.genre || first.genre,
          year: current.year || first.year,
          description: current.description || first.description,
        };
      });
      if (problems.length > 0) setError(problems.slice(0, 3).join(' · '));
    } catch {
      setError('Failed to read the selected audio files.');
    } finally {
      setIsExtractingMetadata(false);
    }
  };

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
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

  const updateTrack = (key: string, patch: Partial<BatchTrack>) => {
    setTracks((current) =>
      current.map((track) => (track.key === key ? { ...track, ...patch } : track))
    );
  };

  const updateTrackMetadata = (key: string, field: keyof TrackMetadata, value: string | number) => {
    setTracks((current) =>
      current.map((track) =>
        track.key === key
          ? { ...track, metadata: { ...track.metadata, [field]: value } }
          : track
      )
    );
  };

  const updateShared = (field: keyof SharedMetadata, value: string | number) => {
    setShared((current) => ({ ...current, [field]: value }));
  };

  const uploadCoverBlob = async (token: string, blob: Blob, filename: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('fileType', 'coverArt');
    const response = await postFormData('/api/storage', formData, token);
    if (!response.ok || !response.data?.url) {
      throw new Error(response.data?.error || 'Cover art upload failed');
    }
    return response.data.url as string;
  };

  const getEmbeddedCoverBlob = (metadata: TrackMetadata): Blob | null => {
    if (!metadata.coverArtData) return null;
    return base64ToBlob(
      metadata.coverArtData,
      normalizeImageMimeType(metadata.coverArtMimeType || 'image/jpeg')
    );
  };

  const resolveAlbum = async (
    token: string,
    albumCoverUrl: string | null
  ): Promise<{ id: string | null; title: string | null }> => {
    if (albumDraft.mode === 'existing') {
      const album = albums.find((item) => item.id === albumDraft.existingId);
      if (!album) throw new Error('Please choose a release.');
      return { id: album.id, title: album.title };
    }
    if (albumDraft.mode !== 'new') return { id: null, title: null };
    if (!albumDraft.title.trim()) throw new Error('Enter a name for the new release.');

    const body = {
      title: albumDraft.title.trim(),
      artist: albumDraft.artist.trim() || shared.artist.trim() || undefined,
      genre: albumDraft.genre.trim() || shared.genre.trim() || undefined,
      releaseDate: albumDraft.releaseDate || undefined,
      coverArtUrl: albumCoverUrl || undefined,
    };
    const response = await fetch('/api/albums', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || !data.album?.id) {
      throw new Error(data.error || 'Unable to create the release');
    }
    return { id: data.album.id, title: data.album.title };
  };

  const buildTrackFormData = (
    item: BatchTrack,
    albumId: string | null,
    coverArtUrl: string | null
  ): FormData => {
    const metadata = item.metadata;
    const sharedAlbumName =
      albumDraft.mode === 'existing'
        ? albums.find((album) => album.id === albumDraft.existingId)?.title || shared.album
        : albumDraft.mode === 'new'
          ? albumDraft.title.trim()
          : shared.album;

    const formData = new FormData();
    formData.append('file', item.file);
    formData.append('title', metadata.title.trim());
    formData.append('artist', (isBatch ? shared.artist : metadata.artist).trim() || 'Unknown Artist');
    formData.append('album', (isBatch ? sharedAlbumName : metadata.album).trim() || 'Unknown Album');
    formData.append('genre', (isBatch ? shared.genre : metadata.genre).trim());
    formData.append('year', String(isBatch ? shared.year : metadata.year));
    formData.append('duration', String(metadata.duration));
    formData.append(
      'description',
      (isBatch ? shared.description : metadata.description).trim()
    );
    if (albumId) formData.append('albumId', albumId);
    if (coverArtUrl) formData.append('coverArtUrl', coverArtUrl);
    return formData;
  };

  const uploadAll = async () => {
    if (tracks.length === 0) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please sign in again before uploading.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // One shared cover for the whole release; otherwise each embedded cover is
      // uploaded alongside its own track.
      let albumCoverUrl: string | null = null;
      if (coverFile) {
        albumCoverUrl = await uploadCoverBlob(token, coverFile, coverFile.name);
      }

      const album = await resolveAlbum(token, albumCoverUrl);
      const uploaded: UploadSuccess['uploaded'] = [];
      const failed: UploadSuccess['failed'] = [];

      for (let index = 0; index < tracks.length; index += 1) {
        const item = tracks[index];
        updateTrack(item.key, { status: 'uploading', progress: 0, error: undefined });
        try {
          let coverArtUrl = albumCoverUrl;
          if (!coverArtUrl && !coverFile) {
            const embedded = getEmbeddedCoverBlob(item.metadata);
            if (embedded) {
              coverArtUrl = await uploadCoverBlob(token, embedded, 'embedded-cover.jpg');
            }
          }

          const formData = buildTrackFormData(item, album.id, coverArtUrl);
          const response = await postFormData('/api/tracks', formData, token, (percent) => {
            updateTrack(item.key, { progress: percent });
            setUploadProgress(
              Math.round(((index + percent / 100) / tracks.length) * 100)
            );
          });
          if (!response.ok || !response.data?.track) {
            throw new Error(response.data?.error || 'Failed to upload track');
          }

          const track = response.data.track;
          const metadataUsed = item.metadata;
          updateTrack(item.key, {
            status: 'done',
            progress: 100,
            uploaded: { trackId: track.id, title: track.title, streamUrl: track.streamUrl || null },
          });
          uploaded.push({ trackId: track.id, title: track.title });
          setUploadProgress(Math.round(((index + 1) / tracks.length) * 100));

          const storageResult: StorageResult = {
            fileId: track.id,
            url: track.streamUrl || '',
            storageType: track.storageType,
            size: track.fileSize,
            mimeType: track.mimeType,
            instantReady: Boolean(track.instantReady),
            ipfsCid: track.ipfsCid,
          };
          onUploadComplete?.({
            title: metadataUsed.title.trim(),
            artist: (isBatch ? shared.artist : metadataUsed.artist).trim() || 'Unknown Artist',
            album: (isBatch ? album.title || shared.album : metadataUsed.album).trim() || 'Unknown Album',
            genre: (isBatch ? shared.genre : metadataUsed.genre).trim(),
            year: isBatch ? shared.year : metadataUsed.year,
            duration: metadataUsed.duration,
            description: (isBatch ? shared.description : metadataUsed.description).trim(),
            trackId: track.id,
            streamUrl: track.streamUrl || null,
            storageResult,
          });
        } catch (trackError) {
          const message =
            trackError instanceof Error ? trackError.message : 'Upload failed';
          updateTrack(item.key, { status: 'error', progress: 0, error: message });
          failed.push({ title: item.metadata.title, error: message });
        }
      }

      setSuccess({
        uploaded,
        failed,
        albumTitle: album.title,
        albumId: album.id,
      });
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const resetSelection = () => {
    setTracks([]);
    setShared({ album: '', artist: '', genre: '', year: new Date().getFullYear(), description: '' });
    setAlbumDraft(emptyAlbumDraft);
    setCoverFile(null);
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    setCoverPreview(null);
    setError(null);
    setUploadProgress(0);
  };

  if (success) {
    return (
      <div className="w-full max-w-2xl mx-auto border rounded-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {success.uploaded.length} track{success.uploaded.length === 1 ? '' : 's'} uploaded
        </h3>
        {success.albumTitle && (
          <p className="text-sm text-muted-foreground mb-4">
            Added to release{' '}
            {success.albumId ? (
              <Link href={`/albums/${success.albumId}`} className="text-primary hover:underline">
                {success.albumTitle}
              </Link>
            ) : (
              success.albumTitle
            )}
          </p>
        )}
        {success.uploaded.length > 0 && (
          <ul className="mb-4 space-y-1 text-left">
            {success.uploaded.map((item) => (
              <li key={item.trackId} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                <Link href={`/post/${item.trackId}`} className="truncate hover:text-primary hover:underline">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {success.failed.length > 0 && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left">
            <p className="mb-1 flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {success.failed.length} track{success.failed.length === 1 ? '' : 's'} failed
            </p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {success.failed.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  {item.title}: {item.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setSuccess(null);
            resetSelection();
          }}
        >
          Upload More
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {tracks.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <FileAudio className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Drag and drop your audio files</p>
          <p className="text-sm text-muted-foreground mb-4">
            Select multiple files to upload an album in one batch (MP3, OGG, WAV, FLAC, M4A, MP4, AAC up to 100MB each)
          </p>
          <p className="text-sm text-blue-600 mb-4">
            Stored securely on the server and playable immediately; IPFS is optional.
          </p>
          <input
            type="file"
            accept={[...ALLOWED_AUDIO_TYPES, ...ALLOWED_AUDIO_EXTENSIONS].join(',')}
            onChange={handleFileSelect}
            multiple
            className="hidden"
            id="file-upload"
            ref={fileInputRef}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Select Files
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">Up to {MAX_BATCH_SIZE} files per batch</p>
        </div>
      ) : isExtractingMetadata ? (
        <div className="border rounded-lg p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-4" />
          <p className="text-lg font-medium mb-2">Reading track metadata...</p>
          <p className="text-sm text-muted-foreground">Analyzing your audio files</p>
        </div>
      ) : (
        <div className="border rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                {isBatch ? `${tracks.length} tracks selected` : 'Track ready'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isBatch ? 'Album upload · files are uploaded in order' : 'Review the details below'}
              </p>
            </div>
            {!isUploading && (
              <Button variant="ghost" size="sm" onClick={resetSelection} aria-label="Clear selection">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {isBatch && (
            <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Disc3 className="h-4 w-4 text-primary" />
                Album settings (applied to every track)
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Release</label>
                <select
                  value={albumDraft.mode}
                  onChange={(event) => {
                    const mode = event.target.value as ReleaseMode;
                    setAlbumDraft((current) => ({ ...current, mode }));
                    if (mode === 'existing') {
                      const first = albums[0];
                      setAlbumDraft((current) => ({
                        ...current,
                        mode,
                        existingId: first?.id || '',
                      }));
                      if (first) updateShared('album', first.title);
                    }
                  }}
                  disabled={isUploading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="none">No release</option>
                  <option value="existing">Add to an existing release</option>
                  <option value="new">Create a new release</option>
                </select>
              </div>
              {albumDraft.mode === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Choose release</label>
                  <select
                    value={albumDraft.existingId}
                    onChange={(event) => {
                      setAlbumDraft((current) => ({
                        ...current,
                        existingId: event.target.value,
                      }));
                      const album = albums.find((item) => item.id === event.target.value);
                      if (album) updateShared('album', album.title);
                    }}
                    disabled={isUploading || albums.length === 0}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  >
                    {albums.length === 0 ? (
                      <option value="">No releases yet</option>
                    ) : (
                      albums.map((album) => (
                        <option key={album.id} value={album.id}>{album.title}</option>
                      ))
                    )}
                  </select>
                  {albums.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Create one on the <Link href="/albums" className="text-primary hover:underline">Releases</Link> page, or choose “Create a new release”.
                    </p>
                  )}
                </div>
              )}
              {albumDraft.mode === 'new' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Album title"
                    value={albumDraft.title}
                    onChange={(event) =>
                      setAlbumDraft((current) => ({ ...current, title: event.target.value }))
                    }
                    disabled={isUploading}
                    maxLength={200}
                  />
                  <Input
                    placeholder="Album artist"
                    value={albumDraft.artist}
                    onChange={(event) =>
                      setAlbumDraft((current) => ({ ...current, artist: event.target.value }))
                    }
                    disabled={isUploading}
                  />
                  <Input
                    placeholder="Genre"
                    value={albumDraft.genre}
                    onChange={(event) =>
                      setAlbumDraft((current) => ({ ...current, genre: event.target.value }))
                    }
                    disabled={isUploading}
                  />
                  <Input
                    type="date"
                    value={albumDraft.releaseDate}
                    onChange={(event) =>
                      setAlbumDraft((current) => ({ ...current, releaseDate: event.target.value }))
                    }
                    disabled={isUploading}
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Artist</label>
                  <Input
                    value={shared.artist}
                    onChange={(event) => updateShared('artist', event.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Genre</label>
                  <Input
                    value={shared.genre}
                    onChange={(event) => updateShared('genre', event.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Year</label>
                  <Input
                    type="number"
                    value={shared.year}
                    onChange={(event) => updateShared('year', parseInt(event.target.value, 10) || new Date().getFullYear())}
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Album name</label>
                  <Input
                    value={shared.album}
                    onChange={(event) => updateShared('album', event.target.value)}
                    disabled={isUploading || albumDraft.mode !== 'none'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                <Textarea
                  value={shared.description}
                  onChange={(event) => updateShared('description', event.target.value)}
                  disabled={isUploading}
                  rows={2}
                  maxLength={1000}
                />
              </div>
            </div>
          )}

          {!isBatch && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
                <Input
                  value={tracks[0].metadata.title}
                  onChange={(event) => updateTrackMetadata(tracks[0].key, 'title', event.target.value)}
                  disabled={isUploading}
                  maxLength={200}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Artist</label>
                  <Input
                    value={tracks[0].metadata.artist}
                    onChange={(event) => updateTrackMetadata(tracks[0].key, 'artist', event.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Album</label>
                  <Input
                    value={tracks[0].metadata.album}
                    onChange={(event) => updateTrackMetadata(tracks[0].key, 'album', event.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Genre</label>
                  <Input
                    value={tracks[0].metadata.genre}
                    onChange={(event) => updateTrackMetadata(tracks[0].key, 'genre', event.target.value)}
                    disabled={isUploading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Year</label>
                  <Input
                    type="number"
                    value={tracks[0].metadata.year}
                    onChange={(event) =>
                      updateTrackMetadata(
                        tracks[0].key,
                        'year',
                        parseInt(event.target.value, 10) || new Date().getFullYear()
                      )
                    }
                    disabled={isUploading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Add to release (optional)</label>
                <select
                  value={albumDraft.mode === 'existing' ? albumDraft.existingId : ''}
                  onChange={(event) => {
                    const albumId = event.target.value;
                    setAlbumDraft((current) => ({ ...current, mode: albumId ? 'existing' : 'none', existingId: albumId }));
                    const album = albums.find((item) => item.id === albumId);
                    if (album) updateTrackMetadata(tracks[0].key, 'album', album.title);
                  }}
                  disabled={isUploading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">No release</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>{album.title}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create releases on the <Link href="/albums" className="text-primary hover:underline">Releases</Link> page.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                <Textarea
                  value={tracks[0].metadata.description}
                  onChange={(event) => updateTrackMetadata(tracks[0].key, 'description', event.target.value)}
                  disabled={isUploading}
                  rows={3}
                  maxLength={1000}
                  placeholder="Tell listeners about this track"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Cover art {isBatch ? 'for the whole release' : '(optional)'}
            </label>
            <div className="flex items-center gap-3">
              {(coverPreview || (!isBatch && tracks[0].metadata.coverArtUrl)) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreview || (!isBatch ? tracks[0].metadata.coverArtUrl : undefined)}
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
                {coverPreview ? 'Replace' : 'Choose image'}
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

          <div>
            <h3 className="mb-2 text-sm font-semibold">
              {isBatch ? 'Tracks' : 'File'}
            </h3>
            <div className="space-y-2">
              {tracks.map((item, index) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-lg border border-border/60 p-2"
                >
                  <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Input
                      value={item.metadata.title}
                      onChange={(event) => updateTrackMetadata(item.key, 'title', event.target.value)}
                      disabled={isUploading}
                      className="h-8"
                      maxLength={200}
                      aria-label={`Title for track ${index + 1}`}
                    />
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{item.file.name}</span>
                      <span>·</span>
                      <span>{(item.file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>·</span>
                      <span>
                        {Math.floor(item.metadata.duration / 60)}:
                        {(item.metadata.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    {item.status === 'uploading' && (
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded
                      </p>
                    )}
                    {item.status === 'error' && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" /> {item.error}
                      </p>
                    )}
                  </div>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() =>
                        setTracks((current) => current.filter((track) => track.key !== item.key))
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Add more files
              </Button>
            )}
          </div>

          {isUploading && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Uploading {uploadProgress}% · please keep this page open
              </p>
            </div>
          )}

          <Button
            onClick={() => void uploadAll()}
            disabled={
              isUploading ||
              tracks.length === 0 ||
              tracks.every((item) => !item.metadata.title.trim()) ||
              (albumDraft.mode === 'new' && !albumDraft.title.trim()) ||
              (albumDraft.mode === 'existing' && !albumDraft.existingId)
            }
            className="w-full"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading
              ? 'Uploading…'
              : `Confirm & Upload ${isBatch ? `${tracks.length} Tracks` : 'Track'}`}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default UploadComponent;
