const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Query execution
  runQuery: (question) => ipcRenderer.invoke('query:run', question),
  cancelQuery: () => ipcRenderer.invoke('query:cancel'),

  // History
  getHistory: (limit) => ipcRenderer.invoke('history:get', limit),
  getHistoryById: (id) => ipcRenderer.invoke('history:getById', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Credits
  getCredits: () => ipcRenderer.invoke('credits:get'),
  resetCredits: () => ipcRenderer.invoke('credits:reset'),

  // Live status streaming (main → renderer)
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status:update', (_event, data) => callback(data));
  },
  onResultReady: (callback) => {
    ipcRenderer.on('result:ready', (_event, data) => callback(data));
  },
  onVerificationComplete: (callback) => {
    ipcRenderer.on('verification:complete', (_event, data) => callback(data));
  },
  onQueryError: (callback) => {
    ipcRenderer.on('query:error', (_event, data) => callback(data));
  },
  onCreditsUpdate: (callback) => {
    ipcRenderer.on('credits:update', (_event, data) => callback(data));
  },
  onCreditsWarning: (callback) => {
    ipcRenderer.on('credits:warning', (_event, data) => callback(data));
  },

  // Remove all listeners (cleanup)
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
