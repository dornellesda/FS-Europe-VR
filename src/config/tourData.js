/**
 * Exhibit tour timeline configuration.
 * Define all interactive exhibits, QR codes, and information points
 * synchronized with the 360 video tour.
 *
 * Coordinates:
 * - yaw: horizontal angle in degrees (-180 to +180, 0 is forward, +90 is right, -90 is left, 180 behind)
 * - pitch: vertical angle in degrees (-90 to +90, 0 is eye level/horizon, +30 is looking up, -30 down)
 * - distance: distance in meters from camera (typically 3 to 6)
 * - timeStart / timeEnd: video timestamps in seconds when this item is active/mentioned by the guide.
 */

export const tourData = {
  title: "Museum of Science & Wonder - 360° Guided Tour",
  defaultVideoSrc: null, // Will use procedural gallery if null or user can load MP4
  hotspots: [
    {
      id: "astrolabe-replica",
      type: "interactive-exhibit",
      title: "Interactive Astrolabe Replica",
      subtitle: "Touch to inspect & rotate ancient mechanical gears",
      timeStart: 2,
      timeEnd: 45,
      yaw: 35,
      pitch: -5,
      distance: 3.8,
      exhibitData: {
        title: "Celestial Astrolabe (16th Century)",
        category: "Interactive Kinetic Artifact",
        description:
          "The tour guide introduces this brass astrolabe used by navigators to calculate star positions and local time. In this interactive replica, touch and drag to rotate the rete and mater rings, or activate the celestial alignment gear.",
        modelType: "astrolabe",
        features: [
          { id: "gear-spin", label: "Spin Celestial Rings", action: "spin" },
          { id: "align-stars", label: "Toggle Star Pointer", action: "stars" },
          { id: "brass-polish", label: "Cycle Metal Finish", action: "material" }
        ]
      }
    },
    {
      id: "quantum-cube-exhibit",
      type: "interactive-exhibit",
      title: "Quantum Levitation Display",
      subtitle: "Touch to activate magnetic levitation field",
      timeStart: 30,
      timeEnd: 90,
      yaw: -45,
      pitch: 0,
      distance: 4.2,
      exhibitData: {
        title: "Superconducting Quantum Levitator",
        category: "Interactive Physics Demonstration",
        description:
          "As highlighted by the guide, this demonstration uses YBCO high-temperature superconductors cooled by liquid nitrogen to lock magnetic flux lines. Touch the activation orb to engage flux pinning and watch the core levitate and pulse.",
        modelType: "quantum-cube",
        features: [
          { id: "levitate", label: "Trigger Flux Levitation", action: "levitate" },
          { id: "thermal-glow", label: "Cool to Superconduction", action: "cool" },
          { id: "invert-field", label: "Pulse Quantum Field", action: "pulse" }
        ]
      }
    },
    {
      id: "qr-curator-catalog",
      type: "qr-code",
      title: "Exhibit Digital Catalog QR",
      subtitle: "Touch to scan and open the curator's research paper",
      timeStart: 10,
      timeEnd: 75,
      yaw: 78,
      pitch: 8,
      distance: 3.5,
      qrData: {
        url: "https://en.wikipedia.org/wiki/Astrolabe",
        displayUrl: "wikipedia.org/wiki/Astrolabe",
        title: "Astrolabe Historical Archives",
        description:
          "Official digital collection catalog with 3D photogrammetry scans, high-resolution documentation, and scholar commentaries."
      }
    },
    {
      id: "qr-virtual-ticket",
      type: "qr-code",
      title: "Museum Audio Guide & Feedback QR",
      subtitle: "Touch to access mobile web audio guide",
      timeStart: 50,
      timeEnd: 120,
      yaw: -85,
      pitch: -8,
      distance: 3.6,
      qrData: {
        url: "https://github.com",
        displayUrl: "museum-tour.org/audio-guide",
        title: "Companion Mobile Audio Guide",
        description:
          "Access multilingual voiceover transcripts, accessibility descriptions, and extended interviews with the exhibit curators."
      }
    }
  ]
};
