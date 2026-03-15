const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const statusBtn = document.getElementById('status');
const clearBtn = document.getElementById('clear');
const testBtn = document.getElementById('test');
const downloadBtn = document.getElementById('download');
const stateEl = document.getElementById('state');
const successEl = document.getElementById('success');
const failEl = document.getElementById('fail');
const countInput = document.getElementById('count');
const logEl = document.getElementById('log');

function getActiveTab() {
  return chrome.tabs.query({active: true, currentWindow: true});
}

async function sendMessage(cmd, count=1) {
  const tabs = await getActiveTab();
  if (!tabs[0]?.id) return {error: 'No active tab'};
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabs[0].id, {cmd, count}, (response) => {
      if (chrome.runtime.lastError) {
        resolve({error: chrome.runtime.lastError.message});
        return;
      }
      resolve(response);
    });
  });
}

async function refreshStatus() {
  const data = await sendMessage('status');
  if (!data) {
    appendLog('No response from content script');
    stateEl.innerText = 'no script';
    return;
  }
  if (data.error) {
    appendLog('Error: ' + data.error);
    stateEl.innerText = 'no script';
    return;
  }
  stateEl.innerText = data.status || 'idle';
  successEl.innerText = data.success || 0;
  failEl.innerText = data.fail || 0;
  logEl.innerHTML = (data.logs || []).slice().reverse().map(x => `<div>${x}</div>`).join('');
}

startBtn.onclick = async () => {
  const count = Number(countInput?.value || 1);
  const result = await sendMessage('startRegister', count);
  if (result?.error) {
    appendLog('Error sending msg: ' + result.error);
    stateEl.innerText = 'no script';
    return;
  }
  await refreshStatus();
};

stopBtn.onclick = async () => {
  await sendMessage('stopRegister');
  stateEl.innerText = 'stopped';
  appendLog('Đã nhấn dừng.');
};
statusBtn.onclick = refreshStatus;
clearBtn.onclick = async () => { await sendMessage('clear'); await refreshStatus(); };
testBtn.onclick = async () => {
  const result = await sendMessage('testGenerate');
  if (result) {
    appendLog(`Test: ${result.username} | ${result.password}`);
  }
};
downloadBtn.onclick = () => {
  chrome.downloads.download({
    url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(localStorage.getItem('garena-acc-file') || ''),
    filename: 'acc.txt'
  });
};

function appendLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logEl.innerHTML = `<div>${line}</div>` + logEl.innerHTML;
}

refreshStatus();
