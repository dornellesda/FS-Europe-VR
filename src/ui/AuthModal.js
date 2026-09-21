import { supabase } from '../config/supabaseClient.js';

export class AuthModal {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.container = document.createElement('div');
    this.container.id = 'auth-modal-overlay';
    this.container.className = 'modal-overlay';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);
    this.setupUI();
    this.bindEvents();
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="exhibit-card auth-card" style="max-width: 440px; text-align: center; padding: 48px 40px;">
        <h2 style="margin-bottom: 16px; color: #ffffff; font-size: 28px;">Admin Login</h2>
        <p style="color: var(--text-muted); margin-bottom: 32px; font-size: 15px;">Authenticate to access the Creator Studio.</p>
        
        <div style="margin-bottom: 20px; text-align: left;">
          <label style="display: block; margin-bottom: 8px; color: #94a3b8; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase;">Email Address</label>
          <input type="email" id="auth-email" class="auth-input" placeholder="admin@example.com">
        </div>

        <div style="margin-bottom: 24px; text-align: left;">
          <label style="display: block; margin-bottom: 8px; color: #94a3b8; font-weight: 600; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase;">Password</label>
          <input type="password" id="auth-password" class="auth-input" placeholder="Enter password...">
          <div id="auth-error" style="color: #f87171; margin-top: 12px; font-size: 14px; display: none; background: rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);">Invalid credentials.</div>
        </div>

        <div style="display: flex; gap: 14px; justify-content: center; margin-top: 36px;">
          <button class="btn-primary-green" id="btn-auth-login" style="flex: 1; justify-content: center; padding: 14px;">Sign In</button>
          <button class="btn-secondary" id="btn-auth-cancel" style="padding: 14px 24px;">Cancel</button>
        </div>
      </div>
    `;
    
    // Add specific auth CSS
    const style = document.createElement('style');
    style.textContent = `
      .auth-input {
        width: 100%; 
        padding: 14px 16px; 
        background: rgba(15, 23, 42, 0.5); 
        border: 1px solid rgba(255, 255, 255, 0.15); 
        border-radius: 12px; 
        color: #ffffff; 
        font-size: 15px;
        font-family: var(--font-family);
        transition: var(--transition-fluid);
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .auth-input:focus {
        outline: none;
        border-color: var(--accent-cyan);
        background: rgba(15, 23, 42, 0.8);
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2), inset 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      .auth-input::placeholder {
        color: #475569;
      }
    `;
    document.head.appendChild(style);
  }

  bindEvents() {
    const loginBtn = document.getElementById('btn-auth-login');
    const cancelBtn = document.getElementById('btn-auth-cancel');
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');

    loginBtn.onclick = () => this.attemptLogin();
    cancelBtn.onclick = () => this.close();
    
    const onEnter = (e) => {
      if (e.key === 'Enter') {
        this.attemptLogin();
      }
    };
    
    emailInput.addEventListener('keydown', onEnter);
    passInput.addEventListener('keydown', onEnter);
  }

  async attemptLogin() {
    const emailInput = document.getElementById('auth-email');
    const passInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');
    const loginBtn = document.getElementById('btn-auth-login');
    
    if (!supabase) {
      errorMsg.textContent = "Supabase is not configured. Admin login unavailable.";
      errorMsg.style.display = 'block';
      return;
    }

    loginBtn.textContent = 'Authenticating...';
    loginBtn.style.opacity = '0.7';
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passInput.value
      });

      if (error) {
        throw error;
      }

      // Success
      passInput.value = '';
      this.close();
      if (this.onSuccess) this.onSuccess();
    } catch (err) {
      errorMsg.textContent = err.message || "Invalid login credentials.";
      errorMsg.style.display = 'block';
    } finally {
      loginBtn.textContent = 'Sign In';
      loginBtn.style.opacity = '1';
      loginBtn.disabled = false;
    }
  }

  open() {
    this.container.style.display = 'flex';
    // Small delay to allow display block to apply before adding active class for animation
    setTimeout(() => {
      this.container.classList.add('active');
      document.getElementById('auth-email').focus();
    }, 10);
  }

  close() {
    this.container.classList.remove('active');
    setTimeout(() => {
      this.container.style.display = 'none';
      document.getElementById('auth-password').value = '';
      document.getElementById('auth-error').style.display = 'none';
    }, 400); // Wait for transition
  }
}

