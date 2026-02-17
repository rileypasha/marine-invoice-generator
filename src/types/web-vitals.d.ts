declare module 'web-vitals' {
  export function onCLS(callback: (metric: { value: number }) => void): void;
  export function onFID(callback: (metric: { value: number }) => void): void;
  export function onFCP(callback: (metric: { value: number }) => void): void;
  export function onLCP(callback: (metric: { value: number }) => void): void;
  export function onTTFB(callback: (metric: { value: number }) => void): void;
}
