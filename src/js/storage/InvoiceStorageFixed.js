/**
 * InvoiceStorageFixed - Smart-Save 500 Error Fixes
 *
 * Root Cause Fixes:
 * 1. Use PATCH instead of POST for updates
 * 2. Implement fallback endpoint strategy
 * 3. Add proper error recovery and retry logic
 * 4. Validate payload schema before sending
 * 5. Graceful degradation on persistent failures
 *
 * Replace the updateToServer method in InvoiceStorage.js
 */

/**
 * FIXED: Update invoice on server with proper HTTP methods and fallback strategy
 * @param {Object} invoice - Invoice object to update
 */
export async function updateToServerFixed(invoice) {
  const requestId = `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`📤 [${requestId}] Starting FIXED server update for invoice:`, invoice.id);

  // Check if we should skip server save due to previous auth failure
  if (this.authFailed) {
    console.log(`⏸️ [${requestId}] Skipping server update - auth previously failed`);
    this.queueFailedSave(invoice, {
      status: 401,
      body: 'Authentication required - queued for later',
      requestId,
      skipped: true,
      isUpdate: true
    });
    throw new Error('Authentication required - update queued locally');
  }

  // Validate payload before sending
  const validationResult = this.validateUpdatePayload(invoice);
  if (!validationResult.isValid) {
    console.error(`❌ [${requestId}] Payload validation failed:`, validationResult.errors);
    throw new Error(`Invalid payload: ${validationResult.errors.join(', ')}`);
  }

  // Prepare request body for update
  const requestBody = {
    id: invoice.serverId || invoice.id,
    title: invoice.title,
    data: typeof invoice.data === 'string' ? JSON.parse(invoice.data) : invoice.data,
    metadata: typeof invoice.metadata === 'string' ? JSON.parse(invoice.metadata) : invoice.metadata
  };

  console.log(`📋 [${requestId}] FIXED update request body validation passed`);

  // Try multiple endpoints in order of preference
  const endpoints = [
    {
      name: 'V3 PATCH Smart-Save',
      url: '/api/v3/invoices/smart-save',
      method: 'PATCH',
      priority: 1
    },
    {
      name: 'V2 PUT Legacy',
      url: `/api/v2/invoice/${invoice.serverId || invoice.id}`,
      method: 'PUT',
      priority: 2
    },
    {
      name: 'V1 PUT Fallback',
      url: `/api/v1/invoice/${invoice.serverId || invoice.id}`,
      method: 'PUT',
      priority: 3
    }
  ];

  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      console.log(`🎯 [${requestId}] Trying ${endpoint.name} (${endpoint.method} ${endpoint.url})`);

      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': requestId,
          'X-Endpoint-Priority': endpoint.priority.toString()
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      console.log(`📨 [${requestId}] ${endpoint.name} response status:`, response.status);

      if (response.ok) {
        // Success! Clear auth failure flag
        this.authFailed = false;

        const result = await response.json();
        console.log(`✅ [${requestId}] Server update successful via ${endpoint.name}:`, result);

        return result;
      }

      // Handle specific error responses
      const errorText = await response.text();
      console.warn(`⚠️ [${requestId}] ${endpoint.name} failed: ${response.status} ${errorText}`);

      // If 500 error on smart-save, try next endpoint
      if (response.status >= 500 && endpoint.priority < 3) {
        console.log(`🔄 [${requestId}] 500 error on ${endpoint.name}, trying next endpoint...`);
        lastError = new Error(`${endpoint.name} failed: ${response.status} ${errorText}`);
        continue;
      }

      // Auth failures stop the chain
      if (response.status === 401) {
        this.authFailed = true;
        console.log(`🔒 [${requestId}] Authentication failed - blocking future save attempts`);

        this.queueFailedSave(invoice, {
          status: response.status,
          body: errorText,
          requestId,
          isUpdate: true
        });

        throw new Error(`Authentication failed: ${response.status} ${errorText}`);
      }

      // Client errors (4xx) don't warrant retrying other endpoints
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status} ${errorText}`);
      }

      // Store this error and try next endpoint for 5xx errors
      lastError = new Error(`${endpoint.name} failed: ${response.status} ${errorText}`);

    } catch (error) {
      console.error(`🔥 [${requestId}] ${endpoint.name} error:`, error);
      lastError = error;

      // Network errors - try next endpoint
      if (error.name === 'TypeError' || error.message.includes('fetch')) {
        console.log(`🌐 [${requestId}] Network error with ${endpoint.name}, trying next...`);
        continue;
      }

      // Auth or client errors - stop trying
      if (error.message.includes('Authentication') || error.message.includes('Client error')) {
        throw error;
      }
    }
  }

  // All endpoints failed
  console.error(`💥 [${requestId}] All update endpoints failed. Last error:`, lastError);

  // Queue for retry
  this.queueFailedSave(invoice, {
    error: lastError?.message || 'All endpoints failed',
    requestId,
    isUpdate: true,
    endpointsFailed: endpoints.length
  });

  throw lastError || new Error('All update endpoints failed');
}

