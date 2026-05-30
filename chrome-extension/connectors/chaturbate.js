const CB_ENDPOINT = 'https://chaturbate.com/api/ts/tipping/token-stats/';
const SUPABASE_URL = 'https://hlsdlaibnayzbfflxclj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc2RsYWlibmF5emJmZmx4Y2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MjQwODUsImV4cCI6MjA4OTIwMDA4NX0.5FwPe35UL-o46FvBJX526La5o7jcbFaP1KVoLtI4U_M';

async function getCBCookies() {
  return new Promise(resolve => {
    chrome.cookies.getAll({ domain: 'chaturbate.com' }, cookies => {
      resolve({
        sessionid: cookies.find(c => c.name === 'sessionid')?.value || null,
        csrftoken: cookies.find(c => c.name === 'csrftoken')?.value || null,
      });
    });
  });
}

async function fetchPage(maxTransactionId, csrftoken) {
  const url = `${CB_ENDPOINT}?max_transaction_id=${maxTransactionId}&cashpage=0`;
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'X-CSRFToken': csrftoken,
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json',
    },
  });
  if (res.status === 401 || res.status === 403) {
    const e = new Error('Session expired'); e.code = 'SESSION_EXPIRED'; throw e;
  }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function upsertBatch(tips, accessToken, userId) {
  if (!tips.length) return;
  const rows = tips.map(t => ({
    user_id: userId,
    date_time: t.date,
    platform: 'Chaturbate',
    username: t.username,
    tip_type: 'Tip',
    tokens: Math.abs(t.tokens),
    usd: parseFloat((Math.abs(t.tokens) * 0.05).toFixed(2)),
    tip_note: t.message || '',
    upload_id: 'one_click_sync',
    tip_seq: 1,
  }));
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_tips_dedup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ tips: rows }),
  });
}

async function syncChaturbateConnector({ userId, accessToken, onProgress }) {
  const { sessionid, csrftoken } = await getCBCookies();
  if (!sessionid || !csrftoken) {
    onProgress({ error: 'Not logged into Chaturbate. Please log in first.', done: true });
    return;
  }
  let maxTransactionId = '';
  let pagesLoaded = 0;
  let totalTips = 0;
  while (true) {
    let data;
    try {
      data = await fetchPage(maxTransactionId, csrftoken);
    } catch (err) {
      onProgress({
        error: err.code === 'SESSION_EXPIRED'
          ? 'Chaturbate session expired. Log in to Chaturbate and try again.'
          : 'Sync error: ' + err.message,
        done: true
      });
      return;
    }
    const { transactions, txns_fully_loaded } = data;
    if (!transactions || !transactions.length) break;
    const tips = transactions.filter(t => t.tokens > 0 && t.description === 'Tip received');
    if (tips.length) {
      await upsertBatch(tips, accessToken, userId);
      totalTips += tips.length;
    }
    pagesLoaded++;
    onProgress({ pagesLoaded, tipsFound: totalTips, done: false });
    if (txns_fully_loaded) break;
    const lowestId = Math.min(...transactions.map(t => t.id));
    maxTransactionId = lowestId;
    await new Promise(r => setTimeout(r, 1500));
  }
  onProgress({ pagesLoaded, tipsFound: totalTips, done: true });
}
