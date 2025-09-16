/**
 * Test Data Fixtures for Invoice Testing
 *
 * Provides consistent test data across all test suites
 */

const testUsers = {
  regular: {
    email: 'test@marinegroup.com',
    password: 'test123',
    name: 'Test User'
  },
  master: {
    email: 'rpasha@marinegroupbw.com',
    password: 'masterpassword',
    name: 'Master User'
  },
  secondary: {
    email: 'secondary@example.com',
    password: 'secondary123',
    name: 'Secondary User'
  }
};

const testInvoices = {
  minimal: {
    vessel: {
      name: 'Test Vessel',
      weight: '',
      beam: ''
    },
    customer: {
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      customerPhone: ''
    },
    scope: {
      markupRate: '2.5',
      isTaxable: false,
      lineItems: []
    },
    notes: {
      comments: []
    }
  },

  standard: {
    vessel: {
      name: 'Standard Test Vessel',
      weight: '1000',
      beam: '20'
    },
    customer: {
      customerName: 'Standard Customer',
      customerEmail: 'standard@example.com',
      customerPhone: '555-0123'
    },
    scope: {
      markupRate: '2.5',
      isTaxable: true,
      lineItems: [
        {
          id: 0,
          jobType: 'Manual Entry',
          itemType: 'Materials',
          description: 'Standard Service',
          manualCost: '100',
          laborHours: '',
          otHours: '',
          taxStatus: 'taxable',
          taxRate: 0.0875,
          markupType: 'preset',
          markupRate: '2.5',
          isMarkupExempt: false,
          taxAmount: 8.75
        }
      ]
    },
    notes: {
      comments: []
    }
  },

  complex: {
    vessel: {
      name: 'Complex Test Vessel XL',
      weight: '5000',
      beam: '45'
    },
    customer: {
      customerName: 'Complex Corporation LLC',
      customerEmail: 'complex@corporation.com',
      customerPhone: '555-COMPLEX'
    },
    scope: {
      markupRate: '3.0',
      isTaxable: true,
      lineItems: [
        {
          id: 0,
          jobType: 'Manual Entry',
          itemType: 'Materials',
          description: 'Premium Materials Package',
          manualCost: '500',
          laborHours: '',
          otHours: '',
          taxStatus: 'taxable',
          taxRate: 0.0875,
          markupType: 'preset',
          markupRate: '3.0',
          isMarkupExempt: false,
          taxAmount: 45.13
        },
        {
          id: 1,
          jobType: 'Manual Entry',
          itemType: 'Labor',
          description: 'Specialized Labor Services',
          manualCost: '',
          laborHours: '8',
          otHours: '2',
          taxStatus: 'taxable',
          taxRate: 0.0875,
          markupType: 'custom',
          markupRate: '4.0',
          isMarkupExempt: false,
          taxAmount: 91.00
        },
        {
          id: 2,
          jobType: 'Agent Services',
          itemType: 'Agent',
          description: 'Agent Coordination Services',
          manualCost: '',
          laborHours: '4',
          otHours: '0',
          taxStatus: 'non-taxable',
          taxRate: 0,
          markupType: 'exempt',
          markupRate: '0',
          isMarkupExempt: true,
          taxAmount: 0
        },
        {
          id: 3,
          jobType: 'Clearance Fee',
          itemType: 'Fee',
          description: 'Port Clearance Fees',
          manualCost: '200',
          laborHours: '',
          otHours: '',
          taxStatus: 'exempt',
          taxRate: 0,
          markupType: 'exempt',
          markupRate: '0',
          isMarkupExempt: true,
          taxAmount: 0
        }
      ]
    },
    notes: {
      comments: [
        {
          text: 'Initial complex invoice creation',
          timestamp: '2024-01-01T10:00:00.000Z',
          id: '1'
        }
      ]
    }
  },

  performanceTest: {
    vessel: {
      name: 'Performance Test Mega Vessel',
      weight: '10000',
      beam: '100'
    },
    customer: {
      customerName: 'Performance Testing Corporation International',
      customerEmail: 'performance.testing@mega-corp.international.com',
      customerPhone: '555-PERFORMANCE-TEST'
    },
    scope: {
      markupRate: '2.5',
      isTaxable: true,
      lineItems: [] // Will be populated dynamically in performance tests
    },
    notes: {
      comments: []
    }
  }
};

