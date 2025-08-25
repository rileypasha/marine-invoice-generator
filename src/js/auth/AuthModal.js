import logoUrl from '../../assets/logo.png';

export class AuthModal {
  constructor(userManager) {
    this.userManager = userManager;
    this.isVisible = false;
    this.mode = 'signin'; // 'signin' or 'signup'
    this.createModal();
    this.attachListeners();
  }
  
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'auth-modal';
    this.modal.innerHTML = `
      <div class="auth-modal-overlay">
        <div class="auth-modal-content">
          <button class="auth-modal-close">&times;</button>
          
          <div class="auth-header">
            <img src="${logoUrl}" alt="Marine Group" class="auth-logo">
            <h2 class="auth-title">Welcome to MG Global Invoices</h2>
            <p class="auth-subtitle">Sign in to save your invoices and access your history</p>
          </div>
          
          <div class="auth-tabs">
            <button class="auth-tab active" data-mode="signin">Sign In</button>
            <button class="auth-tab" data-mode="signup">Create Account</button>
          </div>
          
          <form class="auth-form">
            <div class="auth-error" style="display: none;"></div>
            
            <div class="form-group" id="name-group" style="display: none;">
              <label for="auth-name">Full Name</label>
              <input type="text" id="auth-name" placeholder="Enter your full name">
            </div>
            
            <div class="form-group">
              <label for="auth-email">Email</label>
              <input type="email" id="auth-email" placeholder="Enter your email" required>
            </div>
            
            <div class="form-group password-group">
              <label for="auth-password">Password</label>
              <div class="password-input-wrapper">
                <input type="password" id="auth-password" placeholder="Enter your password" required>
                <button type="button" class="password-toggle" data-target="auth-password">
                  <svg class="eye-icon eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg class="eye-icon eye-closed" style="display: none;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="form-group password-group" id="confirm-password-group" style="display: none;">
              <label for="auth-confirm-password">Confirm Password</label>
              <div class="password-input-wrapper">
                <input type="password" id="auth-confirm-password" placeholder="Confirm your password">
                <button type="button" class="password-toggle" data-target="auth-confirm-password">
                  <svg class="eye-icon eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  <svg class="eye-icon eye-closed" style="display: none;" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="form-group remember-me" id="remember-group">
              <label class="checkbox-label">
                <input type="checkbox" id="auth-remember">
                <span class="checkbox-custom"></span>
                <span class="checkbox-text">Remember me</span>
              </label>
            </div>
            
            <button type="submit" class="auth-submit-btn">
              <span class="btn-text">Sign In</span>
              <span class="btn-loading" style="display: none;">
                <div class="loading-spinner"></div>
                Signing in...
              </span>
            </button>
          </form>
          
          <div class="auth-footer">
            <p class="auth-switch">
              <span class="switch-text">Don't have an account?</span>
              <button class="auth-switch-btn" data-mode="signup">Create one</button>
            </p>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.modal);
  }
  
  attachListeners() {
    // Modern input interactions
    this.setupModernInputs();
    
    // Password visibility toggles
    this.setupPasswordToggles();
    
    // Close modal
    this.modal.querySelector('.auth-modal-close').addEventListener('click', () => {
      this.hide();
    });
    
    this.modal.querySelector('.auth-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.hide();
      }
    });
    
    // Tab switching
    this.modal.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        this.switchMode(mode);
      });
    });
    
    // Switch button
    this.modal.querySelector('.auth-switch-btn').addEventListener('click', () => {
      const newMode = this.mode === 'signin' ? 'signup' : 'signin';
      this.switchMode(newMode);
    });
    
    // Form submission
    this.modal.querySelector('.auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }
  
  switchMode(mode) {
    this.mode = mode;
    
    // Update tabs
    this.modal.querySelectorAll('.auth-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    
    // Update form
    const nameGroup = this.modal.querySelector('#name-group');
    const nameInput = this.modal.querySelector('#auth-name');
    const confirmGroup = this.modal.querySelector('#confirm-password-group');
    const confirmInput = this.modal.querySelector('#auth-confirm-password');
    const rememberGroup = this.modal.querySelector('#remember-group');
    const submitBtn = this.modal.querySelector('.btn-text');
    const switchText = this.modal.querySelector('.switch-text');
    const switchBtn = this.modal.querySelector('.auth-switch-btn');
    
    if (mode === 'signup') {
      nameGroup.style.display = 'block';
      nameInput.setAttribute('required', '');
      confirmGroup.style.display = 'block';
      confirmInput.setAttribute('required', '');
      rememberGroup.style.display = 'none';
      submitBtn.textContent = 'Create Account';
      switchText.textContent = 'Already have an account?';
      switchBtn.textContent = 'Sign in';
      switchBtn.dataset.mode = 'signin';
    } else {
      nameGroup.style.display = 'none';
      nameInput.removeAttribute('required');
      confirmGroup.style.display = 'none';
      confirmInput.removeAttribute('required');
      rememberGroup.style.display = 'block';
      submitBtn.textContent = 'Sign In';
      switchText.textContent = "Don't have an account?";
      switchBtn.textContent = 'Create one';
      switchBtn.dataset.mode = 'signup';
    }
    
    this.clearError();
  }
  
  async handleSubmit() {
    console.log('🔐 Form submission started, mode:', this.mode);
    
    const email = this.modal.querySelector('#auth-email').value.trim();
    const password = this.modal.querySelector('#auth-password').value;
    const name = this.modal.querySelector('#auth-name').value.trim();
    const confirmPassword = this.modal.querySelector('#auth-confirm-password').value;
    const rememberMe = this.modal.querySelector('#auth-remember').checked;
    
    console.log('📝 Form data:', { email: email ? 'provided' : 'missing', password: password ? 'provided' : 'missing', name: name || 'N/A', rememberMe });
    
    // Basic validation
    if (!email || !password) {
      this.showError('Please fill in all required fields');
      return;
    }
    
    if (this.mode === 'signup') {
      if (!name) {
        this.showError('Please enter your full name');
        return;
      }
      
      if (password !== confirmPassword) {
        this.showError('Passwords do not match');
        return;
      }
      
      if (password.length < 6) {
        this.showError('Password must be at least 6 characters long');
        return;
      }
    }
    
    this.setLoading(true);
    this.clearError();
    
    try {
      console.log('🔄 Calling UserManager...');
      let result;
      if (this.mode === 'signup') {
        result = await this.userManager.register(email, password, name);
      } else {
        result = await this.userManager.signIn(email, password, rememberMe);
      }
      
      console.log('📋 Auth result:', result);
      
      if (result && result.success) {
        console.log('✅ Authentication successful');
        // Show success message briefly before hiding
        this.showSuccess(`Welcome, ${result.user.name}!`);
        
        setTimeout(() => {
          this.hide();
          this.clearForm();
        }, 1000);
      } else {
        console.log('❌ Authentication failed:', result?.error || 'Unknown error');
        this.showError(result?.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('💥 Authentication error:', error);
      this.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }
  
  setLoading(loading) {
    console.log('🔄 Setting loading state:', loading);
    
    const btnText = this.modal.querySelector('.btn-text');
    const btnLoading = this.modal.querySelector('.btn-loading');
    const submitBtn = this.modal.querySelector('.auth-submit-btn');
    
    if (!btnText || !btnLoading || !submitBtn) {
      console.error('❌ Could not find button elements for loading state');
      return;
    }
    
    if (loading) {
      btnText.style.display = 'none';
      btnLoading.style.display = 'flex';
      submitBtn.disabled = true;
      submitBtn.classList.add('loading');
    } else {
      btnText.style.display = 'block';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  }
  
  showError(message) {
    const errorDiv = this.modal.querySelector('.auth-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.background = 'rgba(239, 68, 68, 0.1)';
    errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    errorDiv.style.color = '#ef4444';
  }
  
  showSuccess(message) {
    const errorDiv = this.modal.querySelector('.auth-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.background = 'rgba(34, 197, 94, 0.1)';
    errorDiv.style.borderColor = 'rgba(34, 197, 94, 0.2)';
    errorDiv.style.color = '#22c55e';
  }
  
  clearError() {
    const errorDiv = this.modal.querySelector('.auth-error');
    errorDiv.style.display = 'none';
  }
  
  clearForm() {
    this.modal.querySelector('#auth-name').value = '';
    this.modal.querySelector('#auth-email').value = '';
    this.modal.querySelector('#auth-password').value = '';
    this.modal.querySelector('#auth-confirm-password').value = '';
    this.modal.querySelector('#auth-remember').checked = false;
    this.clearError();
  }
  
  show(mode = 'signin') {
    console.log('🔐 AuthModal.show() called with mode:', mode);
    try {
      this.switchMode(mode);
      this.modal.style.display = 'flex';
      this.modal.classList.add('show');
      this.isVisible = true;
      console.log('✅ Modal display and classes set');
      
      // Focus first input
      setTimeout(() => {
        const firstInput = this.modal.querySelector(mode === 'signup' ? '#auth-name' : '#auth-email');
        if (firstInput) {
          firstInput.focus();
          console.log('✅ Input focused');
        } else {
          console.warn('⚠️ Could not find input to focus');
        }
      }, 100);
    } catch (error) {
      console.error('❌ Error in AuthModal.show():', error);
    }
  }
  
  hide() {
    console.log('🔐 AuthModal.hide() called');
    this.modal.classList.remove('show');
    this.isVisible = false;
    
    // Delay hiding to allow transition
    setTimeout(() => {
      this.modal.style.display = 'none';
      this.clearForm();
    }, 300);
  }
  
  setupModernInputs() {
    const inputs = this.modal.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    
    inputs.forEach(input => {
      const formGroup = input.closest('.form-group');
      
      // Focus and blur events for modern styling
      input.addEventListener('focus', () => {
        formGroup.classList.add('focused');
      });
      
      input.addEventListener('blur', () => {
        formGroup.classList.remove('focused');
        if (input.value.trim()) {
          formGroup.classList.add('filled');
        } else {
          formGroup.classList.remove('filled');
        }
      });
      
      // Input event for real-time validation feedback
      input.addEventListener('input', () => {
        if (input.value.trim()) {
          formGroup.classList.add('filled');
        } else {
          formGroup.classList.remove('filled');
        }
        
        // Remove error class on input
        input.classList.remove('error');
      });
    });
    
    // Enhanced checkbox functionality
    this.setupCheckboxes();
  }
  
  setupCheckboxes() {
    const checkboxes = this.modal.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      const label = checkbox.closest('.checkbox-label');
      
      // Keyboard support
      checkbox.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
      
      // Click on label should toggle checkbox
      if (label) {
        label.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            e.preventDefault();
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
          }
        });
      }
      
      // Change event for debugging
      checkbox.addEventListener('change', () => {
        console.log('🔲 Checkbox state changed:', checkbox.id, checkbox.checked);
      });
    });
  }
  
  setupPasswordToggles() {
    const toggleButtons = this.modal.querySelectorAll('.password-toggle');
    
    toggleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        const input = this.modal.querySelector(`#${targetId}`);
        const eyeOpen = button.querySelector('.eye-open');
        const eyeClosed = button.querySelector('.eye-closed');
        
        if (input.type === 'password') {
          input.type = 'text';
          eyeOpen.style.display = 'none';
          eyeClosed.style.display = 'block';
        } else {
          input.type = 'password';
          eyeOpen.style.display = 'block';
          eyeClosed.style.display = 'none';
        }
      });
    });
  }
}