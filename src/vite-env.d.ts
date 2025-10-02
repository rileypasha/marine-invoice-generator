/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Workbox types
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: any) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}

// Service Worker types
declare module 'workbox-window' {
  export class Workbox {
    constructor(scriptURL: string, options?: any)
    register(options?: any): Promise<ServiceWorkerRegistration | undefined>
    active: Promise<ServiceWorker | undefined>
    controlling: Promise<ServiceWorker | undefined>
    addEventListener(type: string, listener: EventListener): void
    removeEventListener(type: string, listener: EventListener): void
  }
}

// Extend Navigator for iOS standalone detection
interface Navigator {
  standalone?: boolean
}
