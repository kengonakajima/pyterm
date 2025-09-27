const terminalOutput = document.getElementById('terminal-output') as HTMLDivElement;
const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
const analysisPanel = document.getElementById('analysis-panel') as HTMLDivElement;
const analysisContent = document.getElementById('analysis-content') as HTMLDivElement;

let commandHistory: string[] = [];
let multiLineBuffer: string[] = [];
let isMultiLineMode = false;
let currentIndent = 0;

function appendToTerminal(text: string, className?: string) {
  const line = document.createElement('div');
  if (className) {
    line.className = className;
  }
  line.textContent = text;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;

  commandHistory.push(text);
}

function checkForError(text: string) {
  const errorPatterns = [
    /Error:/,
    /Exception:/,
    /Traceback \(most recent call last\):/,
    /SyntaxError:/,
    /NameError:/,
    /TypeError:/,
    /ValueError:/,
    /AttributeError:/,
    /ImportError:/,
    /KeyError:/,
    /IndexError:/
  ];

  return errorPatterns.some(pattern => pattern.test(text));
}

async function analyzeCurrentError() {
  const recentHistory = commandHistory.slice(-50).join('\n');

  analysisContent.innerHTML = '<div style="color: #888;">解析中...</div>';
  analysisPanel.style.display = 'block';

  const result = await window.electronAPI.analyzeError(recentHistory);

  if (result.success && result.analysis) {
    analysisContent.innerHTML = '';
    const lines = result.analysis.split('\n');
    lines.forEach((line: string) => {
      const div = document.createElement('div');
      div.textContent = line;
      div.style.marginBottom = '8px';
      analysisContent.appendChild(div);
    });
  } else {
    analysisContent.innerHTML = `<div style="color: #ff4444;">エラー解析に失敗しました: ${result.message}</div>`;
  }
}

window.electronAPI.onPythonOutput((data: string) => {
  appendToTerminal(data, 'output');

  if (checkForError(data)) {
    setTimeout(() => analyzeCurrentError(), 500);
  }
});

window.electronAPI.onPythonError((data: string) => {
  appendToTerminal(data, 'error');

  if (checkForError(data)) {
    setTimeout(() => analyzeCurrentError(), 500);
  }
});

window.electronAPI.onPythonClosed((code: number) => {
  appendToTerminal(`\nPython process exited with code ${code}`, 'system');
});

terminalInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const command = terminalInput.value;
    const promptEl = document.getElementById('prompt') as HTMLSpanElement;

    if (isMultiLineMode) {
      if (command.trim() === '') {
        appendToTerminal('', 'input');
        await window.electronAPI.sendToPython('');
        const fullCommand = multiLineBuffer.join('\n');
        commandHistory.push(fullCommand);
        multiLineBuffer = [];
        isMultiLineMode = false;
        currentIndent = 0;
        promptEl.textContent = '>>>';
        terminalInput.value = '';
      } else {
        appendToTerminal(`... ${command}`, 'input');
        await window.electronAPI.sendToPython(command);
        multiLineBuffer.push(command);
        const trimmed = command.trimStart();
        const leadingSpaces = command.length - trimmed.length;
        if (command.trim().endsWith(':')) {
          currentIndent = leadingSpaces + 4;
        } else if (trimmed.length === 0) {
          currentIndent = 0;
        } else {
          currentIndent = leadingSpaces;
        }
        terminalInput.value = ' '.repeat(currentIndent);
      }
    } else {
      if (command.trim() === '') {
        return;
      }
      appendToTerminal(`>>> ${command}`, 'input');
      await window.electronAPI.sendToPython(command);
      if (command.trim().endsWith(':')) {
        isMultiLineMode = true;
        multiLineBuffer.push(command);
        currentIndent = (command.length - command.trimStart().length) + 4;
        promptEl.textContent = '...';
        terminalInput.value = ' '.repeat(currentIndent);
      } else {
        commandHistory.push(`>>> ${command}`);
        terminalInput.value = '';
      }
    }
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const result = await window.electronAPI.startPython();
  if (!result.success) {
    appendToTerminal(`Failed to start Python: ${result.message}`, 'error');
  }
});