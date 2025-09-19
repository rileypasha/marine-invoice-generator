import { validateNumber } from '../state/validators.js';
import { CONSTANTS } from '../utils/constants.js';
import { safeString, normalizeSessionData } from '../utils/safeString.js';
import { VesselSelector } from './VesselSelector.js';

export class VesselForm {
  constructor(state) {
    console.log('🚢 Initializing VesselForm...');
    this.state = state;
    this.vesselSelector = null;
    this.linkedVessel = null;
    this.initElements();
    this.initVesselSelector();
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

  initVesselSelector() {
    console.log('🔍 VesselForm: Initializing vessel selector...');

    // Check if vessel selector container exists
    const selectorContainer = document.getElementById('vessel-selector-container');
    if (!selectorContainer) {
      console.log('⚠️ Vessel selector container not found, skipping vessel selector initialization');
      return;
    }

    try {
      this.vesselSelector = new VesselSelector({
        containerId: 'vessel-selector-container',
        onSelect: (vessel) => this.handleVesselSelect(vessel),
        onUnlink: () => this.handleVesselUnlink()
      });

      console.log('✅ Vessel selector initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize vessel selector:', error);
    }
  }

  handleVesselSelect(vessel) {
    console.log('🚢 Vessel selected:', vessel);

    this.linkedVessel = vessel;

    // Autofill vessel form fields
    this.autofillFromVessel(vessel);

    // Update state with vessel link
    this.state.updateVessel({
      id: vessel.id,
      name: vessel.name,
      weight: vessel.weight_tons || '',
      beam: vessel.beam_ft || ''
    });
  }

  handleVesselUnlink() {
    console.log('🔗 Vessel unlinked');

    this.linkedVessel = null;

    // Clear vessel ID from state but keep the field values
    this.state.updateVessel({
      id: null
    });
  }

  autofillFromVessel(vessel) {
    console.log('🔄 Autofilling vessel data from:', vessel.name);

    // Populate form fields
    if (this.vesselName && vessel.name) {
      this.vesselName.value = vessel.name;
    }

    if (this.vesselWeight && vessel.weight_tons) {
      this.vesselWeight.value = vessel.weight_tons;
      this.weightWrapper?.classList.add('has-value');
      // Trigger weight change for clearance fee calculation
      this.manageClearanceFee(vessel.weight_tons);
    }

    if (this.vesselBeam && vessel.beam_ft) {
      this.vesselBeam.value = vessel.beam_ft;
      this.beamWrapper?.classList.add('has-value');
    }

    // Trigger input events to update state
    this.vesselName?.dispatchEvent(new Event('input', { bubbles: true }));
    this.vesselWeight?.dispatchEvent(new Event('input', { bubbles: true }));
    this.vesselBeam?.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  attachListeners() {
    console.log('🔗 VesselForm: Attaching event listeners...');
    
    if (!this.vesselName || !this.vesselWeight || !this.vesselBeam) {
      console.error('❌ VesselForm: Cannot attach listeners, some elements are missing');
      return;
    }
    
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
      // 🔧 PHASE 2 FIX: Type-safe string coercion before .trim()
      const safeValue = String(value || '');
      if (safeValue.trim() !== '') {
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
      // 🔧 PHASE 2 FIX: Type-safe string coercion before .trim()
      const safeValue = String(value || '');
      if (safeValue.trim() !== '') {
        this.beamWrapper.classList.add('has-value');
      } else {
        this.beamWrapper.classList.remove('has-value');
      }
    });
  }
  
  populate(vesselData) {
    console.log('🔄 VesselForm: Populating data...', vesselData);

    if (!this.vesselName || !this.vesselWeight || !this.vesselBeam) {
      console.error('❌ VesselForm: Cannot populate, some elements are missing');
      return;
    }

    // 🔧 PHASE 2 FIX: Normalize vessel data to prevent type errors during session restore
    const normalizedData = {
      id: vesselData.id || null,
      name: safeString(vesselData.name),
      weight: safeString(vesselData.weight),
      beam: safeString(vesselData.beam)
    };

    // If there's a vessel ID, try to restore the linked vessel state
    if (normalizedData.id && this.vesselSelector) {
      console.log('🔗 Restoring linked vessel state for ID:', normalizedData.id);
      this.restoreLinkedVessel(normalizedData.id, normalizedData);
    }

    this.vesselName.value = normalizedData.name;
    this.vesselWeight.value = normalizedData.weight;
    this.vesselBeam.value = normalizedData.beam;

    // Update suffix visibility for populated values
    if (normalizedData.weight !== '') {
      if (this.weightWrapper) {
        this.weightWrapper.classList.add('has-value');
      }
      // Also manage clearance fee when populating from saved data
      this.manageClearanceFee(normalizedData.weight);
    } else {
      if (this.weightWrapper) {
        this.weightWrapper.classList.remove('has-value');
      }
      // Remove clearance fee if no weight
      this.manageClearanceFee('');
    }

    if (normalizedData.beam !== '') {
      if (this.beamWrapper) {
        this.beamWrapper.classList.add('has-value');
      }
    } else {
      if (this.beamWrapper) {
        this.beamWrapper.classList.remove('has-value');
      }
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
        cost: clearanceFeeAmount,
        taxStatus: 'non-taxable',
        taxRate: 0,
        taxAmount: 0
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

  async restoreLinkedVessel(vesselId, vesselData) {
    try {
      // Try to fetch the full vessel data from the API
      const response = await fetch(`/api/vessels/${vesselId}`);
      if (response.ok) {
        const vessel = await response.json();
        this.linkedVessel = vessel;
        this.vesselSelector.setLinkedVessel(vessel);
        console.log('✅ Linked vessel restored:', vessel.name);
      } else {
        console.log('⚠️ Could not fetch linked vessel, using local data');
        // Create a minimal vessel object from available data
        this.linkedVessel = {
          id: vesselId,
          name: vesselData.name,
          weight_tons: vesselData.weight,
          beam_ft: vesselData.beam
        };
        this.vesselSelector.setLinkedVessel(this.linkedVessel);
      }
    } catch (error) {
      console.error('❌ Error restoring linked vessel:', error);
      // Fallback to local data
      this.linkedVessel = {
        id: vesselId,
        name: vesselData.name,
        weight_tons: vesselData.weight,
        beam_ft: vesselData.beam
      };
      this.vesselSelector.setLinkedVessel(this.linkedVessel);
    }
  }

  getLinkedVessel() {
    return this.linkedVessel;
  }

  getVesselData() {
    return {
      id: this.linkedVessel?.id || null,
      name: this.vesselName?.value || '',
      weight: this.vesselWeight?.value || '',
      beam: this.vesselBeam?.value || ''
    };
  }

  destroy() {
    // Clean up vessel selector
    if (this.vesselSelector) {
      this.vesselSelector.destroy();
      this.vesselSelector = null;
    }

    // Clear references
    this.linkedVessel = null;
    this.state = null;
  }
}