const testLineItems = {
  basic: {
    id: 0,
    jobType: 'Manual Entry',
    itemType: 'Materials',
    description: 'Basic Test Service',
    manualCost: '100',
    laborHours: '',
    otHours: '',
    taxStatus: 'taxable',
    taxRate: 0.0875,
    markupType: 'preset',
    markupRate: '2.5',
    isMarkupExempt: false,
    taxAmount: 8.75
  },

  labor: {
    id: 1,
    jobType: 'Manual Entry',
    itemType: 'Labor',
    description: 'Labor Services',
    manualCost: '',
    laborHours: '8',
    otHours: '2',
    taxStatus: 'taxable',
    taxRate: 0.0875,
    markupType: 'preset',
    markupRate: '2.5',
    isMarkupExempt: false,
    taxAmount: 91.00
  },

  agent: {
    id: 2,
    jobType: 'Agent Services',
    itemType: 'Agent',
    description: 'Agent Services',
    manualCost: '',
    laborHours: '4',
    otHours: '0',
    taxStatus: 'non-taxable',
    taxRate: 0,
    markupType: 'exempt',
    markupRate: '0',
    isMarkupExempt: true,
    taxAmount: 0
  },

  clearance: {
    id: 3,
    jobType: 'Clearance Fee',
    itemType: 'Fee',
    description: 'Clearance Fees',
    manualCost: '150',
    laborHours: '',
    otHours: '',
    taxStatus: 'exempt',
    taxRate: 0,
    markupType: 'exempt',
    markupRate: '0',
    isMarkupExempt: true,
    taxAmount: 0
  },

  custom: {
    id: 4,
    jobType: 'Manual Entry',
    itemType: 'Materials',
    description: 'Custom Markup Service',
    manualCost: '300',
    laborHours: '',
    otHours: '',
    taxStatus: 'taxable',
    taxRate: 0.0875,
    markupType: 'custom',
    markupRate: '5.0',
    isMarkupExempt: false,
    taxAmount: 27.56
  }
};

const testScenarios = {
  regression: {
    title: 'Regression Test Invoice',
    user: testUsers.regular,
    invoice: testInvoices.standard,
    modifications: {
      vessel: { name: 'Modified Vessel Name' },
      customer: { customerName: 'Modified Customer Name' },
      lineItems: [
        { index: 0, description: 'Modified Service Description', manualCost: '150' }
      ]
    }
  },

  performance: {
    title: 'Performance Test Invoice',
    user: testUsers.regular,
    invoice: testInvoices.performanceTest,
    itemCount: 50
  },

  concurrent: {
    scenarios: [
      {
        title: 'Concurrent Test 1',
        user: testUsers.regular,
        invoice: { ...testInvoices.standard, vessel: { ...testInvoices.standard.vessel, name: 'Concurrent Vessel 1' } }
      },
      {
        title: 'Concurrent Test 2',
        user: testUsers.regular,
        invoice: { ...testInvoices.standard, vessel: { ...testInvoices.standard.vessel, name: 'Concurrent Vessel 2' } }
      }
    ]
  },

  ownership: {
    owner: testUsers.regular,
    otherUser: testUsers.secondary,
    invoice: testInvoices.standard
  }
};

const apiEndpoints = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    register: '/api/auth/register'
  },
  invoices: {
    save: '/api/v2/invoice/save',
    smartSave: '/api/v3/invoices/smart-save',
    userInvoices: '/api/invoices/user',
    byId: (id) => `/api/v1/invoice/${id}`,
    delete: (id) => `/api/v1/invoice/${id}`
  },
  health: '/health'
};

