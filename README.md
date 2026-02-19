# CS559 FPS Range

A first-person shooter training range built with Three.js, Cannon-es, and Vite. It focuses on short, replayable sessions with configurable waves, target types, and a polished HUD/menus.

## GroupID

1145

## Live Demo

The game is deployed and playable at: https://vic233333.github.io/CS559-project-fps/

## Features

- Wave and continuous session modes with configurable duration and target counts
- Two target styles: geometric shapes or humanoid robots with hitboxes and armor options
- Weapon switching (pistol + knife) with recoil, spread, and accuracy penalties while moving
- Detailed HUD, end-of-session stats, and performance chart
- Touch controls (virtual joystick + buttons) for tablets/touchscreen devices
- Auto-play demo mode for hands-off showcasing

## Gameplay

- **Wave Mode**: Timed waves with increasing target counts and speed.
- **Continuous Mode**: Constant targets for the full session duration.
- **Robots**: Head/body/leg hitboxes with adjustable model scale/offset and optional armor.

## Controls

### Keyboard + Mouse

- **Move**: WASD
- **Look**: Mouse (click canvas to lock pointer)
- **Shoot**: Left Click
- **Sprint**: Shift
- **Jump**: Space
- **Crouch**: Ctrl
- **Switch Weapon**: 1 / 2
- **Pause**: Esc

### Touch (enable in Settings)

- **Move**: Left joystick
- **Look**: Drag right side of screen
- **Shoot**: FIRE button (hold to auto-fire)
- **Jump / Crouch**: ↑ / ↓ buttons
- **Switch Weapon**: 1 / 2 buttons

## Game Settings (in-menu)

- Mouse sensitivity
- Target distribution angle
- Game mode: Wave or Continuous
- Wave configuration (count, targets per wave, moving ratio)
- Continuous mode target count + duration
- Target type (geometric or robot) + robot armor/movement
- Robot model scale and Y-offset
- Touch controls toggle

## Development

### Prerequisites

- Node.js 20 or higher
- npm

### Installation

```bash
npm install
```

### Running Locally

```bash
npm run dev
```

The game will open in your browser at `http://localhost:5173/CS559-project-fps/`.

To access it from other devices (LAN/Tailscale):

- By IP: it should work out of the box
- By hostname (e.g. `*.ts.net`): create a local-only `.env.local` (gitignored) and restart `npm run dev` with:

```bash
DEV_ALLOWED_HOSTS=<your-hostname>
```

Remote: `http://<your-hostname-or-ip>:5173/CS559-project-fps/`

### Building

```bash
npm run build
```

The built files will be in the `dist` directory.

### Previewing the Build

```bash
npm run preview
```

## Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. When changes are pushed to the `main` branch, the workflow:

1. Builds the project using Vite
2. Deploys the built files to GitHub Pages

You can also manually trigger the deployment from the Actions tab in GitHub.

## License

MIT License. See [LICENSE](LICENSE) for details.
