export interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

export interface RazorpayCheckoutOptions {
  key: string
  order_id: string
  amount: number
  currency: string
  name: string
  description?: string
  prefill?: { name?: string; email?: string }
  theme?: { color?: string }
  handler: (response: RazorpayHandlerResponse) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open: () => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

const CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

let loader: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('The payment window can only be opened in the browser'))
  }
  if (window.Razorpay) return Promise.resolve()
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = CHECKOUT_URL
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        loader = null
        reject(new Error('Could not load the payment window — check your connection and try again'))
      }
      document.head.appendChild(script)
    })
  }
  return loader
}
