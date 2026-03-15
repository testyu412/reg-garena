function getNextCounter(){
  const key = 'garena-lploz-counter';
  let value = parseInt(localStorage.getItem(key) || '0', 10);
  if (isNaN(value) || value < 0) value = 0;
  value += 1;
  localStorage.setItem(key, String(value));
  return value;
}

function getPrefix(){
  const key = 'garena-lploz-prefix';
  let value = localStorage.getItem(key);
  if (!value) {
    value = String(Math.floor(Math.random() * 900) + 100);
    localStorage.setItem(key, value);
  }
  return value;
}

function generateUsername(){
  const counter = getNextCounter();
  const prefix = getPrefix();
  const suffix = String(counter).padStart(3, '0');
  return `lploz.${prefix}${suffix}`;
}

function generatePassword(){
  const digits = Math.floor(Math.random() * 1e8).toString().padStart(8, '0');
  return `LP@${digits}`;
}

function appendLog(msg){
  const key = 'garena-reg-log';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push(`${new Date().toLocaleTimeString()} ${msg}`);
  localStorage.setItem(key, JSON.stringify(arr.slice(-40)));
}

function setRegisterState(state){
  localStorage.setItem('garena-reg-state', state);
}

function addResult(success){
  const key = success ? 'garena-reg-success' : 'garena-reg-fail';
  localStorage.setItem(key, String((parseInt(localStorage.getItem(key) || '0',10) || 0) + 1));
}

async function generateTempEmail(){
  const domainsRes = await fetch("https://api.mail.tm/domains");
  if (!domainsRes.ok) throw new Error("Failed to fetch domains");
  const domainsData = await domainsRes.json();
  const domains = domainsData['hydra:member'] || [];
  if (!domains.length) throw new Error("No domains available");
  const domain = domains[0].domain;
  const address = `test${Date.now()}@${domain}`;
  const password = "123456";
  const accountRes = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({address, password})
  });
  if (!accountRes.ok) {
    const text = await accountRes.text();
    throw new Error("Account creation failed: " + accountRes.status + " " + text);
  }
  const tokenRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({address, password})
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.token) throw new Error("Token creation failed");
  return { address, token: tokenData.token };
}

async function testGenerateCredentials(){
  const username = generateUsername();
  const password = generatePassword();
  const email = await generateTempEmail();
  console.log('TEST generated', {username, password, email: email.address});
  return {username, password, email};
}

async function sleep(ms){
  return new Promise(r=>setTimeout(r, ms));
}

async function waitOTP(token){
  const inboxUrl = "https://api.mail.tm/messages";
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  for (let i=0;i<40;i++) {
    const res = await fetch(inboxUrl, {headers});
    if (!res.ok) { await sleep(2500); continue; }
    const data = await res.json();
    const messages = data['hydra:member'] || [];
    if (messages.length > 0) {
      const msgId = messages[0].id;
      const itemRes = await fetch(`https://api.mail.tm/messages/${msgId}`, {headers});
      if (!itemRes.ok) { await sleep(2500); continue; }
      const item = await itemRes.json();
      const textBody = item.text || "";
      const htmlBody = item.html || "";
      // Try strong HTML pattern first (Garena puts OTP in <b> tag)
      let found = htmlBody.match(/<b[^>]*>(\d{6,8})<\/b>/i);
      if (!found) {
        // Try Garena phrasing in text, e.g. "Mã ..."
        found = textBody.match(/Mã\s*(?:xác minh|OTP|mã)?[^\d]*(\d{6,8})/i);
      }
      if (!found) {
        // fallback any 6-8 digit sequence
        found = (textBody + "\n" + htmlBody).match(/\b\d{6,8}\b/);
      }
      if (found) return found[1] || found[0];
    }
    await sleep(3000);
  }
  throw new Error("OTP timeout");
}

function findInput(candidates){
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  // fallback: match by placeholder text content
  const inputs = Array.from(document.querySelectorAll('input'));
  for (const input of inputs) {
    const placeholder = (input.placeholder || '').toLowerCase();
    for (const word of candidates) {
      if (word.startsWith('placeholder:')) {
        const text = word.replace('placeholder:', '').toLowerCase();
        if (placeholder.includes(text)) return input;
      }
    }
  }
  return null;
}

function findButtonByText(candidates){
  const buttons = Array.from(document.querySelectorAll('button'));
  for (const btn of buttons) {
    const text = (btn.innerText || btn.textContent || '').toLowerCase();
    if (!text) continue;
    for (const cand of candidates) {
      if (text.includes(cand.toLowerCase())) return btn;
    }
  }
  return null;
}

function findInputByLabelText(keywords){
  const labels = Array.from(document.querySelectorAll('label'));
  for (const label of labels) {
    const text = (label.innerText || label.textContent || '').toLowerCase();
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        if (label.htmlFor) {
          const input = document.getElementById(label.htmlFor);
          if (input) return input;
        }
        const input = label.querySelector('input');
        if (input) return input;
      }
    }
  }
  return null;
}

async function waitForButtonByText(candidates, timeout = 10000, interval = 250) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const btn = findButtonByText(candidates);
    if (btn) return btn;
    await sleep(interval);
  }
  return null;
}

