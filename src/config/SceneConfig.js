// Simple, data-driven scene descriptions to avoid hard-coding geometry in World.
// All spawn points are now restricted to the area in front of the player (negative Z)
export const SCENES = {
  prototype: {
    name: "Prototype Arena",
    playerSpawn: [0, 1.6, 10],
    statics: [
      { type: "box", size: [15, 1.2, 2], pos: [-10, 0.5, 4], color: "#3a4356" },
      { type: "box", size: [15, 1.2, 2], pos: [10, 0.5, 4], color: "#3a4356" }
    ],
    // All spawns are now in front of the player (negative Z relative to player spawn at Z=10)
    spawns: [
      { id: "p1", pos: [-8, 1.2, -2] },
      { id: "p2", pos: [-4, 1.2, -5] },
      { id: "p3", pos: [0, 1.2, -8] },
      { id: "p4", pos: [4, 1.2, -5] },
      { id: "p5", pos: [8, 1.2, -2] },
      { id: "p6", pos: [-6, 1.2, 2] },
      { id: "p7", pos: [0, 1.2, 0] },
      { id: "p8", pos: [6, 1.2, 2] }
    ]
  },
  full: {
    name: "Full Hangar",
    playerSpawn: [0, 1.6, 12],
    statics: [
      { type: "box", size: [40, 1, 40], pos: [0, -0.5, 0], color: "#121825" },
      { type: "box", size: [4, 3, 18], pos: [0, 1.5, -10], color: "#1e2536" },
      { type: "box", size: [10, 2, 2], pos: [-10, 1, 2], color: "#1e2536" },
      { type: "box", size: [10, 2, 2], pos: [10, 1, 2], color: "#1e2536" },
      { type: "box", size: [6, 0.8, 6], pos: [0, 0.4, 0], color: "#1a2030" }
    ],
    // All spawns restricted to front area
    spawns: [
      { id: "f1", pos: [-10, 1.4, -6], path: "circle", radius: 2 },
      { id: "f2", pos: [-5, 1.4, -10], path: "line", axis: "x", range: 3 },
      { id: "f3", pos: [0, 1.4, -8], path: "circle", radius: 2 },
      { id: "f4", pos: [5, 1.4, -10], path: "line", axis: "x", range: 3 },
      { id: "f5", pos: [10, 1.4, -6], path: "circle", radius: 2 },
      { id: "f6", pos: [-8, 1.4, 0], path: "line", axis: "z", range: 3 },
      { id: "f7", pos: [0, 1.4, -2], path: "line", axis: "x", range: 4 },
      { id: "f8", pos: [8, 1.4, 0], path: "line", axis: "z", range: 3 }
    ]
  }
};

export function sceneForMode() {
  return SCENES.prototype;
}
