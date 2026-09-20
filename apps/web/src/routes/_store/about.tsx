import { Link, createFileRoute } from '@tanstack/react-router'
import { buttonClasses } from '#/components/ui/button'
import { Container, SectionHeading } from '#/components/ui/layout'

export const Route = createFileRoute('/_store/about')({
  head: () => ({
    meta: [
      { title: 'About us — liza-arch' },
      { name: 'description', content: 'The studio behind liza-arch floor plans and interior drawings.' },
    ],
  }),
  component: AboutPage,
})

const VALUES = [
  {
    title: 'Drawn to be built',
    text: 'Every plan is produced as a working drawing — dimensioned, coordinated and ready for your contractor, not just a pretty render.',
  },
  {
    title: 'Honest details',
    text: 'Plot sizes, floor areas, room counts and prices are shown up front. What you see on the product page is exactly what you receive.',
  },
  {
    title: 'Instant access',
    text: 'Plans are delivered digitally the moment your payment completes, and your purchases remain available in your account.',
  },
]

function AboutPage() {
  return (
    <div>
      <section className="border-b border-line bg-surface">
        <Container className="max-w-3xl py-16 lg:py-24">
          <p className="text-sm font-medium text-ink-soft">About us</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            A small studio with a drafting table and a simple idea.
          </h1>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-ink-soft">
            <p>
              liza-arch began with a frustration we kept hearing from people planning their first
              build: good architectural drawings were hard to find, expensive to commission, and
              slow to receive. So we started drawing the plans we wished existed — practical homes
              and interiors for common plot sizes, priced for real budgets.
            </p>
            <p>
              Today we publish those drawings as digital products. Each floor plan comes with its
              dimensions, room details and elevation image; each interior plan includes a free
              preview and a complete working drawing. You buy what you need, download it
              immediately, and take it straight to your site.
            </p>
            <p>
              We are a small team, and every plan that goes up for sale is one we drew ourselves.
              If something you need is not in the catalog yet, tell us — requests shape what we
              draw next.
            </p>
          </div>
        </Container>
      </section>

      <section className="border-b border-line">
        <Container className="py-16">
          <SectionHeading title="What we stand for" />
          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line-subtle md:grid-cols-3">
            {VALUES.map((value) => (
              <div key={value.title} className="bg-surface p-6">
                <p className="font-medium text-ink">{value.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{value.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-line bg-surface p-8 shadow-card">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                Have a plot in mind?
              </h2>
              <p className="mt-2 max-w-md text-sm text-ink-soft">
                Browse the catalog by your plot dimensions, or write to us if you need something
                specific.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/floor-plans" className={buttonClasses('primary', 'md')}>
                Browse floor plans
              </Link>
              <Link to="/contact" className={buttonClasses('secondary', 'md')}>
                Contact us
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
