// Anonymous, no accounts (Q6): a device is identified by a persistent local id,
// used only for the tend cooldown and personal stats. Cleared storage = a new "person",
// which is fine — the real server backstops abuse with an IP flood-ceiling.
const KEY = 'internetree:device'

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // storage blocked (private mode / disabled) → ephemeral per-session id
    return crypto.randomUUID()
  }
}
