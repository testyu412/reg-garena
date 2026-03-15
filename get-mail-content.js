const fetch = globalThis.fetch || require('node-fetch');

async function main(){
  const address = process.argv[2];
  const password = process.argv[3] || '123456';
  if (!address) {
    console.error('Usage: node get-mail-content.js <address> [password]');
    process.exit(1);
  }

  // get token
  const tokenRes = await fetch('https://api.mail.tm/token', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({address, password})
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.token) throw new Error('Token fetch failed: ' + JSON.stringify(tokenData));
  const token = tokenData.token;

  const listRes = await fetch('https://api.mail.tm/messages', {
    headers: {Authorization: `Bearer ${token}`}
  });
  const list = await listRes.json();
  const msgs = list['hydra:member'] || [];
  console.log('Found', msgs.length, 'messages');
  for (const msg of msgs) {
    console.log('---', msg.id, msg.subject, msg.from?.address, msg.createdAt);
    const mres = await fetch(`https://api.mail.tm/messages/${msg.id}`, {
      headers: {Authorization: `Bearer ${token}`}
    });
    const m = await mres.json();
    console.log('From:', m.from?.address);
    console.log('Subject:', m.subject);
    console.log('Text snippet:', (m.text || '').slice(0, 400));
    console.log('HTML snippet:', (m.html || '').slice(0, 400));
    const allText = (m.text || '') + '\n' + (m.html || '');
    const otp = allText.match(/\b\d{4,8}\b/);
    if (otp) console.log('OTP found:', otp[0]);
    console.log('\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });