/**
 * Performance Monitor
 * Tracks and reports performance metrics for the dashboard
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: null,
      apiCalls: [],
      renders: [],
      interactions: [],
      memory: []
    };
    
    this.marks = new Map();
    this.measures = [];
    
    this.init();
  }

  init() {
    // Capture page load metrics
    if (typeof performance !== 'undefined' && performance.timing) {
      window.addEventListener('load', () => {
        setTimeout(() => this.capturePageLoad(), 0);
      });
    }
    
    // Monitor memory usage (if available)
    if (performance.memory) {
      setInterval(() => this.captureMemory(), 30000); // Every 30 seconds
    }
    
    // Setup Performance Observer for long tasks
    this.setupPerformanceObserver();
  }

  setupPerformanceObserver() {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }
    
    try {
      // Monitor long tasks (> 50ms)
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn(`[PERF] Long task detected: ${entry.duration.toFixed(2)}ms`, entry);
            this.recordMetric('longTask', {
              name: entry.name,
              duration: entry.duration,
              startTime: entry.startTime
            });
          }
        }
      });
      
      if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      }
      
      // Monitor layout shifts (CLS)
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue; // Ignore user-initiated shifts
          
          if (entry.value > 0.1) { // CLS threshold
            console.warn(`[PERF] Layout shift detected: ${entry.value.toFixed(4)}`, entry);
            this.recordMetric('layoutShift', {
              value: entry.value,
              sources: entry.sources?.map(s => ({
                node: s.node?.tagName,
                rect: s.currentRect
              }))
            });
          }
        }
      });
      
      if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      }
      
    } catch (error) {
      console.warn('[PERF] PerformanceObserver setup failed:', error);
    }
  }

  /**
   * Capture page load metrics
   */
  capturePageLoad() {
    if (!performance.timing) return;
    
    const timing = performance.timing;
    const navigation = performance.navigation;
    
    this.metrics.pageLoad = {
      // Navigation timing
      navigationStart: 0,
      unloadEventStart: timing.unloadEventStart - timing.navigationStart,
      redirectTime: timing.redirectEnd - timing.redirectStart,
      domainLookup: timing.domainLookupEnd - timing.domainLookupStart,
      connect: timing.connectEnd - timing.connectStart,
      secureConnect: timing.secureConnectionStart ? timing.connectEnd - timing.secureConnectionStart : 0,
      request: timing.responseStart - timing.requestStart,
      response: timing.responseEnd - timing.responseStart,
      domLoading: timing.domLoading - timing.navigationStart,
      domInteractive: timing.domInteractive - timing.navigationStart,
      domComplete: timing.domComplete - timing.navigationStart,
      loadEvent: timing.loadEventEnd - timing.loadEventStart,
      
      // Total times
      totalLoadTime: timing.loadEventEnd - timing.navigationStart,
      domReadyTime: timing.domContentLoadedEventEnd - timing.navigationStart,
      
      // Navigation type
      navigationType: navigation.type,
      redirectCount: navigation.redirectCount
    };
    
    console.log('[PERF] Page load metrics:', this.metrics.pageLoad);
    
    // Capture Core Web Vitals if available
    this.captureCoreWebVitals();
  }

  /**
   * Capture Core Web Vitals (LCP, FID, CLS)
   */
  captureCoreWebVitals() {
    if (typeof PerformanceObserver === 'undefined') return;
    
    try {
      // Largest Contentful Paint (LCP)
      new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('[PERF] LCP:', lastEntry.renderTime || lastEntry.loadTime, 'ms');
        this.recordMetric('lcp', {
          value: lastEntry.renderTime || lastEntry.loadTime,
          element: lastEntry.element?.tagName
        });
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // First Input Delay (FID)
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          console.log('[PERF] FID:', entry.processingStart - entry.startTime, 'ms');
          this.recordMetric('fid', {
            value: entry.processingStart - entry.startTime,
            name: entry.name
          });
        }
      }).observe({ entryTypes: ['first-input'] });
      
    } catch (error) {
      console.warn('[PERF] Core Web Vitals capture failed:', error);
    }
  }

  /**
   * Capture memory usage
   */
  captureMemory() {
    if (!performance.memory) return;
    
    const memory = {
      timestamp: Date.now(),
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      usedPercentage: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2)
    };
    
    this.metrics.memory.push(memory);
    
    // Keep only last 100 memory samples
    if (this.metrics.memory.length > 100) {
      this.metrics.memory.shift();
    }
    
    // Warn if memory usage is high
    if (parseFloat(memory.usedPercentage) > 90) {
      console.warn('[PERF] High memory usage:', memory.usedPercentage + '%');
    }
  }

  /**
   * Mark a performance point
   */
  mark(name) {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name);
      this.marks.set(name, performance.now());
    }
  }

  /**
   * Measure time between two marks
   */
  measure(name, startMark, endMark) {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        
        const entries = performance.getEntriesByName(name, 'measure');
        if (entries.length > 0) {
          const duration = entries[entries.length - 1].duration;
          console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
          
          this.measures.push({
            name,
            duration,
            timestamp: Date.now()
          });
          
          return duration;
        }
      } catch (error) {
        console.warn(`[PERF] Measure failed for ${name}:`, error);
      }
    }
    
    // Fallback to manual calculation
    if (this.marks.has(startMark) && this.marks.has(endMark)) {
      const duration = this.marks.get(endMark) - this.marks.get(startMark);
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    
    return null;
  }

  /**
   * Record a metric
   */
  recordMetric(type, data) {
    const metric = {
      type,
      timestamp: Date.now(),
      ...data
    };
    
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    
    if (Array.isArray(this.metrics[type])) {
      this.metrics[type].push(metric);
      
      // Keep only last 100 metrics of each type
      if (this.metrics[type].length > 100) {
        this.metrics[type].shift();
      }
    }
  }

  /**
   * Track API call performance
   */
  trackAPICall(endpoint, duration, success = true) {
    this.recordMetric('apiCalls', {
      endpoint,
      duration,
      success
    });
    
    if (duration > 1000) {
      console.warn(`[PERF] Slow API call: ${endpoint} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Track render performance
   */
  trackRender(viewName, duration) {
    this.recordMetric('renders', {
      viewName,
      duration
    });
    
    if (duration > 100) {
      console.warn(`[PERF] Slow render: ${viewName} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get performance report
   */
  getReport() {
    const report = {
      pageLoad: this.metrics.pageLoad,
      apiCalls: {
        total: this.metrics.apiCalls?.length || 0,
        average: this.calculateAverage(this.metrics.apiCalls, 'duration'),
        slowest: this.findSlowest(this.metrics.apiCalls, 'duration')
      },
      renders: {
        total: this.metrics.renders?.length || 0,
        average: this.calculateAverage(this.metrics.renders, 'duration'),
        slowest: this.findSlowest(this.metrics.renders, 'duration')
      },
      memory: {
        current: this.metrics.memory[this.metrics.memory.length - 1],
        peak: this.findPeak(this.metrics.memory, 'usedJSHeapSize')
      },
      measures: this.measures.slice(-20) // Last 20 measures
    };
    
    return report;
  }

  calculateAverage(metrics, field) {
    if (!metrics || metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + (m[field] || 0), 0);
    return (sum / metrics.length).toFixed(2);
  }

  findSlowest(metrics, field) {
    if (!metrics || metrics.length === 0) return null;
    return metrics.reduce((slowest, m) => 
      (m[field] || 0) > (slowest[field] || 0) ? m : slowest
    );
  }

  findPeak(metrics, field) {
    if (!metrics || metrics.length === 0) return null;
    return metrics.reduce((peak, m) => 
      (m[field] || 0) > (peak[field] || 0) ? m : peak
    );
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {
      pageLoad: null,
      apiCalls: [],
      renders: [],
      interactions: [],
      memory: []
    };
    this.marks.clear();
    this.measures = [];
  }

  /**
   * Export metrics for analysis
   */
  export() {
    return JSON.stringify(this.metrics, null, 2);
  }
}

// Create global instance
window.performanceMonitor = window.performanceMonitor || new PerformanceMonitor();

// Expose console command
window.perfReport = () => {
  console.log('[PERF] Performance Report:', window.performanceMonitor.getReport());
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PerformanceMonitor;
}














