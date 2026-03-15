const fetch = globalThis.fetch || require('node-fetch');

function getNextCounter(){
  const key = 'garena-lploz-counter';
  let value = 0;
  if (globalThis.localStorage) {
    value = parseInt(globalThis.localStorage.getItem(key) || '0', 10);
  } else {
    value = parseInt(process.env.LPLOZ_COUNTER || '0', 10) || 0;
  }
  if (isNaN(value) || value < 0) value = 0;
  value += 1;
  if (globalThis.localStorage) {
    globalThis.localStorage.setItem(key, String(value));
  }
  process.env.LPLOZ_COUNTER = String(value);
  return value;
}

function getPrefix(){
  const key = 'garena-lploz-prefix';
  let prefix;
  if (globalThis.localStorage) {
    prefix = globalThis.localStorage.getItem(key);
    if (!prefix) {
      prefix = String(Math.floor(Math.random() * 900) + 100);
      globalThis.localStorage.setItem(key, prefix);
    }
  } else {
    prefix = process.env.LPLOZ_PREFIX;
    if (!prefix) {
      prefix = String(Math.floor(Math.random() * 900) + 100);
      process.env.LPLOZ_PREFIX = prefix;
    }
  }
  return prefix;
}

function generateUsername(){
  const counter = getNextCounter();
  const prefix = getPrefix();
  return `lploz.${prefix}${String(counter).padStart(3, '0')}`;
}

function generatePassword(){
  const digits = Math.floor(Math.random() * 1e8).toString().padStart(8, '0');
  return `LP@${digits}`;
}

async function getDomains(){
  const res = await fetch('https://api.mail.tm/domains');
  const d = await res.json();
  return d['hydra:member']?.map(x=>x.domain) || [];
}

async function runTest(){
  console.log('--- Pattern test output ---');
  for (let i=0;i<5;i++) {
    console.log('username:', generateUsername());
    console.log('password:', generatePassword());
  }
  const domains = await getDomains();
  console.log('mail.tm domains sample:', domains.slice(0,3));
}

runTest().catch(e=>{ console.error(e); process.exit(1); });
