import { Link, createFileRoute } from '@tanstack/react-router'
import { FloorPlanCard } from '#/components/store/floor-plan-card'
import { InteriorCard } from '#/components/store/interior-card'
import { buttonClasses } from '#/components/ui/button'
import { Container, SectionHeading } from '#/components/ui/layout'
import { listPublicFloorPlans, listPublicInteriorPlans } from '#/lib/products'

export const Route = createFileRoute('/_store/')({
  head: () => ({
    meta: [
      { title: 'liza-arch — Floor plans & interior plans' },
      {
        name: 'description',
        content:
          'Architect-drawn floor plans and interior working drawings. Browse, purchase and download instantly.',
      },
    ],
  }),
  loader: async () => {
    const [floorPlans, interiors] = await Promise.all([
      listPublicFloorPlans({ limit: 3 }),
      listPublicInteriorPlans({ limit: 3 }),
    ])
    return { floorPlans: floorPlans.products, interiors: interiors.products }
  },
  component: HomePage,
})

function BlueprintIllustration() {
  return (
    <svg
      viewBox="0 0 400 320"
      role="img"
      aria-label="Illustration of a floor plan drawing"
      className="h-auto w-full"
    >
      <rect x="40" y="30" width="320" height="240" fill="none" stroke="var(--ink)" strokeWidth="2" />
      <line x1="200" y1="30" x2="200" y2="170" stroke="var(--ink)" strokeWidth="1.5" />
      <line x1="40" y1="170" x2="290" y2="170" stroke="var(--ink)" strokeWidth="1.5" />
      <line x1="290" y1="170" x2="290" y2="270" stroke="var(--ink)" strokeWidth="1.5" />
      <rect x="60" y="50" width="60" height="40" fill="none" stroke="var(--ink-faint)" strokeWidth="1" />
      <rect x="230" y="60" width="90" height="60" fill="none" stroke="var(--ink-faint)" strokeWidth="1" />
      <rect x="70" y="200" width="80" height="50" fill="none" stroke="var(--ink-faint)" strokeWidth="1" />
      <path d="M 200 170 A 40 40 0 0 1 240 210" fill="none" stroke="var(--ink-soft)" strokeWidth="1" />
      <line x1="200" y1="170" x2="200" y2="210" stroke="var(--ink-soft)" strokeWidth="1" />
      <path d="M 290 120 A 30 30 0 0 1 320 150" fill="none" stroke="var(--ink-soft)" strokeWidth="1" />
      <line x1="40" y1="292" x2="360" y2="292" stroke="var(--ink-faint)" strokeWidth="1" />
      <line x1="40" y1="286" x2="40" y2="298" stroke="var(--ink-faint)" strokeWidth="1" />
      <line x1="360" y1="286" x2="360" y2="298" stroke="var(--ink-faint)" strokeWidth="1" />
      <text x="200" y="310" textAnchor="middle" fontSize="11" fill="var(--ink-soft)">
        60 ft
      </text>
      <line x1="18" y1="30" x2="18" y2="270" stroke="var(--ink-faint)" strokeWidth="1" />
      <line x1="12" y1="30" x2="24" y2="30" stroke="var(--ink-faint)" strokeWidth="1" />
      <line x1="12" y1="270" x2="24" y2="270" stroke="var(--ink-faint)" strokeWidth="1" />
      <text
        x="8"
        y="150"
        fontSize="11"
        fill="var(--ink-soft)"
        textAnchor="middle"
        transform="rotate(-90 8 150)"
      >
        40 ft
      </text>
    </svg>
  )
}

const STEPS = [
  {
    title: 'Browse',
    text: 'Explore floor plans by plot size or interiors by room type. Previews and full details up front.',
  },
  {
    title: 'Purchase',
    text: 'Buy a single drawing or bundle the floor plan with its elevation at a lower combined price.',
  },
  {
    title: 'Download',
    text: 'Your files unlock immediately after payment and stay available in your purchases, anytime.',
  },
  {
    title: 'Build',
    text: 'Hand the drawings to your contractor and start construction with a plan you trust.',
  },
]

function HomePage() {
  const { floorPlans, interiors } = Route.useLoaderData()

  return (
    <div>
      <section className="border-b border-line bg-surface">
        <Container className="grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-medium text-ink-soft">
              Architect-drawn digital plans
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Plans for your next build, ready to download.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-soft">
              Browse floor plans and interior working drawings, purchase exactly what you need
              and download the files instantly — no waiting, no shipping.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/floor-plans" className={buttonClasses('primary', 'lg')}>
                Browse floor plans
              </Link>
              <Link to="/interiors" className={buttonClasses('secondary', 'lg')}>
                Browse interior plans
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-faint">
              Instant digital delivery · Lifetime access to your purchases
            </p>
          </div>
          <div className="mx-auto w-full max-w-md lg:max-w-none">
            <BlueprintIllustration />
          </div>
        </Container>
      </section>

      <section className="border-b border-line">
        <Container className="py-16">
          <SectionHeading
            title="Latest floor plans"
            subtitle="Complete home plans with dimensions, pricing and elevation options."
            action={
              <Link to="/floor-plans" className="text-sm font-medium text-ink hover:underline">
                View all floor plans
              </Link>
            }
          />
          {floorPlans.length === 0 ? (
            <p className="mt-8 text-sm text-ink-soft">
              Floor plans are on the way. Check back soon.
            </p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {floorPlans.map((product) => (
                <FloorPlanCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="py-16">
          <SectionHeading
            title="Latest interior plans"
            subtitle="Preview every drawing free — purchase the working drawing when you are ready."
            action={
              <Link to="/interiors" className="text-sm font-medium text-ink hover:underline">
                View all interior plans
              </Link>
            }
          />
          {interiors.length === 0 ? (
            <p className="mt-8 text-sm text-ink-soft">
              Interior plans are on the way. Check back soon.
            </p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {interiors.map((product) => (
                <InteriorCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </Container>
      </section>

      <section className="border-b border-line">
        <Container className="py-16">
          <SectionHeading
            title="How it works"
            subtitle="From browsing to building in four steps."
          />
          <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-surface p-6">
                <p className="text-sm font-medium text-ink-faint">Step {index + 1}</p>
                <p className="mt-2 font-medium text-ink">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <div className="rounded-lg bg-brand px-6 py-12 text-center sm:px-12">
            <h2 className="text-2xl font-semibold tracking-tight text-brand-foreground">
              Find the plan that fits your plot.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-brand-foreground/70">
              Filter by plot dimensions and floor area to see only the plans that work for your
              site.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/floor-plans"
                className="inline-flex h-11 items-center justify-center rounded-md bg-brand-foreground px-5 text-sm font-medium text-brand transition hover:bg-brand-foreground/85"
              >
                Browse floor plans
              </Link>
              <Link
                to="/contact"
                className="inline-flex h-11 items-center justify-center rounded-md border border-brand-foreground/30 px-5 text-sm font-medium text-brand-foreground transition hover:bg-brand-foreground/10"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
