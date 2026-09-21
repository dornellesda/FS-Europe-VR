export class AuthModal {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.container = document.createElement('div');
    this.container.id = 'auth-modal-overlay';
    this.container.className = 'modal-overlay auth-overlay';
    this.container.style.display = 'none';

    document.body.appendChild(this.container);
    this.setupUI();
    this.bindEvents();
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="modal-content auth-content" style="max-width: 400px; text-align: center;">
        <h2 style="margin-bottom: 20px; color: #1e293b;">Admin Access</h2>
        <p style="color: #64748b; margin-bottom: 30px; font-size: 0.9em;">Please enter the password to access the Creator Studio.</p>
        
        <div class="input-group" style="margin-bottom: 20px; text-align: left;">
          <label style="display: block; margin-bottom: 8px; color: #475569; font-weight: 500;">Password</label>
          <input type="password" id="auth-password" class="auth-input" placeholder="Enter password..." style="width: 100%; padding: 12px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; color: #1e293b; font-size: 16px;">
          <div id="auth-error" style="color: #ef4444; margin-top: 8px; font-size: 0.8em; display: none;">Incorrect password.</div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 30px;">
          <button class="btn-primary" id="btn-auth-login" style="flex: 1; padding: 12px; border-radius: 8px; font-weight: 600;">Login</button>
          <button class="btn-secondary" id="btn-auth-cancel" style="padding: 12px 20px; border-radius: 8px;">Cancel</button>
        </div>
      </div>
    `;
    
    // Add some quick CSS for auth
    const style = document.createElement('style');
    style.textContent = `
      .auth-overlay {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(255, 255, 255, 0.4);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .auth-content {
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 16px;
        padding: 40px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
        color: #1e293b;
        font-family: 'Noto Sans', sans-serif;
      }
      .auth-input:focus {
        outline: none;
        border-color: #87b940;
        box-shadow: 0 0 0 2px rgba(135, 185, 64, 0.2);
      }
      .btn-primary {
        background: #87b940;
        color: white;
        border: none;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn-primary:hover {
        background: #75a334;
      }
      .btn-secondary {
        background: rgba(0,0,0,0.05);
        color: #1e293b;
        border: none;
        cursor: pointer;
        transition: background 0.2s;
      }
      .btn-secondary:hover {
        background: rgba(0,0,0,0.1);
      }
    `;
    document.head.appendChild(style);
  }

  bindEvents() {
    const loginBtn = document.getElementById('btn-auth-login');
    const cancelBtn = document.getElementById('btn-auth-cancel');
    const passInput = document.getElementById('auth-password');

    loginBtn.onclick = () => this.attemptLogin();
    cancelBtn.onclick = () => this.close();
    
    passInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.attemptLogin();
      }
    });
  }

  attemptLogin() {
    const passInput = document.getElementById('auth-password');
    const errorMsg = document.getElementById('auth-error');
    
    // Simple frontend lock: admin123
    if (passInput.value === 'admin123') {
      errorMsg.style.display = 'none';
      passInput.value = '';
      this.close();
      if (this.onSuccess) this.onSuccess();
    } else {
      errorMsg.style.display = 'block';
    }
  }

  open() {
    this.container.style.display = 'flex';
    setTimeout(() => {
      document.getElementById('auth-password').focus();
    }, 100);
  }

  close() {
    this.container.style.display = 'none';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').style.display = 'none';
  }
}
