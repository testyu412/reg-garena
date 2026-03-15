const fetch = globalThis.fetch || require('node-fetch');

async function main(){
  const address = process.argv[2];
  const password = process.argv[3] || '123456';
  if (!address){
    console.error('Usage: node get-mail.js <address> [password]');
    process.exit(1);
  }
  const tokenRes = await fetch('https://api.mail.tm/token', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({address, password})
  });
  const token = (await tokenRes.json()).token;
  if (!token) { console.error('Token fail', await tokenRes.text()); return; }

  const messagesRes = await fetch('https://api.mail.tm/messages', {
    headers: {Authorization: `Bearer ${token}`}
  });
  const inbox = await messagesRes.json();
  console.log('messages', JSON.stringify(inbox, null, 2));
}

main().catch(err=>{console.error(err); process.exit(1);});