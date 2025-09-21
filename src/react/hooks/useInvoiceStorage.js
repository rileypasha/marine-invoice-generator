/**
 * useInvoiceStorage - React hook for invoice storage management
 * Replaces vanilla InvoiceStorage.js with React patterns
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export const useInvoiceStorage = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  const autoSaveTimerRef = useRef(null);
  const listenersRef = useRef([]);
  const serverFailureCountRef = useRef(0);
  const lastServerCheckRef = useRef(null);

  // Configuration
  const STORAGE_KEY = 'marine_invoices';
  const DRAFTS_KEY = 'marine_drafts';
  const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
  const MAX_RETRY_DELAY = 30000;
  const MAX_FAILED_SAVES = 10;

  /**
   * Load invoice by ID
   */
  const loadInvoice = useCallback(async (invoiceId) => {
    setIsLoading(true);

    try {
      // Try server first if authenticated
      if (isAuthenticated && currentUser) {
        console.log(`🔄 Loading invoice ${invoiceId} from server...`);

        const response = await fetch(`/api/invoices/${invoiceId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const invoice = await response.json();
          console.log('✅ Invoice loaded from server');
          setLastSaved(Date.now());
          return invoice;
        } else if (response.status === 401) {
          console.log('🔒 Authentication required for server load');
        } else {
          console.warn('⚠️ Server load failed, trying local storage');
        }
      }

      // Fallback to localStorage
      const localInvoices = getLocalInvoices();
      const invoice = localInvoices.find(inv => inv.id === invoiceId);

      if (invoice) {
        console.log('✅ Invoice loaded from localStorage');
        return invoice;
      } else {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

    } catch (error) {
      console.error('❌ Error loading invoice:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentUser]);

  /**
   * Save invoice
   */
  const saveInvoice = useCallback(async (invoiceData, options = {}) => {
    const { isDraft = false, skipServer = false } = options;
    setIsSaving(true);

    try {
      // Validate invoice data
      if (!invoiceData) {
        throw new Error('Invoice data is required');
      }

      // Add metadata
      const invoice = {
        ...invoiceData,
        lastModified: new Date().toISOString(),
        isDraft,
        user: currentUser?.email || 'anonymous'
      };

      // Save to localStorage first (fast, reliable)
      const key = isDraft ? DRAFTS_KEY : STORAGE_KEY;
      saveToLocalStorage(key, invoice);

      // Try server save if authenticated and not skipping
      if (isAuthenticated && currentUser && !skipServer) {
        try {
          const serverInvoice = await saveToServer(invoice);
          if (serverInvoice) {
            // Update localStorage with server response (may have server ID)
            saveToLocalStorage(key, serverInvoice);
            invoice.id = serverInvoice.id; // Update with server ID
            serverFailureCountRef.current = 0; // Reset failure count
          }
        } catch (serverError) {
          console.warn('⚠️ Server save failed, invoice saved locally:', serverError);
          serverFailureCountRef.current++;

          // Don't throw server errors - local save succeeded
        }
      }

      setLastSaved(Date.now());
      console.log(`✅ Invoice saved successfully (ID: ${invoice.id})`);

      // Notify listeners
      notifyListeners('save', invoice);

      return invoice;

    } catch (error) {
      console.error('❌ Error saving invoice:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, currentUser]);

  /**
   * Load all user invoices
   */
  const loadUserInvoices = useCallback(async () => {
    setIsLoading(true);

    try {
      let invoices = [];

      // Try server first if authenticated
      if (isAuthenticated && currentUser) {
        try {
          console.log('🔄 Loading user invoices from server...');

          const response = await fetch('/api/invoices/user', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            const serverInvoices = await response.json();
            invoices = Array.isArray(serverInvoices) ? serverInvoices : [];
            console.log(`✅ Loaded ${invoices.length} invoices from server`);

            // Update localStorage with server data
            localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
            setLastSaved(Date.now());
            return invoices;
          } else {
            console.warn('⚠️ Server load failed, using local storage');
          }
        } catch (serverError) {
          console.warn('⚠️ Server request failed, using local storage:', serverError);
        }
      }

      // Fallback to localStorage
      invoices = getLocalInvoices();
      console.log(`📁 Loaded ${invoices.length} invoices from localStorage`);
      return invoices;

    } catch (error) {
      console.error('❌ Error loading user invoices:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, currentUser]);

  /**
   * Delete invoice
   */
  const deleteInvoice = useCallback(async (invoiceId) => {
    try {
      // Delete from server if authenticated
      if (isAuthenticated && currentUser) {
        try {
          const response = await fetch(`/api/invoices/${invoiceId}`, {
            method: 'DELETE',
            credentials: 'include'
          });

          if (response.ok) {
            console.log('✅ Invoice deleted from server');
          } else {
            console.warn('⚠️ Server delete failed, deleting locally only');
          }
        } catch (serverError) {
          console.warn('⚠️ Server delete request failed:', serverError);
        }
      }

      // Delete from localStorage
      deleteFromLocalStorage(invoiceId);
      console.log(`✅ Invoice ${invoiceId} deleted locally`);

      // Notify listeners
      notifyListeners('delete', { id: invoiceId });

      return true;

    } catch (error) {
      console.error('❌ Error deleting invoice:', error);
      throw error;
    }
  }, [isAuthenticated, currentUser]);

  /**
   * Get local invoices from localStorage
   */
  const getLocalInvoices = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const invoices = JSON.parse(stored);
        return Array.isArray(invoices) ? invoices : [];
      }
      return [];
    } catch (error) {
      console.error('❌ Error reading local invoices:', error);
      return [];
    }
  }, []);

  /**
   * Save to localStorage
   */
  const saveToLocalStorage = useCallback((key, invoice) => {
    try {
      const stored = localStorage.getItem(key);
      let invoices = stored ? JSON.parse(stored) : [];

      if (!Array.isArray(invoices)) {
        invoices = [];
      }

      // Find existing invoice or add new one
      const existingIndex = invoices.findIndex(inv => inv.id === invoice.id);
      if (existingIndex >= 0) {
        invoices[existingIndex] = invoice;
      } else {
        // Generate local ID if not present
        if (!invoice.id) {
          invoice.id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        invoices.push(invoice);
      }

      localStorage.setItem(key, JSON.stringify(invoices));
      console.log(`💾 Saved to localStorage (${key})`);

    } catch (error) {
      console.error('❌ Error saving to localStorage:', error);
      throw error;
    }
  }, []);

  /**
   * Save to server
   */
  const saveToServer = useCallback(async (invoice) => {
    const isUpdate = invoice.id && !invoice.id.startsWith('local_');
    const method = isUpdate ? 'PUT' : 'POST';
    const url = isUpdate ? `/api/invoices/${invoice.id}` : '/api/invoices';

    console.log(`🌐 ${isUpdate ? 'Updating' : 'Creating'} invoice on server...`);

    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoice)
    });

    if (!response.ok) {
      throw new Error(`Server save failed: ${response.status} ${response.statusText}`);
    }

    const savedInvoice = await response.json();
    console.log(`✅ Invoice ${isUpdate ? 'updated' : 'created'} on server (ID: ${savedInvoice.id})`);

    return savedInvoice;
  }, []);

  /**
   * Delete from localStorage
   */
  const deleteFromLocalStorage = useCallback((invoiceId) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const invoices = JSON.parse(stored);
        const filtered = invoices.filter(inv => inv.id !== invoiceId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      }

      // Also check drafts
      const drafts = localStorage.getItem(DRAFTS_KEY);
      if (drafts) {
        const draftInvoices = JSON.parse(drafts);
        const filtered = draftInvoices.filter(inv => inv.id !== invoiceId);
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
      }
    } catch (error) {
      console.error('❌ Error deleting from localStorage:', error);
    }
  }, []);

  /**
   * Notify listeners
   */
  const notifyListeners = useCallback((event, data) => {
    listenersRef.current.forEach(listener => {
      try {
        listener({ event, data });
      } catch (error) {
        console.error('Error in storage listener:', error);
      }
    });
  }, []);

  /**
   * Subscribe to storage events
   */
  const subscribe = useCallback((listener) => {
    if (typeof listener !== 'function') {
      console.warn('Invalid listener: must be a function');
      return () => {};
    }

    listenersRef.current.push(listener);

    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== listener);
    };
  }, []);

  /**
   * Setup auto-save for invoice data
   */
  const setupAutoSave = useCallback((getInvoiceData) => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setInterval(async () => {
      if (typeof getInvoiceData === 'function') {
        try {
          const invoiceData = getInvoiceData();
          if (invoiceData && invoiceData.vessel?.name) {
            await saveInvoice(invoiceData, { isDraft: true });
            console.log('📝 Auto-save completed');
          }
        } catch (error) {
          console.error('❌ Auto-save failed:', error);
        }
      }
    }, AUTO_SAVE_INTERVAL);

    console.log('⏰ Auto-save enabled');

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [saveInvoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      listenersRef.current = [];
    };
  }, []);

  return {
    // State
    isLoading,
    isSaving,
    lastSaved,

    // Core operations
    loadInvoice,
    saveInvoice,
    deleteInvoice,
    loadUserInvoices,

    // Local storage utilities
    getLocalInvoices,

    // Event handling
    subscribe,
    setupAutoSave,

    // Status
    serverFailureCount: serverFailureCountRef.current,
    lastServerCheck: lastServerCheckRef.current
  };
};

export default useInvoiceStorage;