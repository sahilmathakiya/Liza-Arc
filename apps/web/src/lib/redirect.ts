export function sanitizeRedirect(url: unknown): string | undefined {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
    return undefined
  }
  return url
}
