import { validateNumber } from '../state/validators.js';

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
    
    this.vesselWeight.addEventListener('input', (e) => {
      const value = e.target.value;
      this.state.updateVessel({ weight: value });
      
      // Show/hide suffix based on whether there's a value
      if (value && value.trim() !== '') {
        this.weightWrapper.classList.add('has-value');
      } else {
        this.weightWrapper.classList.remove('has-value');
      }
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
    } else {
      this.weightWrapper.classList.remove('has-value');
    }
    
    if (vesselData.beam && vesselData.beam.trim() !== '') {
      this.beamWrapper.classList.add('has-value');
    } else {
      this.beamWrapper.classList.remove('has-value');
    }
  }
}