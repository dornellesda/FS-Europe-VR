import { tourStore } from '../config/tourStore.js';

export class TourCatalogModal {
  constructor(onSelectTour, onOpenAdminHub) {
    this.onSelectTour = onSelectTour;
    this.onOpenAdminHub = onOpenAdminHub;
    this.isOpen = false;

    this.container = document.getElementById('tour-catalog-modal-overlay');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'tour-catalog-modal-overlay';
      this.container.className = 'modal-overlay catalog-modal-overlay';
      document.body.appendChild(this.container);
    }

    this.render();
    tourStore.subscribe(() => {
      if (this.isOpen) {
        this.renderCards();
      }
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="catalog-modal-card">
        <div class="catalog-header">
          <div class="catalog-header-left">
            <div class="catalog-brand-badge">
              <span class="pulse-dot"></span>
              <span>IMMERSIVE 360° EXPERIENCES</span>
            </div>
            <h1 class="catalog-title">Explore Virtual Tours & Exhibits</h1>
            <p class="catalog-subtitle">Select an experience below to enter the 360° guided tour in VR or Desktop mode.</p>
          </div>

          <div class="catalog-header-right">
            <button class="btn-glass btn-admin-shortcut" id="btn-catalog-open-admin">
              <span>⚙️ Creator Studio / Admin</span>
            </button>
            <button class="modal-close-btn" id="btn-catalog-close" title="Close Menu (Esc)">✕</button>
          </div>
        </div>

        <!-- Tour Cards Grid -->
        <div class="catalog-grid" id="catalog-cards-grid"></div>

        <!-- Footer Info -->
        <div class="catalog-footer">
          <div class="catalog-vr-tip">
            <span class="tip-icon">🥽</span>
            <span><strong>VR Headset Users:</strong> Put on your Meta Quest, open this URL in the Quest Browser, and click <strong>ENTER VR</strong> for spatial 6DoF immersion.</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-catalog-close')?.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('btn-catalog-open-admin')?.addEventListener('click', () => {
      this.close();
      if (this.onOpenAdminHub) {
        this.onOpenAdminHub();
      }
    });

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    this.renderCards();
  }

  renderCards() {
    const grid = document.getElementById('catalog-cards-grid');
    if (!grid) return;

    const tours = tourStore.getAllTours();
    const activeTour = tourStore.getActiveTour();

    grid.innerHTML = tours.map((tour) => {
      const isActive = tour.id === activeTour?.id;
      const hotspotCount = (tour.hotspots || []).length;
      const minutes = Math.floor((tour.duration || 120) / 60);
      const seconds = (tour.duration || 120) % 60;
      const timeStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

      return `
        <div class="tour-card ${isActive ? 'active-tour' : ''}" data-tour-id="${tour.id}">
          <div class="tour-card-media">
            <img src="${tour.thumbnail || 'https://images.unsplash.com/photo-1564399580075-5dfe19c206f1?auto=format&fit=crop&w=600&q=80'}" alt="${tour.title}" class="tour-card-img" />
            <div class="tour-card-badge">${tour.category || 'Museum Exhibit'}</div>
            ${isActive ? '<div class="tour-card-status-badge">CURRENTLY ACTIVE</div>' : ''}
          </div>

          <div class="tour-card-body">
            <div class="tour-card-meta">
              <span>⏱ ${timeStr} Walkthrough</span>
              <span>✦ ${hotspotCount} Interactive Hotspots</span>
            </div>

            <h2 class="tour-card-title">${tour.title}</h2>
            <p class="tour-card-desc">${tour.description || tour.subtitle || ''}</p>

            <div class="tour-card-action">
              <button class="btn-tour-launch ${isActive ? 'current' : ''}" data-tour-id="${tour.id}">
                ${isActive ? '✓ Currently Exploring' : '▶ Enter Experience'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners
    grid.querySelectorAll('.btn-tour-launch').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tourId = btn.getAttribute('data-tour-id');
        this.selectTour(tourId);
      });
    });

    grid.querySelectorAll('.tour-card').forEach((card) => {
      card.addEventListener('click', () => {
        const tourId = card.getAttribute('data-tour-id');
        this.selectTour(tourId);
      });
    });
  }

  selectTour(tourId) {
    const tour = tourStore.setActiveTour(tourId);
    if (tour && this.onSelectTour) {
      this.onSelectTour(tour);
    }
    this.close();
  }

  open() {
    this.isOpen = true;
    this.renderCards();
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
