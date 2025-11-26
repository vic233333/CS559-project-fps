import Game from "./core/Game.js";
import { GAMEPLAY_CONFIG } from "./config/gameplay.js";

async function bootstrap() {
  const canvas = document.getElementById("game-canvas");
  const game = new Game({ canvas, gameplayConfig: GAMEPLAY_CONFIG });
  await game.init();
}

bootstrap();
