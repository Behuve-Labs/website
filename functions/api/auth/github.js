import { startOAuth } from './_start.js';

export const onRequestGet = (ctx) => startOAuth('github', ctx);
