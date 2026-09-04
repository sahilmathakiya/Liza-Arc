import { useState } from 'react'
import type { FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FormError } from '#/components/auth/form-error'
import { Button } from '#/components/ui/button'
import { Input, Label, Textarea } from '#/components/ui/field'
import { Container } from '#/components/ui/layout'

export const Route = createFileRoute('/_store/contact')({
  head: () => ({
    meta: [
      { title: 'Contact — liza-arch' },
      { name: 'description', content: 'Get in touch with the liza-arch studio.' },
    ],
  }),
  component: ContactPage,
})

const CONTACT_EMAIL = 'hello@lizaarch.in'

const DETAILS = [
  { label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { label: 'Phone', value: '+91 98765 43210', href: 'tel:+919876543210' },
  { label: 'Studio', value: 'Bengaluru, India' },
]

function ContactPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get('name') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const message = String(formData.get('message') ?? '').trim()
    if (!name || !email || !message) {
      setError('Please fill in your name, email and message.')
      return
    }
    const subject = encodeURIComponent(`Enquiry from ${name}`)
    const body = encodeURIComponent(`${message}\n\n${name}\n${email}`)
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
    setSent(true)
  }

  return (
    <div className="border-b border-line bg-surface">
      <Container className="grid gap-12 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <p className="text-sm font-medium text-ink-soft">Contact</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            Talk to the studio.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft">
            Questions about a plan, a custom plot size, or anything else — send a message and we
            will get back to you within two working days.
          </p>
          <dl className="mt-10 space-y-5">
            {DETAILS.map((detail) => (
              <div key={detail.label}>
                <dt className="text-xs uppercase tracking-wide text-ink-faint">{detail.label}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {detail.href ? (
                    <a href={detail.href} className="transition hover:underline">
                      {detail.value}
                    </a>
                  ) : (
                    detail.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-canvas p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-ink">Send a message</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="contact-name">Name</Label>
              <Input id="contact-name" name="name" required autoComplete="name" placeholder="Your name" />
            </div>
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                name="message"
                rows={5}
                required
                placeholder="Tell us about your plot or question"
              />
            </div>
            <FormError message={error} />
            <Button type="submit" size="lg" className="w-full">
              Send message
            </Button>
            {sent && (
              <p className="text-sm text-ink-soft">
                Your email app should have opened with the message — just press send.
              </p>
            )}
          </form>
        </div>
      </Container>
    </div>
  )
}
