/* global require */
const { contextBridge, ipcRenderer } = require('electron');

const WINDOW_STATE_CHANNEL = 'window-state-changed';
const WINDOW_CONTROL_CHANNEL = 'window-control';
const WINDOW_STATE_REQUEST_CHANNEL = 'window-state';
const WINDOW_THEME_CHANNEL = 'window-theme';

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke(WINDOW_CONTROL_CHANNEL, 'minimize'),
  toggleMaximize: () =>
    ipcRenderer.invoke(WINDOW_CONTROL_CHANNEL, 'toggle-maximize'),
  close: () => ipcRenderer.invoke(WINDOW_CONTROL_CHANNEL, 'close'),
  getWindowState: () => ipcRenderer.invoke(WINDOW_STATE_REQUEST_CHANNEL),
  setBackgroundColor: color => ipcRenderer.send(WINDOW_THEME_CHANNEL, color),
  onWindowStateChange: callback => {
    const handler = (_event, state) => callback?.(state);
    ipcRenderer.on(WINDOW_STATE_CHANNEL, handler);
    return () => ipcRenderer.removeListener(WINDOW_STATE_CHANNEL, handler);
  },
});
