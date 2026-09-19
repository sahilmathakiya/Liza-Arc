import { Link, createFileRoute } from '@tanstack/react-router'
import elevationDetail from '../../../assets/elevation-detail.webp'
import floorPlanDetail from '../../../assets/floor-plan-detail.webp'
import heroExteriorDesktop from '../../../assets/hero-exterior-desktop.webp'
import heroExteriorMobile from '../../../assets/hero-exterior-mobile.webp'
import homeDetailWindow from '../../../assets/home-detail-window.webp'
import interiorMaterialDetail from '../../../assets/interior-material-detail.webp'
import materialBoard from '../../../assets/material-board.webp'
import siteContext from '../../../assets/site-context.webp'
import studioDesk from '../../../assets/studio-desk.webp'
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
      <section className="relative min-h-[min(820px,calc(100svh-64px))] overflow-hidden border-b border-line">
        <picture className="absolute inset-0">
          <source media="(max-width: 639px)" srcSet={heroExteriorMobile} />
          <img
            src={heroExteriorDesktop}
            alt="Warmly lit contemporary home exterior at dusk"
            width="2400"
            height="1600"
            fetchPriority="high"
            decoding="async"
            className="h-full w-full object-cover object-center"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/65 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-canvas/65 to-transparent" aria-hidden />
        <Container className="relative flex min-h-[min(820px,calc(100svh-64px))] items-end pb-12 pt-28 sm:pb-16 lg:pb-20">
          <div className="max-w-2xl">
            <h1 className="mt-6 text-5xl font-black leading-[.94] tracking-[-.055em] text-ink sm:text-7xl lg:text-[clamp(4.5rem,7vw,7.5rem)]">
  <span className="block whitespace-nowrap">
    Draw it <em className="italic">once</em>.
  </span>
  <span className="block whitespace-nowrap text-brand">
    Build it <em className="italic">right</em>.
  </span>
</h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-ink/80 sm:text-xl">
              Floor plans and interior drawings for people making a place of their own.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/floor-plans" className={buttonClasses('primary', 'lg')}>
                Explore floor plans
              </Link>
              <Link to="/interiors" className={buttonClasses('ghost', 'lg', 'border border-olive')}>
                See interior plans <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="grid gap-10 py-20 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-28">
          <div className="relative lg:col-span-7">
            <img
              src={floorPlanDetail}
              alt="Detailed architectural floor plan drawing"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-[6px] object-cover"
            />
          </div>
          <div className="lg:col-span-5 lg:pl-4">
            <p className="text-xs font-semibold uppercase tracking-[1.4px] text-brand">Drawings with direction</p>
            <h2 className="mt-4 max-w-lg text-3xl font-black leading-tight tracking-tight text-ink sm:text-5xl">
              The details are where a home begins to feel like yours.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft">
              Clear dimensions, considered rooms, and enough detail to have a better conversation on site.
            </p>
            <div className="mt-8 border-t border-line pt-5 text-xs font-semibold uppercase tracking-[1.1px] text-ink-faint">
              Floor plans / elevations / interiors
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-line bg-surface">
        <Container className="grid gap-10 py-20 lg:grid-cols-12 lg:items-center lg:gap-16 lg:py-28">
          <div className="relative lg:col-span-7">
            <img
              src={interiorMaterialDetail}
              alt="Warm architectural material detail with timber joinery"
              width="1600"
              height="1200"
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-[6px] object-cover"
            />
            <div className="absolute -bottom-7 right-4 w-36 bg-surface p-1 rounded-[3px] sm:right-10 sm:w-48">
              <img
                src={elevationDetail}
                alt="Architectural elevation drawing detail"
                width="1600"
                height="1200"
                loading="lazy"
                decoding="async"
                className="aspect-square w-full object-cover rounded-[3px]"
              />
            </div>
          </div>
          <div className="lg:col-span-5 lg:pl-4">
            <p className="text-xs font-semibold uppercase tracking-[1.4px] text-brand">Material language</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
              A plan is only the beginning of how a room feels.
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink-soft">
              Look closely and the useful decisions are there: openings, thresholds, light, and the quiet relationship between one room and the next.
            </p>
            <img
              src={homeDetailWindow}
              alt="Architectural window and stair detail"
              width="800"
              height="1000"
              loading="lazy"
              decoding="async"
              className="mt-8 aspect-[4/3] w-full rounded-[6px] object-cover"
            />
          </div>
        </Container>
      </section>

      <section className="border-b border-line">
        <Container className="grid gap-10 py-20 lg:grid-cols-12 lg:items-end lg:gap-16 lg:py-28">
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[1.4px] text-brand">A measured approach</p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
              From the desk to the site.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-soft">
              Good spaces are shaped by decisions made early: the site, the material, and the way a plan is read.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:col-span-8">
            <figure className="col-span-2 sm:col-span-1">
              <img src={studioDesk} alt="Architectural drawings on a studio desk" width="1600" height="1200" loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-[6px] object-cover" />
            </figure>
            <div className="grid grid-cols-2 gap-3 sm:gap-5">
              <figure>
                <img src={materialBoard} alt="Warm architectural material board" width="1600" height="1200" loading="lazy" decoding="async" className="aspect-square w-full rounded-[6px] object-cover" />
              </figure>
              <figure>
                <img src={siteContext} alt="Residential architecture in its site context" width="1600" height="1200" loading="lazy" decoding="async" className="aspect-square w-full rounded-[6px] object-cover" />
              </figure>
            </div>
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
          <ol className="mt-8 grid gap-px overflow-hidden rounded-[8px] border border-line bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="bg-surface p-6">
                <p className="text-xs font-semibold uppercase tracking-[1.4px] text-brand">0{index + 1}</p>
                <p className="mt-5 text-lg font-bold text-ink">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section>
        <Container className="py-16">
          <div className="rounded-[8px] border border-line bg-surface p-6 text-center sm:px-12 sm:py-12">
            <p className="text-xs font-semibold uppercase tracking-[1.4px] text-brand">Start with the right foundation</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              Find the plan that fits.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
              Filter by plot dimensions and floor area to see only the plans that work for your
              site.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/floor-plans" className={buttonClasses('primary', 'lg')}>
                Browse floor plans
              </Link>
              <Link to="/contact" className={buttonClasses('secondary', 'lg')}>
                Talk to us
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
