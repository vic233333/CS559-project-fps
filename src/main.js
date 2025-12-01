import Game from "./core/Game.js";
import { GAMEPLAY_CONFIG } from "./config/GameplayConfig.js";

async function bootstrap() {
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
