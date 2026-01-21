/**
 * PollingService
 * 
 * Manages real-time polling for intake session updates.
 * Implements exponential backoff on failure and connection status tracking.
 * 
 * Requirements: 8.1, 8.6
 */

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface PollingConfig {
  interval: number; // Polling interval in milliseconds (default: 3000ms)
  maxRetries: number; // Maximum number of consecutive failures before stopping (default: 5)
  backoffMultiplier: number; // Exponential backoff multiplier (default: 2)
  maxBackoffInterval: number; // Maximum backoff interval in milliseconds (default: 30000ms)
}

export interface PollingCallbacks {
  onPoll: () => Promise<void>; // Function to call on each poll
  onStatusChange: (status: ConnectionStatus) => void; // Called when connection status changes
  onError: (error: Error) => void; // Called when an error occurs
}

const DEFAULT_CONFIG: PollingConfig = {
  interval: 3000, // 3 seconds (Requirement 8.1)
  maxRetries: 5,
  backoffMultiplier: 2,
  maxBackoffInterval: 30000, // 30 seconds max
};

export class PollingService {
  private config: PollingConfig;
  private callbacks: PollingCallbacks;
  private intervalId: NodeJS.Timeout | null = null;
  private status: ConnectionStatus = 'disconnected';
  private consecutiveFailures = 0;
  private currentInterval: number;
  private isPolling = false;

  constructor(callbacks: PollingCallbacks, config: Partial<PollingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.currentInterval = this.config.interval;
  }

  /**
   * Start polling
   */
  start(): void {
    if (this.isPolling) {
      console.warn('[PollingService] Already polling');
      return;
    }

    console.log('[PollingService] Starting polling with interval:', this.currentInterval);
    this.isPolling = true;
    this.updateStatus('connecting');
    
    // Perform initial poll immediately
    this.poll();
    
    // Set up recurring polling
    this.scheduleNextPoll();
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isPolling) {
      return;
    }

    console.log('[PollingService] Stopping polling');
    this.isPolling = false;
    
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    
    this.updateStatus('disconnected');
  }

  /**
   * Manually trigger a poll (for reconnect button)
   */
  async reconnect(): Promise<void> {
    console.log('[PollingService] Manual reconnect triggered');
    
    // Reset failure count and backoff
    this.consecutiveFailures = 0;
    this.currentInterval = this.config.interval;
    
    // If not already polling, start it
    if (!this.isPolling) {
      this.start();
    } else {
      // Otherwise just trigger an immediate poll
      await this.poll();
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get current polling interval
   */
  getCurrentInterval(): number {
    return this.currentInterval;
  }

  /**
   * Get consecutive failure count
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Perform a single poll
   */
  private async poll(): Promise<void> {
    if (!this.isPolling) {
      return;
    }

    try {
      this.updateStatus('connecting');
      await this.callbacks.onPoll();
      
      // Success - reset failure count and backoff
      this.consecutiveFailures = 0;
      this.currentInterval = this.config.interval;
      this.updateStatus('connected');
      
    } catch (error) {
      this.handlePollError(error as Error);
    }
  }

  /**
   * Handle polling error with exponential backoff
   */
  private handlePollError(error: Error): void {
    this.consecutiveFailures++;
    
    console.error(
      `[PollingService] Poll failed (${this.consecutiveFailures}/${this.config.maxRetries}):`,
      error.message
    );
    
    // Notify error callback
    this.callbacks.onError(error);
    
    // Check if we've exceeded max retries
    if (this.consecutiveFailures >= this.config.maxRetries) {
      console.error('[PollingService] Max retries exceeded, stopping polling');
      this.updateStatus('error');
      this.stop();
      return;
    }
    
    // Apply exponential backoff
    this.currentInterval = Math.min(
      this.config.interval * Math.pow(this.config.backoffMultiplier, this.consecutiveFailures - 1),
      this.config.maxBackoffInterval
    );
    
    console.log(`[PollingService] Applying backoff, next poll in ${this.currentInterval}ms`);
    this.updateStatus('error');
  }

  /**
   * Schedule the next poll
   */
  private scheduleNextPoll(): void {
    if (!this.isPolling) {
      return;
    }

    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }

    this.intervalId = setTimeout(() => {
      this.poll().then(() => {
        this.scheduleNextPoll();
      });
    }, this.currentInterval);
  }

  /**
   * Update connection status and notify callback
   */
  private updateStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.callbacks.onStatusChange(newStatus);
    }
  }
}