const selectors = {
  // Form elements
  vessel: {
    name: '[data-testid="vessel-name"]',
    weight: '[data-testid="vessel-weight"]',
    beam: '[data-testid="vessel-beam"]'
  },
  customer: {
    name: '[data-testid="customer-name"]',
    email: '[data-testid="customer-email"]',
    phone: '[data-testid="customer-phone"]'
  },
  lineItems: {
    addButton: '[data-testid="add-line-item"]',
    description: (index) => `[data-testid="line-item-description-${index}"]`,
    cost: (index) => `[data-testid="manual-cost-${index}"]`,
    remove: (index) => `[data-testid="remove-line-item-${index}"]`
  },
  actions: {
    saveInvoice: '[data-testid="save-invoice-btn"]',
    newInvoice: '[data-testid="new-invoice-btn"]',
    saveAsNew: '[data-testid="save-as-new-btn"]'
  },
  modal: {
    titleInput: '[data-testid="invoice-title-input"]',
    confirmSave: '[data-testid="confirm-save-btn"]',
    cancelSave: '[data-testid="cancel-save-btn"]'
  },
  notifications: {
    success: '[data-testid="success-notification"]',
    error: '[data-testid="error-notification"]',
    warning: '[data-testid="warning-notification"]'
  },
  sidebar: {
    savedInvoices: '[data-testid="saved-invoices"]',
    invoiceItem: '[data-testid="saved-invoice-item"]'
  },
  auth: {
    email: '#email',
    password: '#password',
    loginBtn: '#loginBtn'
  }
};

const timeouts = {
  short: 2000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
  auth: 10000,
  save: 15000,
  performance: 60000
};

const performance = {
  limits: {
    initialSave: 5000,     // 5 seconds for first save
    updateSave: 3000,      // 3 seconds for updates
    uiResponse: 200,       // 200ms for UI responsiveness
    autoSave: 1000,        // 1 second for auto-save
    largeInvoiceSave: 10000, // 10 seconds for 50+ line items
    concurrentSave: 8000   // 8 seconds per operation under concurrency
  },
  metrics: {
    memoryLimit: 100 * 1024 * 1024, // 100MB
    maxLineItems: 50
  }
};

// Helper functions
const createPerformanceLineItems = (count) => {
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: i,
      jobType: 'Manual Entry',
      itemType: 'Materials',
      description: `Performance Test Item ${i + 1} - Detailed service description with comprehensive information`,
      manualCost: `${(i + 1) * 123.45}`,
      laborHours: '',
      otHours: '',
      taxStatus: 'taxable',
      taxRate: 0.0875,
      markupType: 'preset',
      markupRate: '2.5',
      isMarkupExempt: false,
      taxAmount: ((i + 1) * 123.45 * 1.025) * 0.0875
    });
  }
  return items;
};

const createTestInvoice = (baseInvoice, overrides = {}) => {
  return {
    ...baseInvoice,
    ...overrides,
    vessel: { ...baseInvoice.vessel, ...overrides.vessel },
    customer: { ...baseInvoice.customer, ...overrides.customer },
    scope: {
      ...baseInvoice.scope,
      ...overrides.scope,
      lineItems: overrides.scope?.lineItems || baseInvoice.scope.lineItems
    },
    notes: { ...baseInvoice.notes, ...overrides.notes }
  };
};

const generateInvoiceTitle = (prefix = 'Test', timestamp = true) => {
  const ts = timestamp ? ` ${new Date().toISOString().slice(0, 19).replace('T', ' ')}` : '';
  return `${prefix} Invoice${ts}`;
};

module.exports = {
  testUsers,
  testInvoices,
  testLineItems,
  testScenarios,
  apiEndpoints,
  selectors,
  timeouts,
  performance,
  helpers: {
    createPerformanceLineItems,
    createTestInvoice,
    generateInvoiceTitle
  }
};