export interface ElectronAPI {
  startPython: () => Promise<{ success: boolean; message?: string }>;
  sendToPython: (command: string) => Promise<{ success: boolean; message?: string }>;
  analyzeError: (history: string) => Promise<{ success: boolean; analysis?: string; message?: string }>;
  askAI: (question: string, history: string, conversationHistory: Array<{role: string, content: string}>) => Promise<{ success: boolean; answer?: string; message?: string }>;
  getApiKey: () => Promise<{ success: boolean; apiKey: string | null }>;
  setApiKey: (key: string) => Promise<{ success: boolean }>;
  onPythonOutput: (callback: (data: string) => void) => void;
  onPythonError: (callback: (data: string) => void) => void;
  onPythonClosed: (callback: (code: number) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}