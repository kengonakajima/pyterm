const terminalOutput = document.getElementById('terminal-output') as HTMLDivElement;
const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
const analysisPanel = document.getElementById('analysis-panel') as HTMLDivElement;
const analysisContent = document.getElementById('analysis-content') as HTMLDivElement;

let commandHistory: string[] = [];
let multiLineBuffer: string[] = [];
let isMultiLineMode = false;
let currentIndent = 0;
let conversationHistory: Array<{role: string, content: string}> = [];

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

terminalInput.addEventListener('paste', async (e) => {
  e.preventDefault();
  const pastedText = e.clipboardData?.getData('text') || '';

  if (pastedText.includes('\n')) {
    const lines = pastedText.split('\n');
    const promptEl = document.getElementById('prompt') as HTMLSpanElement;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (i === 0 && terminalInput.value) {
        const combinedLine = terminalInput.value + line;
        appendToTerminal(`${promptEl.textContent} ${combinedLine}`, 'input');
        await window.electronAPI.sendToPython(combinedLine);
        terminalInput.value = '';

        if (combinedLine.trim().endsWith(':')) {
          isMultiLineMode = true;
          multiLineBuffer.push(combinedLine);
          promptEl.textContent = '...';
          currentIndent = 4;
        }
      } else if (line.trim() !== '' || isMultiLineMode) {
        if (isMultiLineMode) {
          if (line.trim() === '') {
            appendToTerminal('', 'input');
            await window.electronAPI.sendToPython('');
            const fullCommand = multiLineBuffer.join('\n');
            commandHistory.push(fullCommand);
            multiLineBuffer = [];
            isMultiLineMode = false;
            currentIndent = 0;
            promptEl.textContent = '>>>';
          } else {
            appendToTerminal(`... ${line}`, 'input');
            await window.electronAPI.sendToPython(line);
            multiLineBuffer.push(line);

            if (line.trim().endsWith(':')) {
              const leadingSpaces = line.length - line.trimStart().length;
              currentIndent = leadingSpaces + 4;
            }
          }
        } else {
          appendToTerminal(`>>> ${line}`, 'input');
          await window.electronAPI.sendToPython(line);

          if (line.trim().endsWith(':')) {
            isMultiLineMode = true;
            multiLineBuffer.push(line);
            promptEl.textContent = '...';
            currentIndent = 4;
          } else {
            commandHistory.push(`>>> ${line}`);
          }
        }
      }
    }

    if (isMultiLineMode) {
      terminalInput.value = ' '.repeat(currentIndent);
    }
  } else {
    const start = terminalInput.selectionStart || 0;
    const end = terminalInput.selectionEnd || 0;
    const currentValue = terminalInput.value;
    terminalInput.value = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
    terminalInput.selectionStart = terminalInput.selectionEnd = start + pastedText.length;
  }
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
  const apiKeyModal = document.getElementById('api-key-modal') as HTMLDivElement;
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
  const saveApiKeyButton = document.getElementById('save-api-key-button') as HTMLButtonElement;

  const apiKeyResult = await window.electronAPI.getApiKey();
  if (!apiKeyResult.apiKey) {
    apiKeyModal.style.display = 'flex';
  }

  saveApiKeyButton.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      await window.electronAPI.setApiKey(key);
      apiKeyModal.style.display = 'none';
      apiKeyInput.value = '';
    }
  });

  apiKeyInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const key = apiKeyInput.value.trim();
      if (key) {
        await window.electronAPI.setApiKey(key);
        apiKeyModal.style.display = 'none';
        apiKeyInput.value = '';
      }
    }
  });

  const result = await window.electronAPI.startPython();
  if (!result.success) {
    appendToTerminal(`Failed to start Python: ${result.message}`, 'error');
  }

  const analysisInput = document.getElementById('analysis-input') as HTMLInputElement;
  const sendButton = document.getElementById('send-button') as HTMLButtonElement;

  async function sendQuestion() {
    const question = analysisInput.value.trim();

    if (!question) return;

    analysisContent.innerHTML = '<div style="color: #888;">回答を生成中...</div>';

    const recentHistory = commandHistory.slice(-50).join('\n');
    const result = await window.electronAPI.askAI(question, recentHistory, conversationHistory);

    if (result.success && result.answer) {
      conversationHistory.push({ role: 'user', content: question });
      conversationHistory.push({ role: 'assistant', content: result.answer });

      analysisContent.innerHTML = '';
      conversationHistory.forEach((msg) => {
        const msgDiv = document.createElement('div');
        msgDiv.style.marginBottom = '16px';

        if (msg.role === 'user') {
          const questionDiv = document.createElement('div');
          questionDiv.style.color = '#4ec9b0';
          questionDiv.style.fontWeight = 'bold';
          questionDiv.style.marginBottom = '8px';
          questionDiv.textContent = `質問: ${msg.content}`;
          msgDiv.appendChild(questionDiv);
        } else {
          const lines = msg.content.split('\n');
          lines.forEach((line: string) => {
            const div = document.createElement('div');
            div.textContent = line;
            div.style.marginBottom = '4px';
            msgDiv.appendChild(div);
          });
        }

        analysisContent.appendChild(msgDiv);
      });

      analysisContent.scrollTop = analysisContent.scrollHeight;
    } else {
      analysisContent.innerHTML = `<div style="color: #ff4444;">回答の生成に失敗しました: ${result.message}</div>`;
    }

    analysisInput.value = '';
  }

  sendButton.addEventListener('click', sendQuestion);
});