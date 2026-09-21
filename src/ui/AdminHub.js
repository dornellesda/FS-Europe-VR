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
            <span class="panel-tip">Changes update live in memory and localStorage</span>
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-tour-id');
        if (confirm('Are you sure you want to delete this tour?')) {
          tourStore.deleteTour(id);
          this.switchTour(tourStore.getActiveTour().id);
        }
      });
    });

    // New Tour Button
    document.getElementById('btn-admin-new-tour')?.addEventListener('click', () => {
      const newTitle = prompt('Enter title for the new VR experience:', 'New Guided 360° Tour');
      if (newTitle) {
        const created = tourStore.addTour({
          title: newTitle,
          subtitle: 'Guided walkthrough experience',
          category: 'Exhibition',
          thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
          description: 'A new 360 degree guided exhibition tour.',
          videoSrc: '',
          duration: 120,
          hotspots: []
        });
        this.switchTour(created.id);
      }
    });

    // File picker for local video
    document.getElementById('tour-file-picker')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const localUrl = URL.createObjectURL(file);
        document.getElementById('tour-field-video').value = localUrl;
      }
    });

    // Save Form
    document.getElementById('form-edit-tour')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const updates = {
        title: document.getElementById('tour-field-title').value,
        subtitle: document.getElementById('tour-field-subtitle').value,
        category: document.getElementById('tour-field-category').value,
        duration: Number(document.getElementById('tour-field-duration').value) || 120,
        videoSrc: document.getElementById('tour-field-video').value,
        thumbnail: document.getElementById('tour-field-thumb').value,
        description: document.getElementById('tour-field-desc').value
      };

      tourStore.updateTour(activeTour.id, updates);
      alert('Tour details saved successfully!');
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
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-hotspot-id');
        if (confirm('Delete this hotspot?')) {
          tourStore.deleteHotspot(activeTour.id, id);
          if (this.onTourChanged) {
            this.onTourChanged(tourStore.getActiveTour());
          }
          this.renderTabBody();
        }
      });
    });

    // Submit Hotspot Form
    document.getElementById('form-hotspot-author')?.addEventListener('submit', (e) => {
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

      tourStore.addHotspot(activeTour.id, newHotspot);
      alert('Hotspot created and synchronized with tour!');
      if (this.onTourChanged) {
        this.onTourChanged(tourStore.getActiveTour());
      }
      this.renderTabBody();
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
              <p>Whenever you add tours or author hotspots in this Studio, your changes are immediately saved in your browser's local storage. Click the button below to download the master configuration file:</p>
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
    reader.onload = (e) => {
      try {
        tourStore.importJSON(e.target.result);
        alert('Tours configuration imported successfully!');
        if (this.onTourChanged) {
          this.onTourChanged(tourStore.getActiveTour());
        }
        this.renderTabBody();
      } catch (err) {
        alert('Failed to import JSON: ' + err.message);
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
