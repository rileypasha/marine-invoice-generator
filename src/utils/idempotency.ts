import { createHash } from 'crypto';

export function generateCorrelationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function generateIdempotencyKey(data: any): string {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // Browser environment with Web Crypto API
    const encoder = new TextEncoder();
    const dataString = JSON.stringify({ ...data, timestamp });
    const buffer = encoder.encode(dataString);
    
    return `${timestamp}_${randomPart}_${btoa(String.fromCharCode(...new Uint8Array(buffer.slice(0, 16))))}`;
  } else if (typeof global !== 'undefined' && global.crypto) {
    // Node.js environment
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ ...data, timestamp }));
    return `${timestamp}_${randomPart}_${hash.digest('hex').substring(0, 16)}`;
  } else {
    // Fallback
    const dataString = JSON.stringify({ ...data, timestamp });
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `${timestamp}_${randomPart}_${Math.abs(hash).toString(36)}`;
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func.apply(context, args);
      timeout = null;
    }, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

export function hashObject(obj: any): string {
  const sortedObj = JSON.stringify(obj, Object.keys(obj).sort());
  
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    // Browser
    const encoder = new TextEncoder();
    const data = encoder.encode(sortedObj);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  } else if (typeof global !== 'undefined' && global.crypto) {
    // Node.js
    const hash = createHash('md5');
    hash.update(sortedObj);
    return hash.digest('hex').substring(0, 8);
  } else {
    // Fallback
    let hash = 0;
    for (let i = 0; i < sortedObj.length; i++) {
      const char = sortedObj.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}