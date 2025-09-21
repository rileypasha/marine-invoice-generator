/**
 * UserManager - Compatibility shim for legacy code
 * Provides minimal interface for backward compatibility with React authentication
 */
export class UserManager {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
  }

  notify() {
    // Notify listeners of user state change
    this.listeners.forEach(listener => {
      if (typeof listener === 'function') {
        listener(this.currentUser);
      }
    });
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  setCurrentUser(user) {
    this.currentUser = user;
    this.notify();
  }

  isAuthenticated() {
    return !!this.currentUser;
  }
}

export default UserManager;