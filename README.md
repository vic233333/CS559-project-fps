# CS559 FPS Range

A first-person shooter training game built with Three.js and Cannon.js.

## GroupID

1145

## Live Demo

The game is deployed and playable at: https://vic233333.github.io/CS559-project-fps/

## Features

- First-person shooter mechanics
- Physics simulation with Cannon.js
- 3D graphics with Three.js
- Wave-based gameplay
- Auto-play demo mode

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

## Controls

- **Move**: WASD
- **Sprint**: Shift
- **Jump**: Space
- **Pause**: Esc
- **Toggle Mode**: Use buttons in the header

## Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. When changes are pushed to the `main` branch, the workflow:

1. Builds the project using Vite
2. Deploys the built files to GitHub Pages

You can also manually trigger the deployment from the Actions tab in GitHub.

## License

ISC