/**
 * Validate update payload before sending to server
 */
export function validateUpdatePayload(invoice) {
  const errors = [];

  // Required fields validation
  if (!invoice.id && !invoice.serverId) {
    errors.push('Invoice must have either id or serverId');
  }

  if (!invoice.title || typeof invoice.title !== 'string') {
    errors.push('Invoice title is required and must be a string');
  }

  if (!invoice.data || typeof invoice.data !== 'object') {
    errors.push('Invoice data is required and must be an object');
  }

  // Data structure validation
  if (invoice.data) {
    if (!invoice.data.vessel || typeof invoice.data.vessel !== 'object') {
      errors.push('Invoice data must contain vessel object');
    }

    if (!invoice.data.customer || typeof invoice.data.customer !== 'object') {
      errors.push('Invoice data must contain customer object');
    }

    if (!invoice.data.scope || typeof invoice.data.scope !== 'object') {
      errors.push('Invoice data must contain scope object');
    }

    if (invoice.data.scope && !Array.isArray(invoice.data.scope.lineItems)) {
      errors.push('Invoice scope must contain lineItems array');
    }
  }

  // Size validation (prevent oversized payloads)
  try {
    const payloadSize = JSON.stringify(invoice).length;
    if (payloadSize > 1000000) { // 1MB limit
      errors.push(`Payload too large: ${payloadSize} bytes (max 1MB)`);
    }
  } catch (error) {
    errors.push('Payload cannot be serialized to JSON');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Enhanced error recovery with exponential backoff
 */
export async function retryFailedSavesFixed() {
  const failedSaves = JSON.parse(localStorage.getItem('failedSaves') || '[]');
  if (failedSaves.length === 0) return { retried: 0, stillFailed: 0 };

  // Check if user is authenticated before retrying
  const currentUser = this.userManager.getCurrentUser();
  if (!currentUser) {
    console.log('⏸️ Postponing retry - user not authenticated');
    return { retried: 0, stillFailed: failedSaves.length };
  }

  console.log(`🔄 FIXED: Retrying ${failedSaves.length} failed saves with exponential backoff...`);
  const stillFailed = [];
  let retried = 0;

  for (const failedSave of failedSaves) {
    try {
      // Exponential backoff calculation
      const backoffDelay = Math.min(1000 * Math.pow(2, failedSave.retryCount), 30000); // Max 30 seconds

      if (Date.now() - new Date(failedSave.timestamp).getTime() < backoffDelay) {
        console.log(`⏳ Backoff delay not met for ${failedSave.invoice.title}, requeueing`);
        stillFailed.push(failedSave);
        continue;
      }

      failedSave.retryCount = (failedSave.retryCount || 0) + 1;

      if (failedSave.isUpdate) {
        await this.updateToServerFixed(failedSave.invoice);
      } else {
        await this.saveToServer(failedSave.invoice);
      }

      console.log(`✅ FIXED: Retry successful for invoice: ${failedSave.invoice.title}`);
      retried++;

    } catch (error) {
      console.error(`❌ FIXED: Retry failed for ${failedSave.invoice.title}:`, error);

      // Auth errors - stop retrying
      if (error.message && error.message.includes('Authentication')) {
        console.log('🔐 Authentication lost - stopping retries');
        stillFailed.push(failedSave);
        break;
      }

      // Give up after 5 retries
      if (failedSave.retryCount >= 5) {
        console.error(`❌ FIXED: Giving up on invoice after 5 retries: ${failedSave.invoice.title}`);
      } else {
        stillFailed.push(failedSave);
      }
    }
  }

  localStorage.setItem('failedSaves', JSON.stringify(stillFailed));
  console.log(`✅ FIXED: Retry complete - ${retried} successful, ${stillFailed.length} still failed`);

  return { retried, stillFailed: stillFailed.length };
}