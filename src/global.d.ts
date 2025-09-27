export interface ElectronAPI {
  startPython: () => Promise<{ success: boolean; message?: string }>;
  sendToPython: (command: string) => Promise<{ success: boolean; message?: string }>;
  analyzeError: (history: string) => Promise<{ success: boolean; analysis?: string; message?: string }>;
  onPythonOutput: (callback: (data: string) => void) => void;
  onPythonError: (callback: (data: string) => void) => void;
  onPythonClosed: (callback: (code: number) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}