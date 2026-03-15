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
      const text = (item.text || "") + "\n" + (item.html || "");
      // Prefer 8-digit OTPs from Garena body
      let found = text.match(/\b\d{8}\b/);
      if (!found) {
        // fallback to 6-digit
        found = text.match(/\b\d{6}\b/);
      }
      if (found) return found[0];
    }
    await sleep(3000);
  }
  throw new Error("OTP timeout");
}

async function register(){
  try {
    const user = generateUsername();
    const pass = generatePassword();

    const usernameI = document.querySelector('input[placeholder="Tên truy cập"]');
    const passwordI = document.querySelector('input[placeholder="Mật khẩu"]');
    const repassI = document.querySelector('input[placeholder="Nhập lại mật khẩu"]');
    const emailI = document.querySelector('input[type="email"]');
    const otpI = document.querySelector('input[type="tel"]');
    const otpBtn = document.querySelector('.verification button');
    const regBtn = document.querySelector('button.primary');

    if (!usernameI || !passwordI || !repassI || !emailI || !otpI || !otpBtn || !regBtn) {
      console.error('Missing one or more fields.');
      return;
    }

    usernameI.value = user;
    passwordI.value = pass;
    repassI.value = pass;

    const mail = await generateTempEmail();
    emailI.value = mail.address;

    otpBtn.click();

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
