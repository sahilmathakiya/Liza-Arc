import { useState } from 'react'
import { downloadPaidAsset } from '#/lib/download'
import type { AssetKind } from '#/lib/products'

export function usePaidDownload() {
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function download(key: string, productId: string, kind: AssetKind, fallbackFilename: string) {
    setPendingKey(key)
    setError(null)
    try {
      await downloadPaidAsset(productId, kind, fallbackFilename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setPendingKey(null)
    }
  }

  return { download, pendingKey, error }
}
