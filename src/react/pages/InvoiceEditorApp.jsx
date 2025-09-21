/**
 * InvoiceEditorApp - Main React component for invoice editing
 * Replaces the vanilla InvoiceApp class with modern React architecture
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useInvoice } from '../context/InvoiceContext.jsx';
import useUnsavedChanges from '../hooks/useUnsavedChanges';
import useNavigationProtection from '../hooks/useNavigationProtection';
import useInvoiceStorage from '../hooks/useInvoiceStorage';
import useTheme from '../hooks/useTheme';

// Import existing React components
import InvoiceEditorUI from './InvoiceEditorUI.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { motion } from 'framer-motion';

const InvoiceEditorApp = ({
  isViewMode = false,
  invoiceId = null,
  onExportPDF,
  onComposeEmail,
  onPrint
}) => {
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const { state: invoiceState, setState, resetState, getState } = useInvoice();
  const { loadInvoice, saveInvoice, isLoading: storageLoading, isSaving } = useInvoiceStorage();
  const { currentTheme } = useTheme();

  // Unsaved changes management
  const {
    hasUnsavedChanges,
    checkState,
    establishBaseline,
    reset: resetUnsavedChanges
  } = useUnsavedChanges();

  // Navigation protection
  const { confirmNavigation, navigateWithCheck } = useNavigationProtection(hasUnsavedChanges);

  // Component state
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);

  /**
   * Check authentication and redirect if needed
   */
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🚫 User not authenticated, redirecting to landing page...');
      window.location.href = '/';
      return;
    }

    if (isAuthenticated && currentUser) {
      console.log('✅ User authenticated:', currentUser.email);
      initializeApp();
    }
  }, [authLoading, isAuthenticated, currentUser]);

  /**
   * Initialize the app
   */
  const initializeApp = useCallback(async () => {
    try {
      console.log('🚀 Initializing Invoice Editor App...');

      // Load invoice if ID provided
      if (invoiceId) {
        setIsLoadingInvoice(true);
        try {
          const invoice = await loadInvoice(invoiceId);
          setState(invoice);
          establishBaseline(invoice);
          console.log(`✅ Loaded invoice ${invoiceId}`);
        } catch (loadError) {
          console.error('❌ Error loading invoice:', loadError);
          setError(`Failed to load invoice ${invoiceId}`);
        } finally {
          setIsLoadingInvoice(false);
        }
      } else {
        // New invoice - establish baseline with empty state
        establishBaseline(getState());
      }

      setIsInitialized(true);
      console.log('✅ Invoice Editor App initialized');

    } catch (error) {
      console.error('❌ Error initializing app:', error);
      setError('Failed to initialize invoice editor');
    }
  }, [invoiceId, loadInvoice, setState, establishBaseline, getState]);

  /**
   * Handle state changes for unsaved changes detection
   */
  useEffect(() => {
    if (isInitialized) {
      checkState(invoiceState);
    }
  }, [invoiceState, isInitialized, checkState]);

  /**
   * Handle save action
   */
  const handleSave = useCallback(async () => {
    try {
      console.log('💾 Saving invoice...');
      const savedInvoice = await saveInvoice(getState());

      // Update state with saved invoice (may have server ID)
      setState(savedInvoice);
      establishBaseline(savedInvoice);

      console.log('✅ Invoice saved successfully');
      return savedInvoice;
    } catch (error) {
      console.error('❌ Error saving invoice:', error);
      setError('Failed to save invoice');
      throw error;
    }
  }, [saveInvoice, getState, setState, establishBaseline]);

  /**
   * Handle navigation away
   */
  const handleNavigate = useCallback((destination) => {
    navigateWithCheck(destination);
  }, [navigateWithCheck]);

  /**
   * Show loading state
   */
  if (authLoading || isLoadingInvoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? 'Authenticating...' : 'Loading invoice...'}
          </p>
        </motion.div>
      </div>
    );
  }

  /**
   * Show error state
   */
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>Something went wrong</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex-1"
              >
                Reload Page
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                className="flex-1"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * Main app render
   */
  return (
    <div className={`min-h-screen ${currentTheme === 'dark' ? 'dark' : ''}`}>
      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-1 text-sm z-50">
          ● You have unsaved changes
        </div>
      )}

      {/* Main editor interface */}
      <InvoiceEditorUI
        isViewMode={isViewMode}
        invoiceData={invoiceState}
        isLoading={storageLoading}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSave}
        onNavigate={handleNavigate}
        onExportPDF={() => onExportPDF?.(getState())}
        onComposeEmail={() => onComposeEmail?.(getState())}
        onPrint={() => onPrint?.(getState())}
      />
    </div>
  );
};

export default InvoiceEditorApp;