import { SettingsModal } from '../../src/js/settings/SettingsModal.js';
import { PromptModal } from '../../src/js/components/PromptModal.js';

describe('SettingsModal Sign Out', () => {
  let settingsModal;
  let mockUserManager;
  let mockThemeManager;
  
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    
    // Mock user manager
    mockUserManager = {
      logout: jest.fn(),
      isAuthenticated: jest.fn(() => true),
      getCurrentUser: jest.fn(() => ({
        name: 'Test User',
        email: 'test@example.com'
      })),
      subscribe: jest.fn()
    };
    
    // Mock theme manager
    mockThemeManager = {
      getTheme: jest.fn(() => 'dark'),
      subscribe: jest.fn()
    };
    
    // Create settings modal instance
    settingsModal = new SettingsModal(mockUserManager, mockThemeManager);
  });
  
  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  test('should show custom modal on sign out click', async () => {
    const spy = jest.spyOn(settingsModal.promptModal, 'showConfirm');
    
    await settingsModal.handleSignOut();
    
    expect(spy).toHaveBeenCalledWith(
      'Sign Out',
      'Are you sure you want to sign out?',
      'Yes, Sign Out',
      'Cancel'
    );
  });

  test('should call logout when confirmed', async () => {
    // Mock confirmation
    jest.spyOn(settingsModal.promptModal, 'showConfirm')
      .mockResolvedValue(true);
    
    // Mock hide and showNotification
    jest.spyOn(settingsModal, 'hide').mockImplementation(() => {});
    jest.spyOn(settingsModal, 'showNotification').mockImplementation(() => {});
    
    await settingsModal.handleSignOut();
    
    expect(mockUserManager.logout).toHaveBeenCalled();
    expect(settingsModal.hide).toHaveBeenCalled();
    expect(settingsModal.showNotification).toHaveBeenCalledWith(
      'Signed out successfully', 
      'info'
    );
  });

  test('should not logout when cancelled', async () => {
    // Mock cancellation
    jest.spyOn(settingsModal.promptModal, 'showConfirm')
      .mockResolvedValue(false);
    
    // Mock hide and showNotification
    jest.spyOn(settingsModal, 'hide').mockImplementation(() => {});
    jest.spyOn(settingsModal, 'showNotification').mockImplementation(() => {});
    
    await settingsModal.handleSignOut();
    
    expect(mockUserManager.logout).not.toHaveBeenCalled();
    expect(settingsModal.hide).not.toHaveBeenCalled();
    expect(settingsModal.showNotification).not.toHaveBeenCalled();
  });
  
  test('should not call browser confirm', async () => {
    // Track if window.confirm is called
    const originalConfirm = window.confirm;
    let confirmCalled = false;
    window.confirm = jest.fn(() => {
      confirmCalled = true;
      return true;
    });
    
    // Mock promptModal to resolve
    jest.spyOn(settingsModal.promptModal, 'showConfirm')
      .mockResolvedValue(true);
    
    await settingsModal.handleSignOut();
    
    expect(confirmCalled).toBe(false);
    expect(window.confirm).not.toHaveBeenCalled();
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });

  test('should handle errors gracefully', async () => {
    // Mock confirmation
    jest.spyOn(settingsModal.promptModal, 'showConfirm')
      .mockResolvedValue(true);
    
    // Mock logout to throw error
    mockUserManager.logout = jest.fn(() => {
      throw new Error('Logout failed');
    });
    
    // Mock hide and showNotification
    jest.spyOn(settingsModal, 'hide').mockImplementation(() => {});
    jest.spyOn(settingsModal, 'showNotification').mockImplementation(() => {});
    
    // Should not throw
    await expect(settingsModal.handleSignOut()).rejects.toThrow('Logout failed');
  });
});

describe('PromptModal Custom Button Text', () => {
  let promptModal;
  
  beforeEach(() => {
    document.body.innerHTML = '';
    promptModal = new PromptModal();
  });
  
  afterEach(() => {
    promptModal.destroy();
    document.body.innerHTML = '';
  });
  
  test('should accept custom button text for confirm dialog', async () => {
    const promise = promptModal.showConfirm(
      'Custom Title',
      'Custom Message',
      'Custom Confirm',
      'Custom Cancel'
    );
    
    // Allow modal to render
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const confirmBtn = document.querySelector('.prompt-modal-confirm');
    const cancelBtn = document.querySelector('.prompt-modal-cancel');
    
    expect(confirmBtn.textContent).toBe('Custom Confirm');
    expect(cancelBtn.textContent).toBe('Custom Cancel');
    
    // Close modal
    promptModal.close(false);
    await promise;
  });
  
  test('should use default button text when not provided', async () => {
    const promise = promptModal.showConfirm(
      'Default Test',
      'Testing defaults'
    );
    
    // Allow modal to render
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const confirmBtn = document.querySelector('.prompt-modal-confirm');
    const cancelBtn = document.querySelector('.prompt-modal-cancel');
    
    expect(confirmBtn.textContent).toBe('Continue');
    expect(cancelBtn.textContent).toBe('Cancel');
    
    // Close modal
    promptModal.close(false);
    await promise;
  });
});