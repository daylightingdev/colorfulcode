import Link from "next/link";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function CategoryCard({
  name,
  weight,
  color,
  description,
  items,
}: {
  name: string;
  weight: number;
  color: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-5 bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{name}</h3>
        <span
          className="text-sm font-bold px-2.5 py-0.5 rounded-full text-white"
          style={{ backgroundColor: color }}
        >
          {weight} pts
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      <ul className="text-sm text-gray-500 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="font-semibold text-gray-900">
            Within Reach
          </Link>
          <Link
            href="/map"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Gap Map
          </Link>
          <span className="text-sm text-emerald-600 font-medium">
            Methodology
          </span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">How We Score</h1>
        <p className="text-gray-500 mb-8">
          A transparent look at what we measure, how we weight it, and where the
          data comes from.
        </p>

        {/* Overview */}
        <Section title="The big picture">
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-600 space-y-3">
            <p>
              Within Reach produces a score from <strong>0 to 100</strong> that
              measures how well a neighborhood has been served by low-carbon
              infrastructure investment. It is not a lifestyle rating or a
              judgment of how people live — it&apos;s a measure of what the city
              has built (or hasn&apos;t) in your area.
            </p>
            <p>
              The score is split across <strong>six categories</strong>, each
              weighted by its impact on enabling car-free, climate-friendly
              daily life. Higher weights go to the things that matter most:
              reliable transit, safe cycling infrastructure, and walkable access
              to essentials.
            </p>
            <p>
              We also layer in <strong>equity context</strong> — income,
              displacement risk, and rent burden — so scores can be interpreted
              in light of who lives in a neighborhood and what investment
              patterns look like historically.
            </p>
          </div>
        </Section>

        {/* Scoring categories */}
        <Section title="Scoring categories">
          <div className="grid gap-4">
            <CategoryCard
              name="Transit"
              weight={30}
              color="#4a6fa5"
              description="Access to reliable public transportation — the backbone of low-carbon mobility."
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
              color="#57a773"
              description="Safe infrastructure for biking and walking — not just painted lines, but real protection."
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
              color="#e08b4a"
              description="Can you get groceries, fill a prescription, and do laundry without a car?"
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
              color="#2a9d8f"
              description="Infrastructure for reuse, repair, and waste diversion — keeping things out of landfills."
              items={[
                "Thrift and secondhand stores within 0.5 miles (up to 5 pts)",
                "Composting drop-off sites within 0.5 miles (up to 5 pts)",
                "Refill and zero-waste shops within 1 mile (up to 5 pts)",
              ]}
            />
            <CategoryCard
              name="Local Food"
              weight={10}
              color="#c46a3f"
              description="Community-driven food systems that shorten supply chains and build resilience."
              items={[
                "Community gardens within 0.5 miles (up to 4 pts)",
                "Food co-ops within 0.5 miles (up to 3 pts)",
                "CSA pickup sites within 0.5 miles (up to 3 pts)",
              ]}
            />
            <CategoryCard
              name="Clean Energy"
              weight={5}
              color="#5ba4cf"
              description="Emerging infrastructure for electrification and reduced resource consumption."
              items={[
                "EV charging stations within 0.75 miles (up to 3 pts)",
                "Public water refill stations within 0.25 miles (up to 2 pts)",
              ]}
            />
          </div>
        </Section>

        {/* Score interpretation */}
        <Section title="What the scores mean">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-700">
                    Score
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-700">
                    Label
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-700">
                    What it means
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-bold text-emerald-700">
                    75–100
                  </td>
                  <td className="px-4 py-2.5">Excellent</td>
                  <td className="px-4 py-2.5">
                    Strong investment across most categories. Car-free living is
                    genuinely convenient here.
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-bold text-yellow-600">
                    50–74
                  </td>
                  <td className="px-4 py-2.5">Moderate</td>
                  <td className="px-4 py-2.5">
                    Good transit and some walkable amenities, but notable gaps in
                    one or more categories.
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-2.5 font-bold text-orange-600">
                    25–49
                  </td>
                  <td className="px-4 py-2.5">Limited</td>
                  <td className="px-4 py-2.5">
                    Some infrastructure exists but significant gaps make
                    car-free living difficult day-to-day.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-bold text-red-600">0–24</td>
                  <td className="px-4 py-2.5">Severely underserved</td>
                  <td className="px-4 py-2.5">
                    Very little low-carbon infrastructure. Residents depend
                    heavily on cars by necessity, not choice.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Data sources */}
        <Section title="Data sources">
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {[
              {
                name: "MTA GTFS Static Feed",
                what: "Subway station locations, routes, and peak headway frequency",
                url: "https://new.mta.info/developers",
                refresh: "Updated with each schedule change",
              },
              {
                name: "Citi Bike GBFS Feed",
                what: "All bike share dock locations across NYC",
                url: "https://citibikenyc.com/system-data",
                refresh: "Updated weekly as stations are added",
              },
              {
                name: "OpenStreetMap (Overpass API)",
                what: "Bike lane locations and protection levels",
                url: "https://www.openstreetmap.org",
                refresh: "Community-maintained, updated continuously",
              },
              {
                name: "NYC Open Data — Community Gardens",
                what: "GreenThumb and other community garden locations",
                url: "https://data.cityofnewyork.us/dataset/ajxm-kzmj",
                refresh: "Updated annually",
              },
              {
                name: "NYC Open Data — Food Scrap Drop-Off Sites",
                what: "DSNY composting drop-off locations",
                url: "https://data.cityofnewyork.us/dataset/8hmm-ypp5",
                refresh: "Updated as sites are added",
              },
              {
                name: "Google Places API",
                what: "Grocery stores, pharmacies, clinics, laundromats, thrift stores, EV chargers",
                url: "https://developers.google.com/maps/documentation/places/web-service",
                refresh: "Real-time per request",
              },
              {
                name: "U.S. Census Bureau — ACS 2022",
                what: "Median household income, racial composition by census tract",
                url: "https://data.census.gov",
                refresh: "Annual release",
              },
              {
                name: "Census TIGER/Line Shapefiles",
                what: "Census tract boundaries for geographic lookup",
                url: "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
                refresh: "Updated with each decennial census",
              },
            ].map((source) => (
              <div key={source.name} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {source.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {source.what}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap mt-0.5">
                    {source.refresh}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Limitations */}
        <Section title="What we don't measure (yet)">
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-600 space-y-2">
            <p>
              <strong>Accessibility</strong> — Wheelchair-accessible routes,
              audio crosswalk signals, and elevator access at subway stations
              are important but complex to score. We plan to add this.
            </p>
            <p>
              <strong>Quality and condition</strong> — A bike lane that exists
              on paper but is blocked by parked cars scores the same as a
              well-maintained one. We rely on the data as reported.
            </p>
            <p>
              <strong>Real-time transit</strong> — We use scheduled headways,
              not live arrival data. A train that&apos;s supposed to come every
              6 minutes but often doesn&apos;t will still score well.
            </p>
            <p>
              <strong>Affordability</strong> — We measure whether a grocery
              store exists nearby, not whether its prices are affordable. The
              equity panel provides some context here.
            </p>
          </div>
        </Section>

        <div className="text-center text-sm text-gray-400 mt-6 mb-10">
          <p>
            Questions or feedback?{" "}
            <a
              href="https://github.com/daylightingdev/colorfulcode/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 underline"
            >
              Open an issue on GitHub
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
