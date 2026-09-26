'use strict';
// Exposes the few desktop-only features the game uses. The web build works without it.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  quit: () => ipcRenderer.send('quit'),
  setFullscreen: (on) => ipcRenderer.send('fullscreen', !!on),
});
