// Single source for sharing — native share sheet where available, clipboard fallback.
export function share(text: string): void {
  const url = window.location.href
  if (navigator.share) {
    navigator.share({ title: 'Internetree', text, url }).catch(() => {})
  } else {
    navigator.clipboard?.writeText(`${text} ${url}`)
  }
}
