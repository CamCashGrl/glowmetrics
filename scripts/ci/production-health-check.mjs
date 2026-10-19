// Read-only public HTTP checks. No database credentials or test data writes.
for (const pathname of ['/', '/api/health']) {
  const response = await fetch(`https://www.camcashgrl.com${pathname}`, { signal: AbortSignal.timeout(30000) })
  if (response.status !== 200 && !(pathname === '/api/health' && response.status === 404)) throw new Error(`Health check ${pathname}: HTTP ${response.status}`)
  console.log(`${pathname}: HTTP ${response.status}`)
  await response.body?.cancel()
}
