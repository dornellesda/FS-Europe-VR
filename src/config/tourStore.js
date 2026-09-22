import { tourData as defaultTourData } from './tourData.js';
import { supabase } from './supabaseClient.js';

export const initialCatalog = [
  {
    id: "science-wonder-tour",
    title: "Museum of Science & Wonder",
    subtitle: "Insta360 4K Guided Walkthrough & Kinetic Artifacts",
    category: "Science & History",
    thumbnail: "https://images.unsplash.com/photo-1564399580075-5dfe19c206f1?auto=format&fit=crop&w=600&q=80",
    description: "Follow the chief curator through the grand hall. Discover operational astrolabe replicas, superconducting quantum levitation, and rich scholarly archives.",
    videoSrc: "https://vr.familysearch.fun/Glasgow-v1_web.mp4",
    duration: 120,
    hotspots: [
      ...defaultTourData.hotspots,
      {
        id: "video-popup-curator",
        type: "video-popup",
        title: "Curator Spotlight: Behind the Glass",
        subtitle: "Touch to watch curator Dr. Vance explain gear mechanics",
        timeStart: 18,
        timeEnd: 55,
        yaw: 15,
        pitch: -12,
        distance: 3.2,
        videoData: {
          title: "Curator Commentary: Preserving Astrolabes",
          sourceUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          caption: "High-resolution micro-camera inspection showing hand-chiseled Arabic numerals on the brass limb.",
          duration: 15
        }
      }
    ]
  },
  {
    id: "cosmic-observatory-tour",
    title: "High-Altitude Cosmic Observatory",
    subtitle: "Virtual Tour of the Sub-Millimeter Telescope Array",
    category: "Astronomy",
    thumbnail: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=600&q=80",
    description: "Explore the mountaintop observatory domes under pristine night skies. Inspect adaptive optics, interstellar dust monitors, and real-time telescope telemetry.",
    videoSrc: "",
    duration: 150,
    hotspots: [
      {
        id: "exhibit-mirror-optics",
        type: "interactive-exhibit",
        title: "Hexagonal Segmented Mirror",
        subtitle: "Touch to test cryogenic actuator alignment",
        timeStart: 5,
        timeEnd: 60,
        yaw: -30,
        pitch: 10,
        distance: 4.0,
        exhibitData: {
          title: "Beryllium Segmented Mirror Array",
          category: "Astronomical Optics",
          description: "Inspect the micro-actuators that warp the gold-plated mirror surface to nanometer precision, compensating for atmospheric turbulence.",
          modelType: "quantum-cube",
          features: [
            { id: "align-mirrors", label: "Trigger Actuator Pulse", action: "pulse" },
            { id: "cryo-cool", label: "Engage Cryo-Chamber", action: "cool" },
            { id: "flux-test", label: "Inspect Optical Focal Point", action: "levitate" }
          ]
        }
      },
      {
        id: "video-popup-supernova",
        type: "video-popup",
        title: "Observatory Log: Supernova Remnant",
        subtitle: "Watch timelapse captured by the 8-meter primary array",
        timeStart: 25,
        timeEnd: 85,
        yaw: 42,
        pitch: 15,
        distance: 3.6,
        videoData: {
          title: "Crab Nebula Shockwave Analysis",
          sourceUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          caption: "X-ray and radio composite video revealing synchrotron emissions from the central pulsar.",
          duration: 30
        }
      },
      {
        id: "qr-observatory-telemetry",
        type: "qr-code",
        title: "Live Telescope Status & Sky Map",
        subtitle: "Touch to view live weather, sensor feeds, and sky map",
        timeStart: 40,
        timeEnd: 110,
        yaw: 95,
        pitch: -5,
        distance: 3.4,
        qrData: {
          url: "https://hubblesite.org",
          displayUrl: "observatory.org/telemetry/live",
          title: "Deep Sky Telemetry Portal",
          description: "Real-time seeing conditions, ambient humidity, and live target coordinates currently tracked by the mountaintop array."
        }
      }
    ]
  }
];

class TourStore {
  constructor() {
    this.tours = JSON.parse(JSON.stringify(initialCatalog));
    this.activeTourId = this.tours[0]?.id || "science-wonder-tour";
    this.listeners = [];
    this.initSupabase();
  }

