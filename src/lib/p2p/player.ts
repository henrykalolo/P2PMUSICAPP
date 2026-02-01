import WebTorrent from 'webtorrent';

export interface TorrentInfo {
  infoHash: string;
  magnetURI: string;
  numPeers: number;
  progress: number;
  done: boolean;
}

export class P2PAudioPlayer {
  private client: WebTorrent.Instance;
  private currentTorrent: WebTorrent.Torrent | null = null;

  constructor() {
    this.client = new WebTorrent({
      tracker: {
        ws: true,
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            {
              urls: process.env.TURN_SERVER || 'turn:turn.example.com:3478',
              username: process.env.TURN_USERNAME || 'user',
              credential: process.env.TURN_PASSWORD || 'pass'
            }
          ]
        }
      }
    });
  }

  /**
   * Streams audio with sequential piece selection
   * @param magnetURI - Magnet link for the torrent
   */
  async stream(magnetURI: string): Promise<{
    element: HTMLAudioElement;
    torrent: WebTorrent.Torrent;
    file: WebTorrent.TorrentFile;
  }> {
    return new Promise((resolve, reject) => {
      this.client.add(magnetURI, {
        sequential: true,
        strategy: 'rarest'
      }, (torrent) => {
        this.currentTorrent = torrent;

        const audioFile = torrent.files.find(f =>
          ['.mp3', '.ogg', '.m4a', '.flac'].some(ext =>
            f.name.toLowerCase().endsWith(ext)
          )
        );

        if (!audioFile) {
          reject(new Error('No audio file found in torrent'));
          return;
        }

        const audioElement = document.createElement('audio');
        audioElement.controls = true;

        audioFile.renderTo(audioElement, {
          autoplay: false,
          controls: true
        });

        resolve({
          element: audioElement,
          torrent,
          file: audioFile
        });
      });

      this.client.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get current torrent info
   */
  getTorrentInfo(): TorrentInfo | null {
    if (!this.currentTorrent) return null;

    return {
      infoHash: this.currentTorrent.infoHash,
      magnetURI: this.currentTorrent.magnetURI,
      numPeers: this.currentTorrent.numPeers,
      progress: this.currentTorrent.progress,
      done: this.currentTorrent.done
    };
  }

  /**
   * Destroy the client and cleanup
   */
  destroy(): void {
    this.client.destroy();
  }

  /**
   * Check if P2P is supported in the current browser
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'RTCPeerConnection' in window &&
      'WebSocket' in window &&
      'crypto' in window &&
      'subtle' in window.crypto
    );
  }
}

export default P2PAudioPlayer;
