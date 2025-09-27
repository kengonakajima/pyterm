import { config } from 'dotenv';
config();

import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let pythonProcess: ChildProcessWithoutNullStreams | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    if (pythonProcess) {
      pythonProcess.kill();
    }
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('start-python', () => {
  if (pythonProcess) {
    return { success: false, message: 'Python is already running' };
  }

  pythonProcess = spawn('python3', ['-i', '-u'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  pythonProcess.stdout.on('data', (data) => {
    mainWindow?.webContents.send('python-output', data.toString());
  });

  pythonProcess.stderr.on('data', (data) => {
    mainWindow?.webContents.send('python-error', data.toString());
  });

  pythonProcess.on('close', (code) => {
    mainWindow?.webContents.send('python-closed', code);
    pythonProcess = null;
  });

  return { success: true };
});

ipcMain.handle('send-to-python', (_event, command: string) => {
  if (!pythonProcess) {
    return { success: false, message: 'Python is not running' };
  }

  pythonProcess.stdin.write(command + '\n');
  return { success: true };
});

ipcMain.handle('analyze-error', async (_event, history: string) => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { success: false, message: 'XAI_API_KEY not set' };
  }

  const OpenAI = require('openai').default;
  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  });

  const response = await openai.chat.completions.create({
    model: 'grok-code-fast-1',
    messages: [
      {
        role: 'system',
        content: 'あなたはPythonのエラー解析の専門家です。エラーの原因を分析し、日本語で説明と修正方法を提示してください。必ず3行以内で簡潔に回答してください。'
      },
      {
        role: 'user',
        content: `以下のPythonの実行履歴にエラーがあります。原因を分析し、3行以内で簡潔に説明と修正方法を提示してください：\n\n${history}`
      }
    ],
    temperature: 0.7
  });

  return {
    success: true,
    analysis: response.choices[0].message.content
  };
});