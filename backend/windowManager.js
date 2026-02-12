// windowManager.js
// 15-second window tracking for posture insights

const WINDOW_DURATION_MS = 15 * 1000; // 15 seconds in milliseconds

/**
 * Get the window ID for a given timestamp.
 * Windows are aligned to 15-second boundaries (e.g., 00:00, 00:15, 00:30, 00:45, etc.).
 */
function getWindowId(ts) {
  const date = new Date(ts);
  const seconds = date.getSeconds();
  const bucket = Math.floor(seconds / 15);
  const windowStart = new Date(date);
  windowStart.setSeconds(bucket * 15, 0);
  
  return windowStart.toISOString();
}

/**
 * Get the window start timestamp for a given window ID.
 */
function getWindowStart(windowId) {
  return new Date(windowId).getTime();
}

/**
 * Get the window end timestamp (exclusive).
 */
function getWindowEnd(windowId) {
  return getWindowStart(windowId) + WINDOW_DURATION_MS;
}

/**
 * Window manager class that tracks samples per window and detects window changes.
 */
class WindowManager {
  constructor() {
    this.currentWindowId = null;
    this.windows = new Map(); // windowId -> { sensor1: [], sensor2: [], start: ts, end: ts }
    this.lastClosedWindowId = null; // Track the last closed window to prevent duplicate closes
  }

  /**
   * Ingest a sample and return the closed window ID if the window just changed.
   * @param {number} sensorId - 1 or 2
   * @param {object} sample - Sample object with ts property
   * @returns {string|null} - The window ID that just closed, or null if no change
   */
  ingestSample(sensorId, sample) {
    const ts = sample.ts ?? Date.now();
    const windowId = getWindowId(ts);
    
    let closedWindowId = null;
    
    // If we've moved to a new window, mark the previous one as closed
    // But only if we haven't already closed it (prevents duplicate closes from both sensors)
    if (this.currentWindowId && this.currentWindowId !== windowId) {
      // Only return the closed window if it's different from the last one we closed
      // This prevents both sensors from triggering the same window close
      if (this.currentWindowId !== this.lastClosedWindowId) {
        closedWindowId = this.currentWindowId;
        this.lastClosedWindowId = this.currentWindowId;
      }
    }
    
    this.currentWindowId = windowId;
    
    // Get or create the window bucket
    if (!this.windows.has(windowId)) {
      this.windows.set(windowId, {
        sensor1: [],
        sensor2: [],
        start: getWindowStart(windowId),
        end: getWindowEnd(windowId),
      });
    }
    
    const window = this.windows.get(windowId);
    if (sensorId === 1) {
      window.sensor1.push(sample);
    } else if (sensorId === 2) {
      window.sensor2.push(sample);
    }
    
    return closedWindowId;
  }

  /**
   * Get samples for a specific window.
   */
  getWindow(windowId) {
    return this.windows.get(windowId);
  }

  /**
   * Remove a window (cleanup after processing).
   */
  removeWindow(windowId) {
    this.windows.delete(windowId);
  }

  /**
   * Get the current window ID.
   */
  getCurrentWindowId() {
    return this.currentWindowId;
  }

  /**
   * Clean up old windows (keep only last N windows).
   */
  trimHistory(maxWindows = 240) {
    // 240 windows = 60 minutes (1 hour) of 15-second windows
    if (this.windows.size <= maxWindows) return;
    
    const entries = Array.from(this.windows.entries())
      .sort((a, b) => a[1].start - b[1].start);
    
    const toRemove = entries.slice(0, entries.length - maxWindows);
    for (const [windowId] of toRemove) {
      this.windows.delete(windowId);
    }
  }
}

module.exports = {
  getWindowId,
  getWindowStart,
  getWindowEnd,
  WindowManager,
  WINDOW_DURATION_MS,
};
