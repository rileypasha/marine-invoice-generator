import { EventEmitter } from 'events';

export interface AuthState {
  isAuthenticated: boolean;
  sessionExpiry: Date | null;
  lastAuthCheck: Date;
  userId: string | null;
  sessionExpired: boolean;
  csrfToken: string | null;
}

export interface AuthStateListener {
  (state: AuthState): void;
}

export class AuthRequiredError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

class AuthStore extends EventEmitter {
  private state: AuthState = {
    isAuthenticated: false,
    sessionExpiry: null,
    lastAuthCheck: new Date(),
    userId: null,
    sessionExpired: false,
    csrfToken: null,
  };

  private stateListeners = new Set<AuthStateListener>();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.loadState();
    this.startSessionCheck();
  }

  private loadState(): void {
    const stored = localStorage.getItem('authState');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.state = {
          ...parsed,
          sessionExpiry: parsed.sessionExpiry ? new Date(parsed.sessionExpiry) : null,
          lastAuthCheck: new Date(parsed.lastAuthCheck),
        };
      } catch (error) {
        console.error('Failed to load auth state:', error);
      }
    }
  }

  private saveState(): void {
    localStorage.setItem('authState', JSON.stringify(this.state));
  }

  private notifyListeners(): void {
    this.stateListeners.forEach(listener => listener({ ...this.state }));
    this.emit('stateChange', { ...this.state });
  }

  private startSessionCheck(): void {
    this.checkInterval = setInterval(() => {
      if (this.state.sessionExpiry && new Date() > this.state.sessionExpiry) {
        this.handleSessionExpiry();
      }
    }, 10000); // Check every 10 seconds
  }

  async checkAuth(): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.setState({
          isAuthenticated: true,
          userId: data.userId,
          sessionExpiry: data.sessionExpiry ? new Date(data.sessionExpiry) : null,
          csrfToken: data.csrfToken,
          sessionExpired: false,
        });
        return true;
      } else if (response.status === 401) {
        this.handleAuthRequired();
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
    return false;
  }

  handleAuthRequired(): void {
    this.setState({
      isAuthenticated: false,
      userId: null,
      sessionExpiry: null,
      sessionExpired: false,
      csrfToken: null,
    });
    this.emit('authRequired');
  }

  handleSessionExpiry(): void {
    this.setState({
      isAuthenticated: false,
      sessionExpired: true,
    });
    this.emit('sessionExpired');
  }

  setState(updates: Partial<AuthState>): void {
    this.state = {
      ...this.state,
      ...updates,
      lastAuthCheck: new Date(),
    };
    this.saveState();
    this.notifyListeners();
  }

  getState(): AuthState {
    return { ...this.state };
  }

  get isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  get sessionExpired(): boolean {
    return this.state.sessionExpired;
  }

  get csrfToken(): string | null {
    return this.state.csrfToken;
  }

  subscribe(listener: AuthStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async login(credentials: { username: string; password: string }): Promise<boolean> {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (response.ok) {
        const data = await response.json();
        this.setState({
          isAuthenticated: true,
          userId: data.userId,
          sessionExpiry: data.sessionExpiry ? new Date(data.sessionExpiry) : null,
          csrfToken: data.csrfToken,
          sessionExpired: false,
        });
        this.emit('login', data);
        return true;
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
    return false;
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': this.state.csrfToken || '',
        },
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      this.handleAuthRequired();
      this.emit('logout');
    }
  }

  clearSession(): void {
    this.handleAuthRequired();
  }

  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.stateListeners.clear();
    this.removeAllListeners();
  }
}

export const authStore = new AuthStore();
export default authStore;
