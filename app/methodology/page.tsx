import Link from "next/link";

const CATEGORY_COLORS: Record<string, string> = {
  transit: "var(--teal)",
  activeMobility: "var(--overprint)",
  dailyNeeds: "var(--coral)",
  circularEconomy: "var(--teal)",
  localFood: "var(--overprint)",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="font-display font-bold text-section uppercase border-b-2 border-ink pb-1 mb-3">
        {title}
      </h2>
      {children}
    </div>
  );
}

function CategoryCard({
  name,
  weight,
  colorKey,
  description,
  items,
}: {
  name: string;
  weight: number;
  colorKey: string;
  description: string;
  items: string[];
}) {
  const color = CATEGORY_COLORS[colorKey] || "var(--ink)";
  return (
    <div className="border border-ink p-4">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-display font-bold text-label uppercase">{name}</h3>
        <span
          className="text-tag font-bold px-2 py-0.5 text-paper"
          style={{ backgroundColor: color }}
        >
          {weight} pts
        </span>
      </div>
      <p className="text-body-sm text-faded mb-2">{description}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-body-sm text-faded">
            <span
              className="mt-1 w-[5px] h-[5px] rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-screen grain bg-paper">
      <nav className="max-w-3xl mx-auto px-4">
        <div className="flex items-center gap-3 py-2.5 border-b-2 border-ink">
          <Link href="/" className="font-display font-extrabold text-[0.9rem] text-coral">
            LIVE LIGHTLY
          </Link>
          <Link href="/map" className="text-tag uppercase tracking-wide text-faded hover:text-ink transition-colors">
            Gap Map
          </Link>
          <span className="text-tag uppercase tracking-wide text-teal font-bold">
            How We Score
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-display font-extrabold text-title-xl text-ink mb-1">How We Score</h1>
        <p className="text-body-sm text-faded mb-6">
          A transparent look at what we measure, how we weight it, and where the
          data comes from.
        </p>

        <Section title="The big picture">
          <div className="border border-dashed border-faded p-4 text-body-sm text-faded space-y-2.5">
            <p>
              Live Lightly produces a score from <strong className="text-ink">0 to 100</strong> that
              reflects how well your neighborhood supports planet-friendly daily
              life. It measures the infrastructure around you, not how you
              live, but what your city has built to make living lightly
              possible.
            </p>
            <p>
              The score is split across <strong className="text-ink">five categories</strong>, each
              weighted by its impact on making it easy to get around without a
              car, eat well, reduce waste, and take care of everyday needs
              close to home.
            </p>
            <p>
              We also layer in <strong className="text-ink">equity context</strong>: income,
              displacement risk, and rent burden, so scores can be interpreted
              in light of who lives in a neighborhood and what investment
              patterns look like historically.
            </p>
          </div>
        </Section>

        <Section title="Scoring categories">
          <div className="grid gap-3">
            <CategoryCard
              name="Transit"
              weight={30}
              colorKey="transit"
              description="Reliable public transit is the foundation of planet-friendly mobility. It determines whether going car-free is a real option."
              items={[
                "Subway stations within 0.5 miles (up to 15 pts, scaled by count and headway frequency)",
                "Bus stops within 0.25 miles (up to 8 pts)",
                "Commuter rail or ferry within 1 mile (up to 7 pts)",
                "Bonus points for average peak headway under 6 minutes",
              ]}
            />
            <CategoryCard
              name="Active Mobility"
              weight={20}
              colorKey="activeMobility"
              description="Safe infrastructure for biking and walking. Not just painted lines, but real protection that makes two wheels feel like a first choice."
              items={[
                "Protected bike lanes within 0.25 miles (up to 8 pts)",
                "Painted bike lanes if no protected lanes (up to 4 pts)",
                "Bike share docks within 0.5 miles (up to 8 pts)",
                "Protection level matters: a protected lane scores 4x a painted one",
              ]}
            />
            <CategoryCard
              name="Daily Needs"
              weight={20}
              colorKey="dailyNeeds"
              description="Can you get groceries, fill a prescription, and do laundry without driving? These are the basics of walkable daily life."
              items={[
                "Grocery stores within 0.75 miles (up to 6 pts)",
                "Pharmacies within 0.75 miles (up to 5 pts)",
                "Health clinics within 1 mile (up to 5 pts)",
                "Laundromats within 0.75 miles (up to 4 pts)",
              ]}
            />
            <CategoryCard
              name="Circular Economy"
              weight={15}
              colorKey="circularEconomy"
              description="Places that help you reuse, repair, and divert waste. Keeping things out of landfills and in circulation."
              items={[
                "Thrift and secondhand stores within 0.5 miles (up to 5 pts)",
                "Composting drop-off sites within 0.5 miles (up to 5 pts)",
                "Refill and zero-waste shops within 1 mile (up to 5 pts)",
              ]}
            />
            <CategoryCard
              name="Local Food"
              weight={15}
              colorKey="localFood"
              description="Community-driven food systems that shorten supply chains, build resilience, and connect you to what grows nearby."
              items={[
                "Community gardens within 0.5 miles (up to 6 pts)",
                "Food co-ops within 0.5 miles (up to 5 pts)",
                "CSA pickup sites within 0.5 miles (up to 4 pts)",
              ]}
            />
          </div>
        </Section>

        <Section title="What the scores mean">
          <div className="border border-ink overflow-hidden">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="border-b-2 border-ink bg-buff">
                  <th className="text-left px-3 py-2 font-display font-bold text-tag uppercase">
                    Score
                  </th>
                  <th className="text-left px-3 py-2 font-display font-bold text-tag uppercase">
                    Label
                  </th>
                  <th className="text-left px-3 py-2 font-display font-bold text-tag uppercase">
                    What it means
                  </th>
                </tr>
              </thead>
              <tbody className="text-faded">
                <tr className="border-b border-dashed border-buff">
                  <td className="px-3 py-2 font-bold text-teal">75-100</td>
                  <td className="px-3 py-2">Excellent</td>
                  <td className="px-3 py-2">
                    Your neighborhood makes it easy to live lightly.
                  </td>
                </tr>
                <tr className="border-b border-dashed border-buff">
                  <td className="px-3 py-2 font-bold text-overprint">50-74</td>
                  <td className="px-3 py-2">Moderate</td>
                  <td className="px-3 py-2">
                    Good foundation with room to grow. A few key additions
                    would make a big difference.
                  </td>
                </tr>
                <tr className="border-b border-dashed border-buff">
                  <td className="px-3 py-2 font-bold text-coral">25-49</td>
                  <td className="px-3 py-2">Limited</td>
                  <td className="px-3 py-2">
                    Living lightly here takes effort. Some infrastructure
                    exists, but significant gaps remain.
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-bold text-coral">0-24</td>
                  <td className="px-3 py-2">Severely underserved</td>
                  <td className="px-3 py-2">
                    Very little planet-friendly infrastructure. Residents need
                    more investment, not more willpower.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Data sources">
          <div className="border border-ink divide-y divide-dashed divide-buff">
            {[
              {
                name: "MTA GTFS Static Feed",
                what: "Subway station locations, routes, and peak headway frequency",
                refresh: "Updated with each schedule change",
              },
              {
                name: "Citi Bike GBFS Feed",
                what: "All bike share dock locations across NYC",
                refresh: "Updated weekly as stations are added",
              },
              {
                name: "OpenStreetMap (Overpass API)",
                what: "Bike lane locations and protection levels",
                refresh: "Community-maintained, updated continuously",
              },
              {
                name: "NYC Open Data: Community Gardens",
                what: "GreenThumb and other community garden locations",
                refresh: "Updated annually",
              },
              {
                name: "NYC Open Data: Food Scrap Drop-Off Sites",
                what: "DSNY composting drop-off locations",
                refresh: "Updated as sites are added",
              },
              {
                name: "Google Places API",
                what: "Grocery stores, pharmacies, clinics, laundromats, thrift stores",
                refresh: "Real-time per request",
              },
              {
                name: "U.S. Census Bureau: ACS 2022",
                what: "Median household income, racial composition by census tract",
                refresh: "Annual release",
              },
              {
                name: "Census TIGER/Line Shapefiles",
                what: "Census tract boundaries for geographic lookup",
                refresh: "Updated with each decennial census",
              },
            ].map((source) => (
              <div key={source.name} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-label uppercase text-ink">
                      {source.name}
                    </h3>
                    <p className="text-body-sm text-faded mt-0.5">
                      {source.what}
                    </p>
                  </div>
                  <span className="text-tag text-faded whitespace-nowrap mt-0.5">
                    {source.refresh}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="What we don&apos;t measure (yet)">
          <div className="border border-dashed border-faded p-4 text-body-sm text-faded space-y-2">
            <p>
              <strong className="text-ink">Accessibility:</strong> Wheelchair-accessible routes,
              audio crosswalk signals, and elevator access at subway stations
              are important but complex to score. We plan to add this.
            </p>
            <p>
              <strong className="text-ink">Quality and condition:</strong> A bike lane that exists
              on paper but is blocked by parked cars scores the same as a
              well-maintained one. We rely on the data as reported.
            </p>
            <p>
              <strong className="text-ink">Real-time transit:</strong> We use scheduled headways,
              not live arrival data. A train that&apos;s supposed to come every
              6 minutes but often doesn&apos;t will still score well.
            </p>
            <p>
              <strong className="text-ink">Affordability:</strong> We measure whether a grocery
              store exists nearby, not whether its prices are affordable. The
              equity panel provides some context here.
            </p>
          </div>
        </Section>

        <div className="text-center text-tag text-faded mt-4 mb-8">
          <p>
            Questions or feedback?{" "}
            <a
              href="https://github.com/daylightingdev/colorfulcode/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal underline underline-offset-2"
            >
              Open an issue on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
