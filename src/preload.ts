import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startPython: () => ipcRenderer.invoke('start-python'),
  sendToPython: (command: string) => ipcRenderer.invoke('send-to-python', command),
  analyzeError: (history: string) => ipcRenderer.invoke('analyze-error', history),
  onPythonOutput: (callback: (data: string) => void) => {
    ipcRenderer.on('python-output', (_event, data) => callback(data));
  },
  onPythonError: (callback: (data: string) => void) => {
    ipcRenderer.on('python-error', (_event, data) => callback(data));
  },
  onPythonClosed: (callback: (code: number) => void) => {
    ipcRenderer.on('python-closed', (_event, code) => callback(code));
  }
});