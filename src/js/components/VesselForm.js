import { validateNumber } from '../state/validators.js';
import { CONSTANTS } from '../utils/constants.js';

export class VesselForm {
  constructor(state) {
    console.log('🚢 Initializing VesselForm...');
    this.state = state;
    this.initElements();
    this.attachListeners();
    console.log('✅ VesselForm initialized successfully');
  }
  
  initElements() {
    console.log('🔍 VesselForm: Finding DOM elements...');
    this.vesselName = document.getElementById('vessel-name');
    this.vesselWeight = document.getElementById('vessel-weight');
    this.vesselBeam = document.getElementById('vessel-beam');
    
    // Get the wrapper elements for suffix display
    this.weightWrapper = this.vesselWeight.parentElement;
    this.beamWrapper = this.vesselBeam.parentElement;
    
    console.log('📋 VesselForm DOM elements:');
    console.log('  - vesselName:', this.vesselName ? '✅' : '❌');
    console.log('  - vesselWeight:', this.vesselWeight ? '✅' : '❌');
    console.log('  - vesselBeam:', this.vesselBeam ? '✅' : '❌');
    console.log('  - weightWrapper:', this.weightWrapper ? '✅' : '❌');
    console.log('  - beamWrapper:', this.beamWrapper ? '✅' : '❌');
  }
  
  attachListeners() {
    this.vesselName.addEventListener('input', (e) => {
      this.state.updateVessel({ name: e.target.value });
    });
    
    // Add keydown event to prevent non-numeric input
    this.vesselWeight.addEventListener('keydown', (e) => {
      // Allow: backspace, delete, tab, escape, enter
      if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
          (e.keyCode === 65 && e.ctrlKey === true) ||
          (e.keyCode === 67 && e.ctrlKey === true) ||
          (e.keyCode === 86 && e.ctrlKey === true) ||
          (e.keyCode === 88 && e.ctrlKey === true) ||
          (e.keyCode === 90 && e.ctrlKey === true) ||
          // Allow: home, end, left, right, down, up
          (e.keyCode >= 35 && e.keyCode <= 40)) {
        return;
      }
      // Allow: decimal point, but only one
      if (e.keyCode === 190 || e.keyCode === 110) {
        if (e.target.value.indexOf('.') !== -1) {
          e.preventDefault();
          return;
        }
        return;
      }
      // Ensure that it's a number and stop the keypress
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    });

    // Add paste event validation
    this.vesselWeight.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      const numericValue = paste.replace(/[^\d.]/g, '');
      
      // Ensure only one decimal point
      const parts = numericValue.split('.');
      let cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;
      
      e.target.value = cleanValue;
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
    });

    this.vesselWeight.addEventListener('input', (e) => {
      const value = e.target.value;
      this.state.updateVessel({ weight: value });
      
      // Show/hide suffix based on whether there's a value
      if (value && value.trim() !== '') {
        this.weightWrapper.classList.add('has-value');
      } else {
        this.weightWrapper.classList.remove('has-value');
      }
      
      // Auto-manage clearance fee based on tonnage
      this.manageClearanceFee(value);
    });
    
    // Add keydown event to prevent non-numeric input
    this.vesselBeam.addEventListener('keydown', (e) => {
      // Allow: backspace, delete, tab, escape, enter
      if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
          (e.keyCode === 65 && e.ctrlKey === true) ||
          (e.keyCode === 67 && e.ctrlKey === true) ||
          (e.keyCode === 86 && e.ctrlKey === true) ||
          (e.keyCode === 88 && e.ctrlKey === true) ||
          (e.keyCode === 90 && e.ctrlKey === true) ||
          // Allow: home, end, left, right, down, up
          (e.keyCode >= 35 && e.keyCode <= 40)) {
        return;
      }
      // Allow: decimal point, but only one
      if (e.keyCode === 190 || e.keyCode === 110) {
        if (e.target.value.indexOf('.') !== -1) {
          e.preventDefault();
          return;
        }
        return;
      }
      // Ensure that it's a number and stop the keypress
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    });

    // Add paste event validation
    this.vesselBeam.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text');
      const numericValue = paste.replace(/[^\d.]/g, '');
      
      // Ensure only one decimal point
      const parts = numericValue.split('.');
      let cleanValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue;
      
      e.target.value = cleanValue;
      e.target.dispatchEvent(new Event('input', { bubbles: true }));
    });

    this.vesselBeam.addEventListener('input', (e) => {
      const value = e.target.value;
      this.state.updateVessel({ beam: value });
      
      // Show/hide suffix based on whether there's a value
      if (value && value.trim() !== '') {
        this.beamWrapper.classList.add('has-value');
      } else {
        this.beamWrapper.classList.remove('has-value');
      }
    });
  }
  
  populate(vesselData) {
    this.vesselName.value = vesselData.name || '';
    this.vesselWeight.value = vesselData.weight || '';
    this.vesselBeam.value = vesselData.beam || '';
    
    // Update suffix visibility for populated values
    if (vesselData.weight && vesselData.weight.trim() !== '') {
      this.weightWrapper.classList.add('has-value');
      // Also manage clearance fee when populating from saved data
      this.manageClearanceFee(vesselData.weight);
    } else {
      this.weightWrapper.classList.remove('has-value');
      // Remove clearance fee if no weight
      this.manageClearanceFee('');
    }
    
    if (vesselData.beam && vesselData.beam.trim() !== '') {
      this.beamWrapper.classList.add('has-value');
    } else {
      this.beamWrapper.classList.remove('has-value');
    }
  }
  
  manageClearanceFee(weight) {
    const state = this.state.getState();
    const lineItems = state.scope.lineItems || [];
    
    // Find existing clearance fee line item
    const existingClearanceIndex = lineItems.findIndex(item => 
      item.jobType === 'Clearance Fee' || item.description === 'Clearance Fee'
    );
    
    const weightNum = parseFloat(weight) || 0;
    
    if (weightNum > 0) {
      // Calculate appropriate clearance fee
      const clearanceFeeAmount = weightNum > CONSTANTS.WEIGHT_THRESHOLD 
        ? CONSTANTS.CLEARANCE_FEE_HIGH 
        : CONSTANTS.CLEARANCE_FEE_LOW;
      
      const clearanceFeeItem = {
        id: existingClearanceIndex >= 0 ? lineItems[existingClearanceIndex].id : Date.now(),
        jobType: 'Clearance Fee',
        description: `Clearance Fee (${weightNum > CONSTANTS.WEIGHT_THRESHOLD ? 'Over' : 'Under'} 500 tons)`,
        itemType: 'Administrative',
        manualCost: clearanceFeeAmount,
        cost: clearanceFeeAmount
      };
      
      if (existingClearanceIndex >= 0) {
        // Update existing clearance fee
        this.state.updateLineItem(clearanceFeeItem.id, clearanceFeeItem);
      } else {
        // Add new clearance fee
        this.state.addLineItem(clearanceFeeItem);
      }
    } else if (existingClearanceIndex >= 0) {
      // Remove clearance fee if weight is 0 or empty
      this.state.removeLineItem(lineItems[existingClearanceIndex].id);
    }
  }
}