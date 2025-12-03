// Simple, data-driven scene descriptions to avoid hard-coding geometry in World.
export const SCENES = {
  prototype: {
    name: "Prototype Arena",
    playerSpawn: [0, 1.6, 10],
    statics: [ // for static environment geometry
      // { type: "box", size: [60, 1, 60], pos: [0, -0.5, 0], color: "#2a3040" },
      // { type: "box", size: [2, 2, 10], pos: [0, 1, -6], color: "#3a4356" }, // back wall
      { type: "box", size: [15, 1.2, 2], pos: [-10, 0.5, 4], color: "#3a4356" }, // front left
      { type: "box", size: [15, 1.2, 2], pos: [10, 0.5, 4], color: "#3a4356" } // front right
    ],
    spawns: [
      { id: "p1", pos: [-8, 1.2, -6] },
      { id: "p2", pos: [0, 1.2, -8] },
      { id: "p3", pos: [8, 1.2, -6] },
      { id: "p4", pos: [-10, 1.2, 0] },
      { id: "p5", pos: [10, 1.2, 0] },
      { id: "p6", pos: [-8, 1.2, 6] },
      { id: "p7", pos: [0, 1.2, 8] },
      { id: "p8", pos: [8, 1.2, 6] }
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
    spawns: [
      { id: "f1", pos: [-12, 1.4, -10], path: "circle", radius: 3 },
      { id: "f2", pos: [0, 1.4, -12], path: "line", axis: "x", range: 6 },
      { id: "f3", pos: [12, 1.4, -10], path: "circle", radius: 2.5 },
      { id: "f4", pos: [-14, 1.4, 0], path: "line", axis: "z", range: 6 },
      { id: "f5", pos: [14, 1.4, 0], path: "line", axis: "z", range: 6 },
      { id: "f6", pos: [-12, 1.4, 10], path: "circle", radius: 2 },
      { id: "f7", pos: [0, 1.4, 12], path: "line", axis: "x", range: 5 },
      { id: "f8", pos: [12, 1.4, 10], path: "circle", radius: 2 }
    ]
  }
};

export function sceneForMode() {
  return SCENES.prototype;
}
