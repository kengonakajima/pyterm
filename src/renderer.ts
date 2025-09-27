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

  const loadingDiv = document.createElement('div');
  loadingDiv.style.color = '#888';
  loadingDiv.style.marginBottom = '16px';
  loadingDiv.textContent = 'エラー解析中...';
  analysisContent.appendChild(loadingDiv);
  analysisContent.scrollTop = analysisContent.scrollHeight;

  const result = await window.electronAPI.analyzeError(recentHistory);

  analysisContent.removeChild(loadingDiv);

  if (result.success && result.analysis) {
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = '16px';
    msgDiv.style.paddingBottom = '16px';
    msgDiv.style.borderBottom = '1px solid #333';

    const titleDiv = document.createElement('div');
    titleDiv.style.color = '#ff6b6b';
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.marginBottom = '8px';
    titleDiv.textContent = 'エラー解析:';
    msgDiv.appendChild(titleDiv);

    const lines = result.analysis.split('\n');
    lines.forEach((line: string) => {
      const div = document.createElement('div');
      div.textContent = line;
      div.style.marginBottom = '4px';
      msgDiv.appendChild(div);
    });

    analysisContent.appendChild(msgDiv);
    analysisContent.scrollTop = analysisContent.scrollHeight;
  } else {
    const errorDiv = document.createElement('div');
    errorDiv.style.color = '#ff4444';
    errorDiv.style.marginBottom = '16px';
    errorDiv.textContent = `エラー解析に失敗しました: ${result.message}`;
    analysisContent.appendChild(errorDiv);
    analysisContent.scrollTop = analysisContent.scrollHeight;
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

    const questionDiv = document.createElement('div');
    questionDiv.style.marginBottom = '16px';
    questionDiv.style.paddingBottom = '16px';
    questionDiv.style.borderBottom = '1px solid #333';

    const questionTitle = document.createElement('div');
    questionTitle.style.color = '#4ec9b0';
    questionTitle.style.fontWeight = 'bold';
    questionTitle.style.marginBottom = '8px';
    questionTitle.textContent = `質問: ${question}`;
    questionDiv.appendChild(questionTitle);
    analysisContent.appendChild(questionDiv);

    const loadingDiv = document.createElement('div');
    loadingDiv.style.color = '#888';
    loadingDiv.style.marginBottom = '16px';
    loadingDiv.textContent = '回答を生成中...';
    analysisContent.appendChild(loadingDiv);
    analysisContent.scrollTop = analysisContent.scrollHeight;

    const recentHistory = commandHistory.slice(-50).join('\n');
    const result = await window.electronAPI.askAI(question, recentHistory, conversationHistory);

    analysisContent.removeChild(loadingDiv);

    if (result.success && result.answer) {
      conversationHistory.push({ role: 'user', content: question });
      conversationHistory.push({ role: 'assistant', content: result.answer });

      const answerDiv = document.createElement('div');
      answerDiv.style.marginBottom = '16px';
      answerDiv.style.paddingBottom = '16px';
      answerDiv.style.borderBottom = '1px solid #333';

      const lines = result.answer.split('\n');
      lines.forEach((line: string) => {
        const div = document.createElement('div');
        div.textContent = line;
        div.style.marginBottom = '4px';
        answerDiv.appendChild(div);
      });

      analysisContent.appendChild(answerDiv);
      analysisContent.scrollTop = analysisContent.scrollHeight;
    } else {
      const errorDiv = document.createElement('div');
      errorDiv.style.color = '#ff4444';
      errorDiv.style.marginBottom = '16px';
      errorDiv.textContent = `回答の生成に失敗しました: ${result.message}`;
      analysisContent.appendChild(errorDiv);
      analysisContent.scrollTop = analysisContent.scrollHeight;
    }

    analysisInput.value = '';
  }

  sendButton.addEventListener('click', sendQuestion);
});