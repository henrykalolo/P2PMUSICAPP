'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, X, Loader2 } from 'lucide-react';
import { initIPFS, isIPFSSupported, uploadBrowserFile, uploadTrackMetadata, IPFSUploadResult } from '@/lib/ipfs';

interface UploadComponentProps {
  onUploadComplete?: (metadata: {
    title: string;
    artist: string;
    album: string;
    genre: string;
    year: number;
    duration: number;
    ipfsCid: string;
    metadataCid: string;
  }) => void;
}

export const UploadComponent: React.FC<UploadComponentProps> = ({
  onUploadComplete,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isIPFSReady, setIsIPFSReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize IPFS on component mount
  useEffect(() => {
    const initializeIPFS = async () => {
      if (!isIPFSSupported()) {
        setError('IPFS is not supported in this browser. Please use a modern browser with WebRTC support.');
        setIsInitializing(false);
        return;
      }

      try {
        await initIPFS({ debug: true });
        setIsIPFSReady(true);
      } catch (err) {
        console.error('IPFS initialization error:', err);
        setError('Failed to initialize IPFS. Please try again.');
      } finally {
        setIsInitializing(false);
      }
    };

    initializeIPFS();
  }, []);

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
  };

  const clearFile = () => {
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (!selectedFile || !isIPFSReady) return;

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

      // Step 2: Upload audio file to IPFS
      setUploadProgress(10);
      
      const audioResult: IPFSUploadResult = await uploadBrowserFile(selectedFile, {
        onProgress: (progress) => {
          // Map IPFS upload progress (0-100) to our progress (10-70)
          const mappedProgress = 10 + (progress.percentage * 0.6);
          setUploadProgress(Math.min(70, Math.round(mappedProgress)));
        },
      });

      // Step 3: Extract metadata (duration would require audio analysis)
      // For now, use filename as title
      const title = selectedFile.name.replace(/\.[^/.]+$/, '');
      
      setUploadProgress(75);

      // Step 4: Upload metadata to IPFS
      const metadataResult = await uploadTrackMetadata({
        title,
        artist: 'Unknown Artist', // Would be extracted or provided by user
        album: 'Unknown Album',
        genre: '',
        year: new Date().getFullYear(),
        duration: 0, // Would be extracted from audio file
        audioCid: audioResult.cid,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'current-user', // Would come from auth context
      });

      setUploadProgress(90);

      // Step 5: Save to backend database
      const saveResponse = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          title,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          genre: '',
          year: new Date().getFullYear(),
          duration: 0,
          ipfsCid: audioResult.cid,
          metadataCid: metadataResult.cid,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
        }),
      });

      if (!saveResponse.ok) {
        const error = await saveResponse.json();
        throw new Error(error.error || 'Failed to save track');
      }

      setUploadProgress(100);

      if (onUploadComplete) {
        onUploadComplete({
          title,
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          genre: '',
          year: new Date().getFullYear(),
          duration: 0,
          ipfsCid: audioResult.cid,
          metadataCid: metadataResult.cid,
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

  if (isInitializing) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-muted-foreground mb-4 animate-spin" />
          <p className="text-lg font-medium">Initializing IPFS...</p>
          <p className="text-sm text-muted-foreground">Please wait while we set up the decentralized network</p>
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
          } ${!isIPFSReady ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <FileAudio className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            Drag and drop your audio file
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            or click to browse (MP3, OGG, WAV, FLAC, M4A up to 100MB)
          </p>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
            disabled={!isIPFSReady}
          />
          <label htmlFor="file-upload">
            <Button variant="outline" asChild disabled={!isIPFSReady}>
              <span>Select File</span>
            </Button>
          </label>
        </div>
      ) : (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
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
                {uploadProgress >= 10 && uploadProgress < 70 && 'Uploading to IPFS...'}
                {uploadProgress >= 70 && uploadProgress < 90 && 'Uploading metadata...'}
                {uploadProgress >= 90 && uploadProgress < 100 && 'Saving to database...'}
                {uploadProgress === 100 && 'Complete!'}
                {' '}{uploadProgress}%
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading || !isIPFSReady}
            className="w-full"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {isUploading ? 'Uploading to IPFS...' : 'Upload Track'}
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
