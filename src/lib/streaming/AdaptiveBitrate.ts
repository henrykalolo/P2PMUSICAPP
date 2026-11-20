/**
 * Adaptive Bitrate Streaming for P2P Music Platform
 * DASH-style adaptive streaming based on network conditions
 */

export interface QualityLevel {
  bitrate: number;
  codec: string;
  label: string;
  sampleRate?: number;
}

export interface BandwidthEstimate {
  bandwidth: number; // bits per second
  confidence: number; // 0-1
  timestamp: number;
}

class BandwidthEstimator {
  private estimates: BandwidthEstimate[] = [];
  private maxSamples = 10;
  private currentEstimate = 0;

  /**
   * Add a new bandwidth sample
   */
  addSample(bytesTransferred: number, durationMs: number): void {
    if (durationMs === 0) return;

    const bitsPerSecond = (bytesTransferred * 8) / (durationMs / 1000);
    
    const estimate: BandwidthEstimate = {
      bandwidth: bitsPerSecond,
      confidence: Math.min(this.estimates.length / this.maxSamples, 1),
      timestamp: Date.now(),
    };

    this.estimates.push(estimate);
    
    // Keep only recent samples
    if (this.estimates.length > this.maxSamples) {
      this.estimates.shift();
    }

    // Update current estimate using exponential moving average
    if (this.currentEstimate === 0) {
      this.currentEstimate = bitsPerSecond;
    } else {
      const alpha = 0.3;
      this.currentEstimate = alpha * bitsPerSecond + (1 - alpha) * this.currentEstimate;
    }
  }

  /**
   * Get current bandwidth estimate
   */
  getEstimate(): number {
    // Return recent average if we have samples
    if (this.estimates.length === 0) {
      return this.currentEstimate || 1000000; // Default to 1 Mbps
    }

    // Use weighted average favoring recent samples
    const recentEstimates = this.estimates.slice(-5);
    const avg = recentEstimates.reduce((sum, e) => sum + e.bandwidth, 0) / recentEstimates.length;
    
    return avg;
  }

  /**
   * Get confidence level of current estimate
   */
  getConfidence(): number {
    if (this.estimates.length === 0) return 0;
    
    const latest = this.estimates[this.estimates.length - 1];
    return latest.confidence;
  }

  /**
   * Reset estimator
   */
  reset(): void {
    this.estimates = [];
    this.currentEstimate = 0;
  }
}

export class AdaptiveBitrateController {
  private qualityLevels: QualityLevel[] = [
    { bitrate: 64000, codec: 'opus', label: 'Low' },
    { bitrate: 128000, codec: 'opus', label: 'Standard' },
    { bitrate: 192000, codec: 'opus', label: 'High' },
    { bitrate: 256000, codec: 'opus', label: 'Very High' },
    { bitrate: 320000, codec: 'flac', label: 'Lossless' },
  ];

  private currentLevel = 1; // Default to Standard
  private bandwidthEstimator: BandwidthEstimator;
  private bufferHealth = 0; // seconds of buffered content
  private bufferTarget = 30; // Target buffer in seconds
  private switching = false;

  constructor() {
    this.bandwidthEstimator = new BandwidthEstimator();
  }

  /**
   * Select optimal quality based on current conditions
   */
  async selectOptimalQuality(): Promise<QualityLevel> {
    const estimatedBandwidth = this.bandwidthEstimator.getEstimate();
    const confidence = this.bandwidthEstimator.getConfidence();

    // If confidence is low, be conservative
    const effectiveBandwidth = confidence < 0.3 
      ? estimatedBandwidth * 0.5 
      : estimatedBandwidth;

    // Calculate target bitrate with headroom for network fluctuations
    const targetBitrate = effectiveBandwidth * 0.8;

    // Find highest quality that fits within bandwidth
    let selectedLevel = 0;
    for (let i = this.qualityLevels.length - 1; i >= 0; i--) {
      if (this.qualityLevels[i].bitrate <= targetBitrate) {
        selectedLevel = i;
        break;
      }
    }

    // Conservative approach if buffer is low
    if (this.bufferHealth < 10 && selectedLevel > 0) {
      selectedLevel--;
    }

    // Don't switch too rapidly (hysteresis)
    if (Math.abs(selectedLevel - this.currentLevel) <= 1) {
      this.currentLevel = selectedLevel;
    } else if (!this.switching) {
      this.switching = true;
      // Delayed switch to avoid oscillation
      setTimeout(() => {
        this.currentLevel = selectedLevel;
        this.switching = false;
      }, 2000);
    }

    return this.qualityLevels[this.currentLevel];
  }

  /**
   * Report bandwidth sample
   */
  reportBandwidth(bytesTransferred: number, durationMs: number): void {
    this.bandwidthEstimator.addSample(bytesTransferred, durationMs);
  }

  /**
   * Update buffer health
   */
  updateBufferHealth(currentBuffer: number): void {
    this.bufferHealth = currentBuffer;
  }

  /**
   * Get current quality level
   */
  getCurrentQuality(): QualityLevel {
    return this.qualityLevels[this.currentLevel];
  }

  /**
   * Get all available quality levels
   */
  getAvailableQualities(): QualityLevel[] {
    return [...this.qualityLevels];
  }

  /**
   * Manually set quality level
   */
  setQuality(index: number): void {
    if (index >= 0 && index < this.qualityLevels.length) {
      this.currentLevel = index;
    }
  }

  /**
   * Get current bandwidth estimate
   */
  getBandwidthEstimate(): number {
    return this.bandwidthEstimator.getEstimate();
  }

  /**
   * Force quality to lowest (for slow connections)
   */
  degradeQuality(): void {
    if (this.currentLevel > 0) {
      this.currentLevel--;
    }
  }

  /**
   * Try to upgrade quality
   */
  upgradeQuality(): void {
    if (this.currentLevel < this.qualityLevels.length - 1) {
      this.currentLevel++;
    }
  }

  /**
   * Reset controller state
   */
  reset(): void {
    this.currentLevel = 1;
    this.bufferHealth = 0;
    this.switching = false;
    this.bandwidthEstimator.reset();
  }
}

// Export singleton instance
export const adaptiveBitrate = new AdaptiveBitrateController();
