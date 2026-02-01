/**
 * Type declarations for WebTorrent
 * Since @types/webtorrent is not available, we define our own types
 */

declare module 'webtorrent' {
  import { EventEmitter } from 'events';

  export interface TorrentFile {
    name: string;
    path: string;
    length: number;
    offset: number;
    done: boolean;
    createReadStream(opts?: { start?: number; end?: number }): NodeJS.ReadableStream;
    getBlob(callback: (err: Error | null, blob: Blob | null) => void): void;
    getBlobURL(callback: (err: Error | null, url: string | null) => void): void;
    appendTo(element: HTMLElement | string, opts?: object, callback?: (err: Error | null, element: HTMLElement) => void): void;
    renderTo(element: HTMLElement | string, opts?: object, callback?: (err: Error | null, element: HTMLElement) => void): void;
  }

  export interface Torrent {
    infoHash: string;
    magnetURI: string;
    files: TorrentFile[];
    numPeers: number;
    progress: number;
    done: boolean;
    downloadSpeed: number;
    uploadSpeed: number;
    timeRemaining: number;
    received: number;
    downloaded: number;
    uploaded: number;
    length: number;
    pieceLength: number;
    lastPieceLength: number;
    pieces: Array<{
      length: number;
      missing: boolean;
    }>;

    on(event: 'download', listener: (bytes: number) => void): this;
    on(event: 'upload', listener: (bytes: number) => void): this;
    on(event: 'wire', listener: (wire: unknown) => void): this;
    on(event: 'done', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;

    once(event: 'download', listener: (bytes: number) => void): this;
    once(event: 'upload', listener: (bytes: number) => void): this;
    once(event: 'wire', listener: (wire: unknown) => void): this;
    once(event: 'done', listener: () => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;

    pause(): void;
    resume(): void;
    destroy(opts?: { destroyStore?: boolean }): void;
  }

  export interface SeedOptions {
    name?: string;
    announce?: string[];
    comment?: string;
    createdBy?: string;
    creationDate?: Date;
    private?: boolean;
    pieceLength?: number;
  }

  export interface AddOptions {
    announce?: string[];
    maxWebConns?: number;
    path?: string;
    store?: unknown;
    destroyStoreOnDestroy?: boolean;
    storeCacheSlots?: number;
    skipVerify?: boolean;
    private?: boolean;
    strategy?: 'sequential' | 'rarest';
    sequential?: boolean;
  }

  export interface ClientOptions {
    dht?: boolean | object;
    tracker?: boolean | {
      ws?: boolean;
      rtcConfig?: RTCConfiguration;
    };
    webSeeds?: boolean;
    maxConns?: number;
  }

  export interface WebTorrentInstance extends EventEmitter {
    torrents: Torrent[];

    add(torrentId: string | Buffer | File | FileList, opts?: AddOptions, callback?: (torrent: Torrent) => void): Torrent;
    add(torrentId: string | Buffer | File | FileList, callback?: (torrent: Torrent) => void): Torrent;

    seed(input: File | FileList | File[], opts?: SeedOptions, callback?: (torrent: Torrent) => void): Torrent;
    seed(input: File | FileList | File[], callback?: (torrent: Torrent) => void): Torrent;

    remove(torrentId: string | Torrent, opts?: { destroyStore?: boolean }, callback?: (err: Error | null) => void): void;
    remove(torrentId: string | Torrent, callback?: (err: Error | null) => void): void;

    get(torrentId: string): Torrent | null;

    destroy(callback?: (err: Error | null) => void): void;

    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'torrent', listener: (torrent: Torrent) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  class WebTorrent extends EventEmitter implements WebTorrentInstance {
    torrents: Torrent[];

    constructor(opts?: ClientOptions);

    add(torrentId: string | Buffer | File | FileList, opts?: AddOptions, callback?: (torrent: Torrent) => void): Torrent;
    add(torrentId: string | Buffer | File | FileList, callback?: (torrent: Torrent) => void): Torrent;

    seed(input: File | FileList | File[], opts?: SeedOptions, callback?: (torrent: Torrent) => void): Torrent;
    seed(input: File | FileList | File[], callback?: (torrent: Torrent) => void): Torrent;

    remove(torrentId: string | Torrent, opts?: { destroyStore?: boolean }, callback?: (err: Error | null) => void): void;
    remove(torrentId: string | Torrent, callback?: (err: Error | null) => void): void;

    get(torrentId: string): Torrent | null;

    destroy(callback?: (err: Error | null) => void): void;

    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'torrent', listener: (torrent: Torrent) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export default WebTorrent;
  export { WebTorrent };
}
