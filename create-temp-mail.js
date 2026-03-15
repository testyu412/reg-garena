const fetch = globalThis.fetch || require('node-fetch');

async function createTempMail() {
  const domainsRes = await fetch('https://api.mail.tm/domains');
  if (!domainsRes.ok) throw new Error('Failed to fetch domains: ' + domainsRes.status);
  const domainsData = await domainsRes.json();
  const domains = domainsData['hydra:member'] || [];
  if (!domains.length) throw new Error('No domains available');

  const domain = domains[0].domain;
  const address = `test${Date.now()}@${domain}`;
  const password = '123456';

  const accountRes = await fetch('https://api.mail.tm/accounts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({address, password})
  });
  if (!accountRes.ok) {
    const text = await accountRes.text();
    throw new Error('Account creation failed: ' + accountRes.status + ' ' + text);
  }

  const tokenRes = await fetch('https://api.mail.tm/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({address, password})
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error('Token creation failed: ' + tokenRes.status + ' ' + text);
  }

  const tokenData = await tokenRes.json();
  console.log('address=' + address);
  console.log('password=' + password);
  console.log('token=' + tokenData.token);
  console.log('account created successfully.');
  return {address, password, token: tokenData.token};
}

createTempMail().catch(err => {
  console.error('Error:', err.message || err);
  process.exit(1);
});