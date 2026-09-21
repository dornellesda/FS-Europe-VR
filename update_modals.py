import re

with open("src/style.css", "r") as f:
    content = f.read()

new_modals = """/* Modals Overlay (2D Desktop Fallback) */
.modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(9, 9, 11, 0.45);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.exhibit-card, .qr-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-top: 1px solid var(--panel-border-top);
  border-radius: 32px;
  padding: 40px;
  max-width: 680px;
  width: 100%;
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  box-shadow: 
    0 40px 80px -12px rgba(0, 0, 0, 0.5),
    0 12px 32px -4px rgba(0, 0, 0, 0.3),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);
  animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slide-up {
  from { transform: translateY(30px) scale(0.97); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-badge {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--accent-cyan);
  background: rgba(56, 189, 248, 0.15);
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(56, 189, 248, 0.3);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
}

.card-badge.green {
  color: var(--accent-emerald);
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.3);
}

.close-overlay-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--text-muted);
  padding: 10px 16px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: var(--transition-fluid);
  backdrop-filter: blur(12px);
}

.close-overlay-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
  color: #fca5a5;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

.exhibit-card h2, .qr-info h2 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 14px;
  letter-spacing: -0.03em;
  color: #ffffff;
}

.card-description, .qr-desc {
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 24px;
}

.card-instructions {
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.15);
  padding: 16px 20px;
  border-radius: 16px;
  font-size: 14px;
  color: #bae6fd;
  margin-bottom: 24px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
}

.feature-buttons-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.modal-feature-btn {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.2));
  border: 1px solid rgba(99, 102, 241, 0.4);
  border-top: 1px solid rgba(99, 102, 241, 0.6);
  color: #ffffff;
  padding: 14px 24px;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: var(--transition-fluid);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.modal-feature-btn:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(56, 189, 248, 0.4));
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2);
  border-color: rgba(99, 102, 241, 0.6);
}

/* QR Card Body Layout */
.qr-body {
  display: flex;
  gap: 32px;
  align-items: center;
}

.qr-canvas-holder {
  background: #ffffff;
  padding: 16px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
}

.qr-canvas-holder canvas {
  display: block;
}

.qr-info {
  flex: 1;
}

.qr-url-box {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
}

.qr-url-box code {
  font-family: monospace;
  font-size: 14px;
  color: var(--accent-emerald);
  word-break: break-all;
}

.qr-actions {
  display: flex;
  gap: 14px;
}

.btn-primary-green {
  background: linear-gradient(135deg, #059669, #10b981);
  color: #ffffff;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.4);
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: var(--transition-fluid);
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.3);
}

.btn-primary-green:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(16, 185, 129, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, #047857, #059669);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f8fafc;
  padding: 12px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  transition: var(--transition-fluid);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}
"""

start_marker = "/* Modals Overlay (2D Desktop Fallback) */"
end_marker = "/* Calibration HUD */"
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    updated_content = content[:start_idx] + new_modals + "\n" + content[end_idx:]
    with open("src/style.css", "w") as f:
        f.write(updated_content)
    print("Successfully updated modals in style.css")
else:
    print("Could not find markers")
