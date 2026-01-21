/**
 * DraftPersistenceService
 * 
 * Manages draft message persistence to local storage with debouncing and expiry.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface DraftData {
  content: string;
  timestamp: number;
  sessionId: string;
}

export interface DraftPersistenceConfig {
  debounceMs: number; // Debounce delay in milliseconds (default: 2000ms)
  expiryMs: number; // Draft expiry time in milliseconds (default: 24 hours)
  storageKey: string; // Local storage key prefix (default: 'intake-draft')
}

export interface DraftPersistenceCallbacks {
  onSaveStatusChange: (status: SaveStatus) => void;
  onStorageUnavailable: () => void;
}

const DEFAULT_CONFIG: DraftPersistenceConfig = {
  debounceMs: 2000, // 2 seconds (Requirement 12.2)
  expiryMs: 24 * 60 * 60 * 1000, // 24 hours (Requirement 12.3)
  storageKey: 'intake-draft',
};

export class DraftPersistenceService {
  private config: DraftPersistenceConfig;
  private callbacks: DraftPersistenceCallbacks;
  private debounceTimer: NodeJS.Timeout | null = null;
  private saveStatus: SaveStatus = 'idle';
  private storageAvailable: boolean = false;

  constructor(callbacks: DraftPersistenceCallbacks, config: Partial<DraftPersistenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.storageAvailable = this.checkStorageAvailability();

    if (!this.storageAvailable) {
      this.callbacks.onStorageUnavailable();
    }
  }

  /**
   * Check if local storage is available
   */
  private checkStorageAvailability(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('[DraftPersistenceService] Local storage not available:', e);
      return false;
    }
  }

  /**
   * Get storage key for a specific session
   */
  private getStorageKey(sessionId: string): string {
    return `${this.config.storageKey}-${sessionId}`;
  }

  /**
   * Save draft with debouncing (Requirement 12.1, 12.2)
   */
  saveDraft(content: string, sessionId: string): void {
    if (!this.storageAvailable) {
      return;
    }

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Update status to saving
    this.updateSaveStatus('saving');

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      try {
        const draftData: DraftData = {
          content,
          timestamp: Date.now(),
          sessionId,
        };

        const storageKey = this.getStorageKey(sessionId);
        localStorage.setItem(storageKey, JSON.stringify(draftData));

        this.updateSaveStatus('saved');

        // Reset to idle after 2 seconds
        setTimeout(() => {
          if (this.saveStatus === 'saved') {
            this.updateSaveStatus('idle');
          }
        }, 2000);

      } catch (error) {
        console.error('[DraftPersistenceService] Failed to save draft:', error);
        this.updateSaveStatus('error');
        
        // Reset to idle after 3 seconds
        setTimeout(() => {
          if (this.saveStatus === 'error') {
            this.updateSaveStatus('idle');
          }
        }, 3000);
      }
    }, this.config.debounceMs);
  }

  /**
   * Load draft from storage (Requirement 12.1, 12.3)
   */
  loadDraft(sessionId: string): string | null {
    if (!this.storageAvailable) {
      return null;
    }

    try {
      const storageKey = this.getStorageKey(sessionId);
      const storedData = localStorage.getItem(storageKey);

      if (!storedData) {
        return null;
      }

      const draftData: DraftData = JSON.parse(storedData);

      // Check if draft has expired (Requirement 12.3)
      const age = Date.now() - draftData.timestamp;
      if (age > this.config.expiryMs) {
        console.log('[DraftPersistenceService] Draft expired, clearing');
        this.clearDraft(sessionId);
        return null;
      }

      // Verify session ID matches
      if (draftData.sessionId !== sessionId) {
        console.warn('[DraftPersistenceService] Session ID mismatch, clearing draft');
        this.clearDraft(sessionId);
        return null;
      }

      return draftData.content;

    } catch (error) {
      console.error('[DraftPersistenceService] Failed to load draft:', error);
      return null;
    }
  }

  /**
   * Clear draft from storage (Requirement 12.4)
   */
  clearDraft(sessionId: string): void {
    if (!this.storageAvailable) {
      return;
    }

    try {
      const storageKey = this.getStorageKey(sessionId);
      localStorage.removeItem(storageKey);
      
      // Cancel any pending save
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      
      this.updateSaveStatus('idle');
      
    } catch (error) {
      console.error('[DraftPersistenceService] Failed to clear draft:', error);
    }
  }

  /**
   * Get current save status
   */
  getSaveStatus(): SaveStatus {
    return this.saveStatus;
  }

  /**
   * Check if storage is available
   */
  isStorageAvailable(): boolean {
    return this.storageAvailable;
  }

  /**
   * Update save status and notify callback
   */
  private updateSaveStatus(newStatus: SaveStatus): void {
    if (this.saveStatus !== newStatus) {
      this.saveStatus = newStatus;
      this.callbacks.onSaveStatusChange(newStatus);
    }
  }

  /**
   * Cleanup - cancel pending saves
   */
  cleanup(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
