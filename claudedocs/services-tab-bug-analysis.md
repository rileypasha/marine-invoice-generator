# Services Tab Bug Analysis

## **PHASE 1: Root Cause Investigation**

### **Issue Summary**
TypeError: Cannot read properties of undefined (reading 'lineItems')
- Bundle location: main.bundle.js:2:327066
- Occurs when clicking "Add Line Item" button
- Happens for both new and existing invoices

### **Key Finding**
State structure mismatch detected:
- **State uses**: `scope.lineItems` (in InvoiceState.js)
- **Error suggests**: `services.lineItems` being accessed

### **Investigation Steps**
1. ✅ Examined ScopeForm.js - Add Line Item button handler looks correct
2. ✅ Examined InvoiceState.js - State structure uses `scope.lineItems`
3. 🔍 **NEXT**: Search for all "services" references in codebase
4. 🔍 **NEXT**: Map bundle error to source code location
5. 🔍 **NEXT**: Check for data normalization issues

### **Hypothesis**
There's likely some code that expects a `services` object but the state only provides `scope`. This could be:
- Legacy code not updated to new structure
- Incorrect data transformation
- Missing state normalization for legacy invoices

### **State Structure Analysis**
```javascript
// ACTUAL state structure (InvoiceState.js)
state: {
  vessel: { name, weight, beam },
  customer: { customerName, customerEmail, customerPhone },
  scope: { markupRate, isTaxable, lineItems: [] },  // ← lineItems here
  notes: { comments: [] }
}

// ERROR suggests this structure is expected somewhere:
state: {
  services: { lineItems: [] }  // ← This doesn't exist!
}
```

### **Next Actions**
1. Search entire codebase for "services" references
2. Map bundle error line to actual source code
3. Check data transformation/normalization logic
4. Implement state guard to ensure services.lineItems exists