async function waitForElement(selector, timeout = 10000, interval = 250){
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const el = document.querySelector(selector);
    if (el) return el;
    await sleep(interval);
  }
  return null;
}

async function register(){
  try {
    const user = generateUsername();
    const pass = generatePassword();

    const usernameI = findInput([
      'input[name=username]',
      'input[name=account]',
      'input[placeholder="Tên truy cập"]',
      'input[placeholder*="username"]',
      'input[placeholder*="tên đăng nhập"]',
      'input[placeholder*="tên truy cập"]',
      'input[id*=user]'
    ]) || await waitForElement('input[name=username], input[name=account], input[placeholder*="Tên"], input[placeholder*="user"], input[id*=user]');

    const passwordI = findInput([
      'input[name=password]',
      'input[placeholder="Mật khẩu"]',
      'input[placeholder*="password"]',
      'input[id*=pass]'
    ]) || await waitForElement('input[name=password], input[placeholder*="Mật khẩu"], input[placeholder*="password"], input[id*=pass]');

    const repassI = findInput([
      'input[name=confirmPassword]',
      'input[placeholder="Nhập lại mật khẩu"]',
      'input[placeholder*="nhập lại"]',
      'input[placeholder*="confirm"]',
      'input[id*=repass]'
    ]) || await waitForElement('input[name=confirmPassword], input[placeholder*="Nhập lại"], input[placeholder*="confirm"], input[id*=repass]');

    const emailI = findInput([
      'input[type=email]',
      'input[name=email]',
      'input[placeholder*="email"]',
      'input[id*=email]'
    ]) || await waitForElement('input[type=email], input[name=email], input[placeholder*="email"], input[id*=email]');

    const otpI = findInput([
      'input[type=tel]',
      'input[name=otp]',
      'input[placeholder*="otp"]',
      'input[placeholder*="mã"]',
      'input[id*=otp]'
    ]) || findInputByLabelText(['otp', 'mã', 'mã xác minh']) || await waitForElement('input[type=tel], input[name=otp], input[placeholder*=otp], input[id*=otp]');

    const otpBtn = findButtonByText(['gửi mã', 'send code', 'gửi', 'verify', 'xác minh']) || (await waitForButtonByText(['gửi mã', 'send code', 'gửi', 'verify', 'xác minh']));
    const regBtn = findButtonByText(['đăng ký', 'register', 'sign up', 'hoàn tất']) || (await waitForButtonByText(['đăng ký', 'register', 'sign up', 'hoàn tất']));

    const missing = [];
    if (!usernameI) missing.push('username');
    if (!passwordI) missing.push('password');
    if (!repassI) missing.push('confirm password');
    if (!emailI) missing.push('email');
    if (!otpI) missing.push('otp field');
    if (!otpBtn) missing.push('otp button');
    if (!regBtn) missing.push('register button');

    if (missing.length) {
      const msg = 'Missing fields: ' + missing.join(', ');
      console.error(msg);
      appendLog(msg);
      setRegisterState('error');
      addResult(false);
      return;
    }

    usernameI.value = user;
    passwordI.value = pass;
    repassI.value = pass;

    const mail = await generateTempEmail();
    emailI.value = mail.address;

    otpBtn.click();
    await sleep(500); // wait for OTP button action to trigger

    const otp = await waitOTP(mail.token);
    otpI.value = otp;
    regBtn.click();

    const acc = `${user}|${pass}|${mail.address}`;
    appendLog(`Đăng ký thành công: ${acc}`);
    addResult(true);
    setRegisterState('success');
    console.log(acc);
    console.log('Copy the account string from console to save.');
  } catch (e) {
    appendLog(`Đăng ký thất bại: ${e.message || e}`);
    addResult(false);
    setRegisterState('error');
    console.error('Register failed:', e);
  }
}

chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  if (!message || !message.cmd) return;

  if (message.cmd === 'startRegister') {
    setRegisterState('running');
    appendLog('Bắt đầu đăng ký...');
    register().then(() => sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));
    return true;
  }

  if (message.cmd === 'testGenerate') {
    const username = generateUsername();
    const password = generatePassword();
    appendLog(`Test gen ${username} ${password}`);
    sendResponse({username, password});
    return;
  }

  if (message.cmd === 'status') {
    const status = localStorage.getItem('garena-reg-state') || 'idle';
    const success = Number(localStorage.getItem('garena-reg-success') || 0);
    const fail = Number(localStorage.getItem('garena-reg-fail') || 0);
    const logs = JSON.parse(localStorage.getItem('garena-reg-log') || '[]');
    sendResponse({status, success, fail, logs});
    return;
  }

  if (message.cmd === 'clear') {
    localStorage.removeItem('garena-reg-log');
    localStorage.removeItem('garena-reg-success');
    localStorage.removeItem('garena-reg-fail');
    localStorage.removeItem('garena-reg-state');
    appendLog('Dữ liệu đã xóa.');
    sendResponse({ok:true});
    return;
  }
});

// Start automatically when flagged by popup
if (window.garenaRegisterStart) {
  window.garenaRegisterStart = false;
  setRegisterState('running');
  register();
}
