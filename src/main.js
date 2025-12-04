import Game from "./core/Game.js";
import { GAMEPLAY_CONFIG } from "./config/GameplayConfig.js";

async function bootstrap() {
  const loadingScreen = document.getElementById('loading-screen');

  // Fake loading delay
  await new Promise(resolve => setTimeout(resolve, 2500));

  if (loadingScreen) {
    // Glitch Exit
    loadingScreen.classList.add('glitch-out');
    setTimeout(() => {
      loadingScreen.style.opacity = '0'; // Fade out after glitch starts
      setTimeout(() => loadingScreen.remove(), 200);
    }, 400); // Run glitch for 400ms
  }

  const canvas = document.getElementById("game-canvas");
  const game = new Game({ canvas, gameplayConfig: GAMEPLAY_CONFIG });
  await game.init();
}

function updateBannerHeight() {
  const banner = document.querySelector('.top-banner');
  if (!banner) return;

  const h = banner.offsetHeight;
  document.documentElement.style.setProperty('--banner-height', `${h}px`);
}

window.addEventListener('load', updateBannerHeight);
window.addEventListener('resize', updateBannerHeight);

bootstrap();
