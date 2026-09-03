import { ScreenManager } from './screens/screenManager.js';
import { TitleScreen } from './screens/titleScreen.js';
import { ViewportScreen } from './screens/viewportScreen.js';

const canvas = document.getElementById('viewport');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const manager = new ScreenManager(canvas, ctx);
manager.register('title', new TitleScreen(manager));
manager.register('viewport', new ViewportScreen(manager));
manager.switchTo('title');

let lastTime = performance.now();
function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    manager.update(dt);
    manager.render();

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
