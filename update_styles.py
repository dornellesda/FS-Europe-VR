import re

with open("src/style.css", "r") as f:
    content = f.read()

# Define the new styles
new_styles = """:root {
  --bg-dark: #09090b;
  --panel-bg: rgba(15, 23, 42, 0.65);
  --panel-border: rgba(255, 255, 255, 0.12);
  --panel-border-top: rgba(255, 255, 255, 0.25);
  --panel-glow: rgba(99, 102, 241, 0.15);
  --accent-cyan: #38bdf8;
  --accent-blue: #6366f1;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --transition-fluid: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-dark);
  font-family: var(--font-family);
  color: var(--text-main);
  touch-action: none;
}

#canvas-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* Three.js VR Button Customization */
#vr-button-element {
  position: absolute !important;
  bottom: 24px !important;
  right: 24px !important;
  left: auto !important;
  width: auto !important;
  min-width: 140px !important;
  padding: 12px 24px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  line-height: 1.25 !important;
  background: var(--panel-bg) !important;
  border: 1px solid var(--panel-border) !important;
  border-top: 1px solid var(--panel-border-top) !important;
  border-radius: 9999px !important;
  color: #ffffff !important;
  font-family: var(--font-family) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(24px) saturate(180%) !important;
  transition: var(--transition-fluid) !important;
  z-index: 9999 !important;
}

#vr-button-element:hover {
  transform: translateY(-2px) scale(1.02) !important;
  background: rgba(30, 41, 59, 0.75) !important;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px var(--panel-glow), inset 0 1px 1px rgba(255, 255, 255, 0.2) !important;
  border-color: rgba(99, 102, 241, 0.4) !important;
}

/* Floating UI Overlay - VisionOS Aesthetic */
#video-hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: var(--font-family);
  transition: opacity 0.4s ease;
}

/* Automatically hide all 2D HUD UI during immersive VR mode */
body.in-vr-session #video-hud,
body.in-vr-session #calibration-hud,
body.in-vr-session #exhibit-modal-overlay,
body.in-vr-session #qr-modal-overlay {
  display: none !important;
  pointer-events: none !important;
}

/* Top Navigation Bar */
.hud-top-bar {
  position: absolute;
  top: 24px;
  left: 32px;
  right: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 20;
  pointer-events: none;
}

.hud-brand {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--panel-bg);
  padding: 10px 22px;
  border-radius: 9999px;
  border: 1px solid var(--panel-border);
  border-top: 1px solid var(--panel-border-top);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.05);
  pointer-events: auto;
  cursor: pointer;
  transition: var(--transition-fluid);
}

.hud-brand:hover {
  background: rgba(30, 41, 59, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-cyan);
  box-shadow: 0 0 12px var(--accent-cyan);
  animation: pulse-glow 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes pulse-glow {
  0%, 100% { transform: scale(0.95); opacity: 0.7; }
  50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 16px var(--accent-cyan); }
}

.hud-title {
  font-weight: 600;
  font-size: 15px;
  letter-spacing: -0.01em;
  color: var(--text-main);
}

.hud-tag {
  font-size: 11px;
  font-weight: 700;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(56, 189, 248, 0.2));
  color: #e0e7ff;
  padding: 4px 12px;
  border-radius: 9999px;
  border: 1px solid rgba(99, 102, 241, 0.3);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hud-top-actions {
  display: flex;
  gap: 14px;
  pointer-events: auto;
}

.btn-glass {
  background: var(--panel-bg);
  color: var(--text-main);
  border: 1px solid var(--panel-border);
  border-top: 1px solid var(--panel-border-top);
  border-radius: 9999px;
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  transition: var(--transition-fluid);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.05);
}

.btn-glass:hover {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(99, 102, 241, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3), 0 0 16px var(--panel-glow), inset 0 1px 1px rgba(255, 255, 255, 0.15);
}

/* Drag & Drop Hint Overlay */
.drag-drop-hint {
  position: absolute;
  inset: 0;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(24px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.drag-drop-hint.visible {
  opacity: 1;
  pointer-events: auto;
}

.hint-box {
  border: 2px dashed rgba(99, 102, 241, 0.6);
  border-radius: 32px;
  padding: 64px;
  text-align: center;
  background: rgba(15, 23, 42, 0.5);
  max-width: 520px;
  box-shadow: 0 32px 64px rgba(0, 0, 0, 0.4);
}

.hint-icon {
  font-size: 56px;
  display: block;
  margin-bottom: 24px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Floating Bottom Control Dock */
.hud-bottom-bar {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  width: min(760px, calc(100% - 64px));
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-top: 1px solid var(--panel-border-top);
  border-radius: 32px;
  padding: 16px 28px 20px 28px;
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  box-shadow: 
    0 32px 64px rgba(0, 0, 0, 0.4),
    0 16px 24px rgba(0, 0, 0, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.08);
  z-index: 20;
  transition: var(--transition-fluid);
}

.hud-bottom-bar:hover {
  background: rgba(15, 23, 42, 0.75);
  box-shadow: 
    0 36px 72px rgba(0, 0, 0, 0.5),
    0 16px 32px rgba(0, 0, 0, 0.25),
    inset 0 1px 1px rgba(255, 255, 255, 0.12);
}

/* Scrubber Timeline */
.timeline-container {
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 14px;
  position: relative;
}

.timeline-track {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  transition: height 0.3s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
}

.timeline-container:hover .timeline-track {
  height: 8px;
  background: rgba(255, 255, 255, 0.15);
}

.timeline-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #6366f1 0%, #38bdf8 100%);
  border-radius: 999px;
  width: 0%;
  pointer-events: none;
  z-index: 3;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
}

.timeline-thumb {
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%) scale(0);
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2);
  border: 3px solid #6366f1;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: none;
}

.timeline-container:hover .timeline-thumb {
  transform: translateY(-50%) scale(1);
}

.hotspot-markers-container {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}

.timeline-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  height: 100%;
  border-radius: 999px;
  opacity: 0.9;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.timeline-marker.blue {
  background: rgba(56, 189, 248, 0.8);
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.timeline-marker.amber {
  background: rgba(245, 158, 11, 0.8);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.timeline-marker.green {
  background: rgba(16, 185, 129, 0.8);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.timeline-container:hover .timeline-marker {
  opacity: 1;
  filter: brightness(1.2);
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.btn-control {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: var(--transition-fluid);
  padding: 0;
  backdrop-filter: blur(8px);
}

.btn-control:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3), 0 0 12px rgba(255, 255, 255, 0.1);
  transform: scale(1.08);
}

.btn-control:active {
  transform: scale(0.94);
}

.time-display {
  font-size: 14px;
  font-family: var(--font-family);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  gap: 6px;
}

#time-current {
  color: #ffffff;
  font-weight: 600;
}

.time-divider {
  color: rgba(255, 255, 255, 0.3);
  font-weight: 400;
}

#time-duration {
  color: var(--text-muted);
  font-weight: 500;
}

.spacer {
  flex: 1;
}

.active-cue-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.15), rgba(56, 189, 248, 0.15));
  border: 1px solid rgba(99, 102, 241, 0.3);
  padding: 6px 16px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 600;
  color: #e0e7ff;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.1);
  letter-spacing: 0.02em;
}

.cue-dot {
  width: 6px;
  height: 6px;
  background: var(--accent-cyan);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent-cyan);
  animation: cue-dot-pulse 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes cue-dot-pulse {
  0%, 100% { opacity: 0.7; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.3); box-shadow: 0 0 12px var(--accent-cyan); }
}

.volume-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  padding: 8px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: var(--transition-fluid);
}

.btn-icon:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.volume-slider {
  width: 80px;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  outline: none;
  cursor: pointer;
  transition: background 0.3s ease;
}

.volume-slider:hover {
  background: rgba(255, 255, 255, 0.2);
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6366f1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.3);
}

.volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6366f1;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
"""

start_marker = ":root {"
end_marker = "/* Modals Overlay (2D Desktop Fallback) */"
start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    updated_content = content[:start_idx] + new_styles + "\n\n" + content[end_idx:]
    with open("src/style.css", "w") as f:
        f.write(updated_content)
    print("Successfully updated top portion of style.css")
else:
    print("Could not find markers")
