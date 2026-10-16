import {App} from './app';

const canvas = document.getElementById('cv') as HTMLCanvasElement;
const app = new App(canvas);
(window as any).mj = app;
(window as any).__mjReady = true;