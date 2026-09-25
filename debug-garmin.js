const db = require('./src/database');
const settings = db.getSettings();

async function testSSO() {
  const email = settings.garmin_username;
  const password = settings.garmin_password;
  console.log('Testing with username:', email);

  const ssoUrl = 'https://sso.garmin.com/sso/signin?service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&clientId=GarminConnect&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&consumeServiceTicket=false';

  const res = await fetch(ssoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    }
  });

  console.log('SSO GET Status:', res.status);
  const cookies = res.headers.get('set-cookie') || '';
  console.log('Set-Cookie length:', cookies.length);

  const text = await res.text();
  console.log('Page text length:', text.length);

  // Check for CSRF
  const csrfMatch = text.match(/name="_csrf"\s+value="([^"]+)"/);
  console.log('CSRF token found:', csrfMatch ? csrfMatch[1] : 'NONE');

  // Let's test the POST
  const body = new URLSearchParams({
    username: email,
    password: password,
    embed: 'true',
    _eventId: 'submit'
  });

  if (csrfMatch) {
    body.append('_csrf', csrfMatch[1]);
  }

  const postRes = await fetch(ssoUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cookie': cookies,
      'Referer': ssoUrl,
      'Origin': 'https://sso.garmin.com'
    },
    body: body.toString()
  });

  console.log('POST status:', postRes.status);
  const postText = await postRes.text();
  console.log('POST text preview (first 400 chars):', postText.substring(0, 400));
  
  if (postText.includes('ticket=')) {
    console.log('SUCCESS! Ticket found!');
  } else if (postText.includes('MFA') || postText.includes('mfa') || postText.includes('verification-code')) {
    console.log('MFA REQUIRED!');
  } else if (postText.includes('captcha') || postText.includes('Cloudflare') || postText.includes('Akamai')) {
    console.log('CAPTCHA / BOT PROTECTION DETECTED');
  } else {
    // Check if error message displayed
    const errorMatch = postText.match(/class="[^"]*error[^"]*"[^>]*>([^<]+)</i);
    console.log('Error in HTML:', errorMatch ? errorMatch[1] : 'Unknown');
  }
}

testSSO().catch(console.error);
