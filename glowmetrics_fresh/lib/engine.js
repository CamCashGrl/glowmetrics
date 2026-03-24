const TOKEN_VALUE = 0.05;

// -------------------------------
// SAFE NUMBER PARSER
// -------------------------------
function toNumber(val) {
  if (!val) return 0;
  const num = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? 0 : num;
}

// -------------------------------
// NORMALIZE ROW
// -------------------------------
function normalizeRow(row) {
  const tokens =
    toNumber(row.tokens) ||
    toNumber(row.amount) ||
    toNumber(row.tip_amount) ||
    0;

  const username =
    row.username ||
    row.user ||
    row.member ||
    "anonymous";

  const timestamp =
    new Date(row.timestamp || row.date || Date.now());

  return {
    username,
    tokens,
    usd: tokens * TOKEN_VALUE,
    timestamp,
  };
}

// -------------------------------
// MAIN ENGINE
// -------------------------------
export function runEngine(rawRows = []) {
  const rows = rawRows.map(normalizeRow);

  let totalTokens = 0;
  let totalUSD = 0;

  const userMap = {};
  const hourlyMap = {};

  rows.forEach((row) => {
    totalTokens += row.tokens;
    totalUSD += row.usd;

    // USER
    if (!userMap[row.username]) {
      userMap[row.username] = {
        username: row.username,
        tokens: 0,
        usd: 0,
        tips: 0,
        firstSeen: row.timestamp,
        lastSeen: row.timestamp,
      };
    }

    const user = userMap[row.username];
    user.tokens += row.tokens;
    user.usd += row.usd;
    user.tips += 1;
    user.lastSeen = row.timestamp;

    // HOURLY
    const hour = row.timestamp.getHours();
    if (!hourlyMap[hour]) {
      hourlyMap[hour] = { hour, tokens: 0, usd: 0 };
    }

    hourlyMap[hour].tokens += row.tokens;
    hourlyMap[hour].usd += row.usd;
  });

  const users = Object.values(userMap);

  const whales = users
    .filter((u) => u.tokens >= 1000)
    .sort((a, b) => b.tokens - a.tokens);

  const topUsers = users
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10);

  const hourly = Object.values(hourlyMap).sort(
    (a, b) => a.hour - b.hour
  );

  const avgTip =
    rows.length > 0 ? totalTokens / rows.length : 0;

  return {
    totals: {
      tokens: totalTokens,
      usd: totalUSD,
      tips: rows.length,
      avgTip,
    },
    users,
    whales,
    topUsers,
    hourly,
    raw: rows,
  };
}