  async initSupabase() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('tours').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        // Normalise rows: Supabase JSONB can return null for empty arrays
        this.tours = data.map(t => ({
          ...t,
          hotspots: t.hotspots || [],
          duration: t.duration || 120,
        }));
      } else {
        // Table is empty — seed it with the initial catalog
        const { error: insertError } = await supabase.from('tours').insert(this.tours);
        if (insertError) throw insertError;
      }
      if (!this.tours.find(t => t.id === this.activeTourId)) {
        this.activeTourId = this.tours[0].id;
      }
      this.notify();
    } catch (e) {
      console.error('Supabase fetch failed, falling back to local data:', e);
    }
  }



  async save() {
    this.notify();
    if (supabase) {
      const { error } = await supabase.from('tours').upsert(this.tours);
      if (error) {
        console.error('Supabase save error:', error);
      }
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach((l) => l(this.tours, this.getActiveTour()));
  }

  getAllTours() {
    return this.tours;
  }

  getActiveTour() {
    return this.tours.find((t) => t.id === this.activeTourId) || this.tours[0];
  }

  setActiveTour(id) {
    const found = this.tours.find((t) => t.id === id);
    if (found) {
      this.activeTourId = id;
      this.notify();
      return found;
    }
    return null;
  }

  addTour(tour) {
    const id = tour.id || `tour-${Date.now()}`;
    const newTour = {
      ...tour,
      id,
      duration: tour.duration || 120,
      hotspots: tour.hotspots || []
    };
    this.tours.push(newTour);
    this.save();
    return newTour;
  }

  updateTour(id, updates) {
    const index = this.tours.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.tours[index] = { ...this.tours[index], ...updates };
      this.save();
      return this.tours[index];
    }
    return null;
  }

  deleteTour(id) {
    if (this.tours.length <= 1) {
      throw new Error("Cannot delete the only remaining tour.");
    }
    this.tours = this.tours.filter((t) => t.id !== id);
    if (this.activeTourId === id) {
      this.activeTourId = this.tours[0].id;
    }
    this.save();
  }

  addHotspot(tourId, hotspot) {
    const tour = this.tours.find((t) => t.id === tourId);
    if (!tour) return null;

    const newHotspot = {
      id: hotspot.id || `hotspot-${Date.now()}`,
      type: hotspot.type || 'interactive-exhibit',
      title: hotspot.title || 'Untitled Hotspot',
      subtitle: hotspot.subtitle || 'Touch to inspect',
      timeStart: Number(hotspot.timeStart) || 0,
      timeEnd: Number(hotspot.timeEnd) || 30,
      yaw: Number(hotspot.yaw) || 0,
      pitch: Number(hotspot.pitch) || 0,
      distance: Number(hotspot.distance) || 3.5,
      ...hotspot
    };

    tour.hotspots = tour.hotspots || [];
    tour.hotspots.push(newHotspot);
    this.save();
    return newHotspot;
  }

  updateHotspot(tourId, hotspotId, updates) {
    const tour = this.tours.find((t) => t.id === tourId);
    if (!tour) return null;

    const index = tour.hotspots.findIndex((h) => h.id === hotspotId);
    if (index !== -1) {
      tour.hotspots[index] = { ...tour.hotspots[index], ...updates };
      this.save();
      return tour.hotspots[index];
    }
    return null;
  }

  deleteHotspot(tourId, hotspotId) {
    const tour = this.tours.find((t) => t.id === tourId);
    if (!tour) return false;

    tour.hotspots = tour.hotspots.filter((h) => h.id !== hotspotId);
    this.save();
    return true;
  }

  exportJSON() {
    return JSON.stringify(this.tours, null, 2);
  }

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.tours = parsed;
        this.activeTourId = this.tours[0].id;
        this.save();
        return true;
      }
      throw new Error("Imported JSON must be a non-empty array of tours.");
    } catch (e) {
      console.error('Failed to import JSON', e);
      throw e;
    }
  }

  resetToDefaults() {
    this.tours = JSON.parse(JSON.stringify(initialCatalog));
    this.activeTourId = this.tours[0].id;
    this.save();
  }
}

export const tourStore = new TourStore();
