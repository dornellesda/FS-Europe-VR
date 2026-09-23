import { tourStore } from '../config/tourStore.js';
import { supabase } from '../config/supabaseClient.js';

export class AdminHub {
  constructor(inputManager, videoSphere, onTourChanged) {
    this.inputManager = inputManager;
    this.videoSphere = videoSphere;
    this.onTourChanged = onTourChanged;
    this.isOpen = false;
    this.activeTab = 'tours'; // 'tours' | 'hotspots' | 'export'

    this.container = document.getElementById('admin-hub-modal-overlay');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'admin-hub-modal-overlay';
      this.container.className = 'modal-overlay admin-hub-overlay';
      document.body.appendChild(this.container);
    }

    this.render();

    // Surface background save failures (e.g. RLS rejecting a write) so the
    // user is never left thinking a change was persisted when it wasn't.
    window.addEventListener('exhibit-save-error', (e) => {
      this._toast(e.detail?.message || 'Save failed. Check that you are signed in.', true);
    });

    this._initSessionBadge();
  }

  _toast(message, isError = false) {
    let el = document.getElementById('admin-toast-top');
    if (!el) {
      el = document.createElement('div');
      el.id = 'admin-toast-top';
      el.style.position = 'fixed';
      el.style.top = '20px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.background = 'rgba(3,7,18,0.92)';
      el.style.backdropFilter = 'blur(12px)';
      el.style.WebkitBackdropFilter = 'blur(12px)';
      el.style.border = '1px solid rgba(148,163,184,0.35)';
      el.style.color = '#f8fafc';
      el.style.padding = '12px 24px';
      el.style.borderRadius = '30px';
      el.style.zIndex = '10001';
      el.style.fontFamily = "'Inter', 'Noto Sans', sans-serif";
      el.style.fontSize = '14px';
      el.style.fontWeight = '600';
      el.style.boxShadow = '0 6px 28px rgba(0,0,0,0.6)';
      el.style.pointerEvents = 'none';
      el.style.transition = 'opacity 0.25s ease';
      el.style.maxWidth = 'min(90vw, 640px)';
      el.style.textAlign = 'center';
      el.style.lineHeight = '1.5';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.background = isError ? 'rgba(69,10,10,0.95)' : 'rgba(6,78,59,0.95)';
    el.style.border = isError ? '1px solid rgba(248,113,113,0.55)' : '1px solid rgba(52,211,153,0.5)';
    el.style.color = isError ? '#fecaca' : '#a7f3d0';
    el.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 4000);
  }

  async _initSessionBadge() {
    const el = document.getElementById('admin-auth-status');
    if (!el) return;
    if (!supabase) {
      el.textContent = 'Demo mode — changes are local-only';
      el.style.background = 'rgba(245,158,11,0.15)';
      el.style.border = '1px solid rgba(245,158,11,0.5)';
      el.style.color = '#fcd34d';
      return;
    }
    let data;
    try {
      data = await supabase.auth.getSession();
    } catch {
      return;
    }
    const user = data?.data?.session?.user;
    if (user) {
      el.textContent = `Signed in as ${user.email || 'admin'}`;
      el.style.background = 'rgba(34,197,94,0.15)';
      el.style.border = '1px solid rgba(34,197,94,0.5)';
      el.style.color = '#86efac';
    } else {
      el.textContent = 'Signed out — saves require sign in';
      el.style.background = 'rgba(239,68,68,0.15)';
      el.style.border = '1px solid rgba(239,68,68,0.5)';
      el.style.color = '#fca5a5';
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="admin-hub-card">
        <!-- Studio Header -->
        <div class="admin-header">
          <div class="admin-header-title">
            <div class="admin-badge">
              <span class="pulse-dot"></span>
              <span>CREATOR STUDIO</span>
            </div>
            <h2>WebXR Tour & Hotspot Management Hub</h2>
          </div>

          <div class="admin-header-actions">
            <span class="admin-session-pill" id="admin-auth-status" style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:20px; font-size:12px; font-weight:600; white-space:nowrap;">checking…</span>
            <button class="btn-glass" id="btn-admin-export" title="Download tourData.json">
              <span>📥 Export JSON</span>
            </button>
            <label class="btn-glass" title="Import previously exported JSON">
              <span>📤 Import JSON</span>
              <input type="file" id="input-admin-import-file" accept=".json,application/json" style="display:none;" />
            </label>
            <button class="btn-glass" id="btn-admin-signout" title="Sign Out of Creator Studio">
              <span>🚪 Sign Out</span>
            </button>
            <button class="modal-close-btn" id="btn-admin-close" title="Close Studio (Esc)">✕</button>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="admin-tabs">
          <button class="admin-tab-btn ${this.activeTab === 'tours' ? 'active' : ''}" data-tab="tours">
            🗺️ Manage Tours & 360 Videos
          </button>
          <button class="admin-tab-btn ${this.activeTab === 'hotspots' ? 'active' : ''}" data-tab="hotspots">
            🎯 Author Hotspots (Video Pop-ups, Links, 3D)
          </button>
          <button class="admin-tab-btn ${this.activeTab === 'export' ? 'active' : ''}" data-tab="export">
            🌐 Web Deployment & Hosting
          </button>
          <button class="admin-tab-btn ${this.activeTab === 'team' ? 'active' : ''}" data-tab="team">
            👥 Team Access
          </button>
        </div>

        <!-- Tab Content Body -->
        <div class="admin-tab-content" id="admin-tab-body"></div>
      </div>
    `;

    // Bind Header Buttons
    document.getElementById('btn-admin-close')?.addEventListener('click', () => this.close());
    document.getElementById('btn-admin-export')?.addEventListener('click', () => this.handleExport());
    document.getElementById('input-admin-import-file')?.addEventListener('change', (e) => this.handleImport(e));
    document.getElementById('btn-admin-signout')?.addEventListener('click', async () => {
      if (supabase) {
        await supabase.auth.signOut();
      }
      this.close();
      alert("You have successfully signed out.");
    });

    // Tab Switchers
    this.container.querySelectorAll('.admin-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab');
        this.container.querySelectorAll('.admin-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderTabBody();
      });
    });

    this.renderTabBody();
  }

  renderTabBody() {
    const body = document.getElementById('admin-tab-body');
    if (!body) return;

    if (this.activeTab === 'tours') {
      this.renderToursTab(body);
    } else if (this.activeTab === 'hotspots') {
      this.renderHotspotsTab(body);
    } else if (this.activeTab === 'team') {
      this.renderTeamTab(body);
    } else {
      this.renderExportTab(body);
    }
  }

  /* ---------------- TAB 1: TOURS & 360 VIDEOS ---------------- */
  renderToursTab(container) {
    const tours = tourStore.getAllTours();
    const activeTour = tourStore.getActiveTour();

    container.innerHTML = `
      <div class="admin-two-col">
        <!-- Left: Tour List -->
        <div class="admin-list-panel">
          <div class="panel-subhead">
            <h3>Available VR Experiences (${tours.length})</h3>
            <button class="btn-action-sm blue" id="btn-admin-new-tour">+ Create New Tour</button>
          </div>

          <div class="admin-items-list">
            ${tours.map((t) => `
              <div class="admin-list-item ${t.id === activeTour?.id ? 'active' : ''}" data-tour-id="${t.id}">
                <div class="item-info">
                  <strong>${t.title}</strong>
                  <span class="item-sub">${t.category || 'Exhibit'} • ${t.hotspots?.length || 0} Hotspots</span>
                </div>
                <div class="item-actions">
                  ${t.id === activeTour?.id ? '<span class="pill-active">Active</span>' : `<button class="btn-pill-action select" data-tour-id="${t.id}">Select</button>`}
                  ${tours.length > 1 ? `<button class="btn-pill-action delete" data-tour-id="${t.id}" title="Delete Tour">🗑️</button>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Right: Edit Selected Tour Form -->
        <div class="admin-form-panel">
          <div class="panel-subhead">
            <h3>Edit Tour Details & Footage</h3>
            <span class="panel-tip">Changes are saved to the database instantly</span>
          </div>

          <form id="form-edit-tour" class="admin-form">
            <div class="form-group">
              <label>Tour Title</label>
              <input type="text" id="tour-field-title" value="${activeTour?.title || ''}" required />
            </div>

            <div class="form-group">
              <label>Subtitle / One-line Hook</label>
              <input type="text" id="tour-field-subtitle" value="${activeTour?.subtitle || ''}" />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Category</label>
                <input type="text" id="tour-field-category" value="${activeTour?.category || 'Science & History'}" />
              </div>
              <div class="form-group">
                <label>Duration (Seconds)</label>
                <input type="number" id="tour-field-duration" value="${activeTour?.duration || 120}" min="10" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Start POV Yaw (deg)</label>
                <input type="number" id="tour-field-start-yaw" value="${activeTour?.startPOV?.yaw ?? ''}" step="1" placeholder="0 = forward" />
              </div>
              <div class="form-group">
                <label>Start POV Pitch (deg)</label>
                <input type="number" id="tour-field-start-pitch" value="${activeTour?.startPOV?.pitch ?? ''}" step="1" placeholder="0 = eye level" />
              </div>
              <div class="form-group">
                <label>&nbsp;</label>
                <button type="button" class="btn-action-sm purple" id="btn-capture-start-pov" title="Use the current view as the tour's starting POV">🎯 Use Current View</button>
              </div>
            </div>
            <span class="field-hint">Defines the starting camera view for desktop/catalog. Yaw 0 = forward, +90 right, -90 left, ±180 behind. Headset users control their own head orientation, so this mainly sets the 2D start view.</span>

            <div class="form-group">
              <label>360° Video Source URL (Equirectangular 2:1 MP4)</label>
              <div class="input-with-action">
                <input type="url" id="tour-field-video" placeholder="https://your-cdn.com/insta360-tour.mp4 (or leave blank for procedural gallery)" value="${activeTour?.videoSrc || ''}" />
                <label class="btn-action-sm purple file-btn" title="Select local video file for testing">
                  Local File
                  <input type="file" id="tour-file-picker" accept="video/mp4,video/*" style="display:none;" />
                </label>
              </div>
              <span class="field-hint">Paste any hosted MP4 link, or select a local Insta360 MP4 to test in this browser.</span>
            </div>

            <div class="form-group">
              <label>Cover Thumbnail Image URL</label>
              <input type="url" id="tour-field-thumb" placeholder="https://images.unsplash.com/..." value="${activeTour?.thumbnail || ''}" />
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea id="tour-field-desc" rows="3">${activeTour?.description || ''}</textarea>
            </div>

            <div class="form-actions-bar">
              <button type="submit" class="btn-action-primary green">💾 Save Tour Changes</button>
              <button type="button" class="btn-action-secondary" id="btn-admin-launch-tour">▶ Launch & Explore Now</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Bind Tour List clicks
    container.querySelectorAll('.btn-pill-action.select').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-tour-id');
        this.switchTour(id);
      });
    });

    container.querySelectorAll('.btn-pill-action.delete').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-tour-id');
        if (!confirm('Are you sure you want to delete this tour?')) return;
        btn.disabled = true;
        try {
          const res = await tourStore.deleteTour(id);
          if (!res.ok) {
            const why = res.error?.message || 'are you signed in?';
            this._toast(`Delete failed — ${why}`, true);
            return;
          }
          this._toast('Tour deleted from database ✔');
          this.switchTour(tourStore.getActiveTour().id);
        } catch (err) {
          this._toast('Delete failed — ' + err.message, true);
        } finally {
          const freshBtn = this.container.querySelector(`[data-tour-id="${id}"] .btn-pill-action.delete`);
          if (freshBtn) freshBtn.disabled = false;
        }
      });
    });

    // New Tour Button
    document.getElementById('btn-admin-new-tour')?.addEventListener('click', async () => {
      const newTitle = prompt('Enter title for the new VR experience:', 'New Guided 360° Tour');
      if (!newTitle) return;
      const res = await tourStore.addTour({
        title: newTitle,
        subtitle: 'Guided walkthrough experience',
        category: 'Exhibition',
        thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
        description: 'A new 360 degree guided exhibition tour.',
        videoSrc: '',
        duration: 120,
        hotspots: []
      });
      if (res.ok) {
        this._toast('Tour created & saved to database ✔');
      } else {
        this._toast('Tour created locally but NOT saved — retry after signing in.', true);
      }
      this.switchTour(res.tour.id);
    });

    // File picker for local video
    document.getElementById('tour-file-picker')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const localUrl = URL.createObjectURL(file);
        document.getElementById('tour-field-video').value = localUrl;
      }
    });

    // Capture current view as start POV
    document.getElementById('btn-capture-start-pov')?.addEventListener('click', () => {
      const angles = this.inputManager.getCurrentAngles();
      document.getElementById('tour-field-start-yaw').value = angles.yaw;
      document.getElementById('tour-field-start-pitch').value = angles.pitch;
    });

    // Save Form
    document.getElementById('form-edit-tour')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const startYawEl = document.getElementById('tour-field-start-yaw');
      const startPitchEl = document.getElementById('tour-field-start-pitch');
      const hasStartPOV = !!(startYawEl?.value !== '' || startPitchEl?.value !== '');
      const updates = {
        title: document.getElementById('tour-field-title').value,
        subtitle: document.getElementById('tour-field-subtitle').value,
        category: document.getElementById('tour-field-category').value,
        duration: Number(document.getElementById('tour-field-duration').value) || 120,
        videoSrc: document.getElementById('tour-field-video').value,
        thumbnail: document.getElementById('tour-field-thumb').value,
        description: document.getElementById('tour-field-desc').value,
        startPOV: hasStartPOV
          ? { yaw: Number(startYawEl.value) || 0, pitch: Number(startPitchEl.value) || 0 }
          : null
      };

      const res = await tourStore.updateTour(activeTour.id, updates);
      if (res.ok) {
        this._toast('Tour details saved to database ✔');
      } else {
        const why = res.error?.message || 'are you signed in?';
        this._toast(`Save failed — ${why}`, true);
      }
      if (this.onTourChanged) {
        this.onTourChanged(tourStore.getActiveTour());
      }
      this.renderTabBody();
    });

    document.getElementById('btn-admin-launch-tour')?.addEventListener('click', () => {
      this.close();
      if (this.onTourChanged) {
        this.onTourChanged(tourStore.getActiveTour());
      }
    });
  }

  /* ---------------- TAB 2: HOTSPOTS (VIDEO POPUPS, LINKS, 3D) ---------------- */
  renderHotspotsTab(container) {
    const activeTour = tourStore.getActiveTour();
    const hotspots = activeTour?.hotspots || [];

    container.innerHTML = `
      <div class="admin-two-col">
        <!-- Left: Hotspot List -->
        <div class="admin-list-panel">
          <div class="panel-subhead">
            <div>
              <h3>Hotspots for "${activeTour?.title}"</h3>
              <span class="panel-tip">${hotspots.length} interactive elements</span>
            </div>
            <button class="btn-action-sm green" id="btn-new-hotspot-form">+ Add Hotspot</button>
          </div>

          <div class="admin-items-list">
            ${hotspots.length === 0 ? '<div class="empty-state">No hotspots configured yet for this tour. Click "+ Add Hotspot" to create one!</div>' : ''}
            ${hotspots.map((h) => {
              const icon = h.type === 'interactive-exhibit' ? '✦' : h.type === 'video-popup' ? '🎬' : '⛶';
              const typeLabel = h.type === 'interactive-exhibit' ? '3D Exhibit' : h.type === 'video-popup' ? 'Video Pop-up' : 'Web Link & QR';
              return `
                <div class="admin-list-item" data-hotspot-id="${h.id}">
                  <div class="item-info">
                    <strong>${icon} ${h.title}</strong>
                    <span class="item-sub">${typeLabel} • ${h.timeStart}s - ${h.timeEnd}s • Yaw: ${h.yaw}°</span>
                  </div>
                  <div class="item-actions">
                    <button class="btn-pill-action delete delete-hotspot" data-hotspot-id="${h.id}" title="Delete Hotspot">🗑️</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Right: Hotspot Authoring Form -->
        <div class="admin-form-panel">
          <div class="panel-subhead">
            <h3>Configure Interactive Hotspot</h3>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn-action-sm cyan" id="btn-admin-capture-view">
                🎯 Capture Current View & Time
              </button>
              <button type="button" class="btn-action-sm green" id="btn-admin-place-pin" style="background: rgba(135, 185, 64, 0.2); border: 1px solid #87b940; color: #87b940;">
                📍 Place Pin on Video
              </button>
            </div>
          </div>

          <form id="form-hotspot-author" class="admin-form">
            <!-- Hotspot Type Selector -->
            <div class="form-group">
              <label>Interactive Hotspot Type</label>
              <select id="hs-type" class="form-select">
                <option value="video-popup">🎬 Video Pop-Up (Secondary Clip / Commentary)</option>
                <option value="qr-code">⛶ External Web Link & Scannable QR Code</option>
                <option value="interactive-exhibit">✦ 3D Interactive Exhibit Replica</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Hotspot Title</label>
                <input type="text" id="hs-title" placeholder="e.g. Curator Commentary" required />
              </div>
              <div class="form-group">
                <label>Floating Subtitle</label>
                <input type="text" id="hs-subtitle" placeholder="e.g. Touch to watch explanation" />
              </div>
            </div>

            <!-- Spatial & Timeline Coordinates -->
            <div class="coordinates-grid">
              <div class="form-group">
                <label>Time Start (sec)</label>
                <input type="number" id="hs-time-start" value="10" step="0.5" min="0" required />
              </div>
              <div class="form-group">
                <label>Time End (sec)</label>
                <input type="number" id="hs-time-end" value="40" step="0.5" min="0" required />
              </div>
              <div class="form-group">
                <label>Yaw (Angle: -180° to 180°)</label>
                <input type="number" id="hs-yaw" value="0" step="1" required />
              </div>
              <div class="form-group">
                <label>Pitch (Height: -90° to 90°)</label>
                <input type="number" id="hs-pitch" value="0" step="1" required />
              </div>
            </div>

            <!-- DYNAMIC SUB-SECTIONS ACCORDING TO TYPE -->
            <div id="hs-dynamic-fields" class="dynamic-type-box">
              <!-- Rendered via JS based on type -->
            </div>

            <div class="form-actions-bar">
              <button type="submit" class="btn-action-primary blue">✓ Add Hotspot to Tour</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Dynamic fields switcher
    const typeSelect = document.getElementById('hs-type');
    const dynamicBox = document.getElementById('hs-dynamic-fields');

    const updateDynamicFields = () => {
      const type = typeSelect.value;
      if (type === 'video-popup') {
        dynamicBox.innerHTML = `
          <h4 class="dynamic-subhead">🎬 Video Pop-Up Configuration</h4>
          <div class="form-group">
            <label>Video Clip URL (MP4)</label>
            <input type="url" id="hs-video-url" placeholder="https://commondatastorage.googleapis.com/.../sample.mp4" value="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" required />
            <span class="field-hint">The video clip that will play inside the floating VR player when the visitor touches this hotspot.</span>
          </div>
          <div class="form-group">
            <label>Video Caption / Context</label>
            <input type="text" id="hs-video-caption" placeholder="e.g. Microscopic inspection of the 16th century bronze gears." />
          </div>
        `;
      } else if (type === 'qr-code') {
        dynamicBox.innerHTML = `
          <h4 class="dynamic-subhead">⛶ Web Link & QR Code Configuration</h4>
          <div class="form-group">
            <label>Target Web URL (Where the QR links)</label>
            <input type="url" id="hs-link-url" placeholder="https://your-museum.org/research-paper" value="https://en.wikipedia.org/wiki/Astrolabe" required />
          </div>
          <div class="form-group">
            <label>Display Domain Label</label>
            <input type="text" id="hs-link-display" placeholder="museum.org/research-paper" value="wikipedia.org/wiki/Astrolabe" />
          </div>
          <div class="form-group">
            <label>Description / Instructions</label>
            <input type="text" id="hs-link-desc" placeholder="Scan with your phone to open the digital paper" value="Access high-resolution scholar catalog and photogrammetry." />
          </div>
        `;
      } else {
        dynamicBox.innerHTML = `
          <h4 class="dynamic-subhead">✦ 3D Interactive Exhibit Replica</h4>
          <div class="form-group">
            <label>Interactive 3D Model Preset</label>
            <select id="hs-model-preset" class="form-select">
              <option value="astrolabe">Mechanical Astrolabe with Kinetic Rete & Gears</option>
              <option value="quantum-cube">Superconducting Levitating Core with Magnetic Flux</option>
            </select>
          </div>
          <div class="form-group">
            <label>Exhibit Description</label>
            <textarea id="hs-exhibit-desc" rows="2">Touch and inspect this replica in 3D VR space.</textarea>
          </div>
        `;
      }
    };

    typeSelect?.addEventListener('change', updateDynamicFields);
    updateDynamicFields();

    // "Capture Current View & Time" button
    document.getElementById('btn-admin-capture-view')?.addEventListener('click', () => {
      let currentYaw = 0;
      let currentPitch = 0;
      let currentTime = 0;

      if (this.inputManager) {
        const angles = this.inputManager.getCurrentAngles();
        currentYaw = angles.yaw;
        currentPitch = angles.pitch;
      }
      if (this.videoSphere) {
        currentTime = Math.round((this.videoSphere.currentTime || 0) * 10) / 10;
      }

      document.getElementById('hs-yaw').value = currentYaw;
      document.getElementById('hs-pitch').value = currentPitch;
      document.getElementById('hs-time-start').value = currentTime;
      document.getElementById('hs-time-end').value = Math.round((currentTime + 30) * 10) / 10;

      alert(`Captured camera view: Yaw=${currentYaw}°, Pitch=${currentPitch}°, Time=${currentTime}s`);
    });

    // "Place Pin on Video" button
    document.getElementById('btn-admin-place-pin')?.addEventListener('click', () => {
      this.close(); // Hide Admin Hub
      
      const toast = document.createElement('div');
      toast.id = 'pin-toast';
      toast.style.position = 'fixed';
      toast.style.top = '20px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'rgba(0,0,0,0.7)';
      toast.style.backdropFilter = 'blur(10px)';
      toast.style.WebkitBackdropFilter = 'blur(10px)';
      toast.style.border = '1px solid rgba(255,255,255,0.2)';
      toast.style.color = '#fff';
      toast.style.padding = '12px 24px';
      toast.style.borderRadius = '30px';
      toast.style.zIndex = '10000';
      toast.style.fontFamily = "'Noto Sans', sans-serif";
      toast.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
      toast.innerHTML = '🎯 Play/Pause the video and click anywhere to place your hotspot.';
      document.body.appendChild(toast);

      window.dispatchEvent(new CustomEvent('exhibit-toggle-pinning', { detail: { active: true } }));

      const onPinPlaced = (e) => {
        window.removeEventListener('exhibit-pin-placed', onPinPlaced);
        window.dispatchEvent(new CustomEvent('exhibit-toggle-pinning', { detail: { active: false } }));
        if (document.body.contains(toast)) document.body.removeChild(toast);
        
        this.open(); // Re-open Admin Hub
        // Wait for DOM to render after open()
        setTimeout(() => {
          const { pitch, yaw } = e.detail;
          let currentTime = 0;
          if (this.videoSphere) {
            currentTime = Math.round((this.videoSphere.currentTime || 0) * 10) / 10;
          }
          
          const yawInput = document.getElementById('hs-yaw');
          const pitchInput = document.getElementById('hs-pitch');
          const startInput = document.getElementById('hs-time-start');
          const endInput = document.getElementById('hs-time-end');
          
          if (yawInput) yawInput.value = yaw;
          if (pitchInput) pitchInput.value = pitch;
          if (startInput) startInput.value = currentTime;
          if (endInput) endInput.value = Math.round((currentTime + 30) * 10) / 10;
        }, 100);
      };
      
      window.addEventListener('exhibit-pin-placed', onPinPlaced);
    });

    // Delete Hotspot
    container.querySelectorAll('.delete-hotspot').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-hotspot-id');
        if (!confirm('Delete this hotspot?')) return;
        btn.disabled = true;
        const res = await tourStore.deleteHotspot(activeTour.id, id);
        if (!res.ok) {
          this._toast(`Delete failed — ${res.error?.message || 'are you signed in?'}`, true);
        } else {
          this._toast('Hotspot deleted & saved ✔');
        }
        if (this.onTourChanged) {
          this.onTourChanged(tourStore.getActiveTour());
        }
        this.renderTabBody();
      });
    });

    // Submit Hotspot Form
    document.getElementById('form-hotspot-author')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const type = typeSelect.value;
      const title = document.getElementById('hs-title').value;
      const subtitle = document.getElementById('hs-subtitle').value;
      const timeStart = Number(document.getElementById('hs-time-start').value);
      const timeEnd = Number(document.getElementById('hs-time-end').value);
      const yaw = Number(document.getElementById('hs-yaw').value);
      const pitch = Number(document.getElementById('hs-pitch').value);

      const newHotspot = {
        type,
        title,
        subtitle,
        timeStart,
        timeEnd,
        yaw,
        pitch,
        distance: 3.6
      };

      if (type === 'video-popup') {
        newHotspot.videoData = {
          title: title,
          sourceUrl: document.getElementById('hs-video-url').value,
          caption: document.getElementById('hs-video-caption').value
        };
      } else if (type === 'qr-code') {
        newHotspot.qrData = {
          url: document.getElementById('hs-link-url').value,
          displayUrl: document.getElementById('hs-link-display').value,
          title: title,
          description: document.getElementById('hs-link-desc').value
        };
      } else {
        const preset = document.getElementById('hs-model-preset').value;
        newHotspot.exhibitData = {
          title: title,
          category: 'Interactive Kinetic Exhibit',
          description: document.getElementById('hs-exhibit-desc').value,
          modelType: preset,
          features: [
            { id: 'f1', label: 'Rotate Component', action: 'spin' },
            { id: 'f2', label: 'Toggle Core', action: 'pulse' }
          ]
        };
      }

      const res = await tourStore.addHotspot(activeTour.id, newHotspot);
      if (res.ok) {
        this._toast('Hotspot created & saved to database ✔');
      } else {
        this._toast(`Hotspot created locally but NOT saved — ${res.error?.message || 'are you signed in?'}`, true);
      }
      if (this.onTourChanged) {
        this.onTourChanged(tourStore.getActiveTour());
      }
      this.renderTabBody();
    });
  }

  /* ---------------- TAB 4: TEAM ACCESS ---------------- */
  renderTeamTab(container) {
    if (!supabase) {
      container.innerHTML = `
        <div class="admin-guide-panel">
          <div class="guide-card" style="text-align:center; padding: 48px;">
            <div class="guide-icon">🔒</div>
            <h3>Database Not Connected</h3>
            <p style="color: var(--text-muted);">Team management requires Supabase to be configured.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-two-col">
        <!-- Left: Active Members from public.profiles (auth backbone) -->
        <div class="admin-list-panel">
          <div class="panel-subhead">
            <h3>Team Members</h3>
            <span class="panel-tip" id="team-count">Loading...</span>
          </div>
          <div class="admin-items-list" id="team-members-list">
            <div class="empty-state">Loading...</div>
          </div>
          <div style="margin-top:12px; font-size:12px; color: var(--text-muted); padding: 0 4px;">
            Backed by <code>auth.users</code> via <code>public.profiles</code>. Members appear once they've signed in.
          </div>
        </div>

        <!-- Right: Invite Form -->
        <div class="admin-form-panel">
          <div class="panel-subhead">
            <h3>Invite a Team Member</h3>
            <span class="panel-tip">Sends a magic link &mdash; they appear once signed in</span>
          </div>

          <form id="form-invite-member" class="admin-form">
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" id="invite-email" placeholder="colleague@familysearch.org" required />
            </div>
            <div id="invite-feedback" style="display:none; padding: 10px; border-radius: 8px; font-size: 14px; margin-bottom: 12px;"></div>
            <div class="form-actions-bar">
              <button type="submit" class="btn-action-primary green" id="btn-send-invite">✉️ Send Magic Link</button>
            </div>
          </form>

          <div style="margin-top: 24px; padding: 16px; background: rgba(255,255,255,0.04); border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
            <p style="color: var(--text-muted); font-size: 13px; margin: 0; line-height: 1.7;">
              <strong style="color: #94a3b8;">How this works:</strong><br>
              1. Enter email → they receive a one-click magic link<br>
              2. They click it → Supabase creates their <code>auth.users</code> row<br>
              3. DB trigger auto-creates their <code>public.profiles</code> row<br>
              4. They appear in this list immediately<br><br>
              <strong style="color: #94a3b8;">To fully revoke access,</strong> delete them in
              <a href="https://supabase.com" target="_blank" style="color: var(--accent-cyan);">Supabase → Authentication → Users</a>
              (cascades to their profile automatically).
            </p>
          </div>
        </div>
      </div>
    `;

    this._loadAndRenderTeamMembers();

    document.getElementById('form-invite-member')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('invite-email').value.trim();
      const btn = document.getElementById('btn-send-invite');
      const feedback = document.getElementById('invite-feedback');

      btn.textContent = 'Sending...';
      btn.disabled = true;
      feedback.style.display = 'none';

      try {
        // Send magic link. On click: Supabase creates auth.users row,
        // DB trigger auto-creates public.profiles row. No manual insert needed.
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true }
        });
        if (error) throw error;

        feedback.textContent = `✅ Magic link sent to ${email}! They'll appear here once they've signed in.`;
        feedback.style.cssText = 'display:block; padding:10px; border-radius:8px; font-size:14px; margin-bottom:12px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); color:#86efac;';
        document.getElementById('invite-email').value = '';
      } catch (err) {
        feedback.textContent = `❌ ${err.message || 'Failed to send. Please try again.'}`;
        feedback.style.cssText = 'display:block; padding:10px; border-radius:8px; font-size:14px; margin-bottom:12px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#fca5a5;';
      } finally {
        btn.textContent = '✉️ Send Magic Link';
        btn.disabled = false;
      }
    });
  }

  async _loadAndRenderTeamMembers() {
    const listEl = document.getElementById('team-members-list');
    const countEl = document.getElementById('team-count');
    if (!listEl || !supabase) return;

    // public.profiles is the auth backbone — auto-populated by DB trigger on auth.users insert
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      listEl.innerHTML = `<div class="empty-state" style="color:#f87171;">Failed to load: ${error.message}</div>`;
      return;
    }

    const members = data || [];
    if (countEl) countEl.textContent = `${members.length} active member${members.length !== 1 ? 's' : ''}`;

    if (members.length === 0) {
      listEl.innerHTML = `<div class="empty-state">No members yet. Send a magic link invite →</div>`;
      return;
    }

    listEl.innerHTML = members.map(m => `
      <div class="admin-list-item" data-member-id="${m.id}">
        <div class="item-info">
          <strong>${m.name || m.email}</strong>
          <span class="item-sub">${m.email} &bull; Joined ${new Date(m.created_at).toLocaleDateString()}</span>
        </div>
        <div class="item-actions">
          <button class="btn-pill-action delete deactivate-member"
            data-member-id="${m.id}"
            data-member-email="${m.email}"
            title="Hides from list. Delete in Supabase to fully revoke.">
            Deactivate
          </button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.deactivate-member').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-member-id');
        const email = btn.getAttribute('data-member-email');
        if (!confirm(`Deactivate ${email}?\n\nThis hides them from this list. To fully revoke login, delete them in Supabase → Authentication → Users.`)) return;
        btn.textContent = '...';
        btn.disabled = true;
        const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', id);
        if (error) { alert('Failed: ' + error.message); btn.textContent = 'Deactivate'; btn.disabled = false; return; }
        this._loadAndRenderTeamMembers();
      });
    });
  }

  /* ---------------- TAB 3: WEB DEPLOYMENT & HOSTING ---------------- */
  renderExportTab(container) {
    container.innerHTML = `
      <div class="admin-guide-panel">
        <div class="guide-card">
          <div class="guide-icon">🌐</div>
          <h3>Deploying Your 360° Exhibit Platform to the Web</h3>
          <p>This application is built with standard WebXR and modern Vite. Because WebXR in VR headsets (like Meta Quest) requires an <strong>HTTPS</strong> connection, here are the easiest ways to publish it:</p>

          <div class="deployment-steps">
            <div class="step-card">
              <h4>Option A: 1-Click Free Hosting (Vercel / Netlify / GitHub Pages)</h4>
              <p>Run <code>npm run build</code>, then connect your repo to <a href="https://vercel.com" target="_blank">Vercel</a> or <a href="https://netlify.com" target="_blank">Netlify</a>. They provide free SSL certificates (HTTPS) automatically.</p>
            </div>

            <div class="step-card">
              <h4>Option B: Hosting Your Large 360° Video Files</h4>
              <p>Insta360 4K/5.7K files are typically 100MB–2GB+. You should host the exported <code>.mp4</code> files on high-speed CDN cloud storage:</p>
              <ul>
                <li><strong>Cloudflare R2</strong> or <strong>AWS S3</strong> (extremely fast streaming, zero egress fees with Cloudflare).</li>
                <li><strong>Vimeo Pro</strong> (provides direct MP4 URLs with adaptive streaming).</li>
                <li>Or simply put the video in the project's <code>public/videos/</code> folder for smaller files.</li>
              </ul>
            </div>

            <div class="step-card">
              <h4>Option C: Exporting & Saving Configurations</h4>
              <p>Whenever you add tours or author hotspots in this Studio, your changes are saved to your Supabase database (requires being signed in — see the badge in the header). Click the button below to download the master configuration file:</p>
              <button class="btn-action-primary blue" id="btn-guide-export-json">
                📥 Download master tourConfig.json
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-guide-export-json')?.addEventListener('click', () => {
      this.handleExport();
    });
  }

  handleExport() {
    const jsonStr = tourStore.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webxr-tours-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const res = await tourStore.importJSON(e.target.result);
        if (res.ok) {
          this._toast('Tours configuration imported & saved to database ✔');
        } else {
          this._toast(`Imported locally but NOT saved — ${res.error?.message || 'are you signed in?'}`, true);
        }
        if (this.onTourChanged) {
          this.onTourChanged(tourStore.getActiveTour());
        }
        this.renderTabBody();
      } catch (err) {
        this._toast('Failed to import JSON: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  }

  switchTour(id) {
    const tour = tourStore.setActiveTour(id);
    if (this.onTourChanged) {
      this.onTourChanged(tour);
    }
    this.renderTabBody();
  }

  open() {
    this.isOpen = true;
    this.renderTabBody();
    this.container.classList.add('active');
  }

  close() {
    this.isOpen = false;
    this.container.classList.remove('active');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
