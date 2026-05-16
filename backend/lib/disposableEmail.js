/**
 * CheckDisposable Email integration.
 * Detects disposable/temporary email addresses at signup.
 * Fails open — if the API is unreachable, signups are not blocked.
 */

async function isDisposable(email) {
  try {
    const res = await fetch(
      `https://api.checkdisposable.email/v1/check?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${process.env.CDE_KEY}` } }
    );
    if (!res.ok) return false; // fail open
    const data = await res.json();
    return data.is_disposable === true;
  } catch {
    return false; // fail open
  }
}

export { isDisposable };
