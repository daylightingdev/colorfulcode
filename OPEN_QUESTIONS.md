# Open Questions

Items that need owner review or a decision before shipping.

## Copy review needed

- [ ] Landing page hero subtitle: "Your Planet-Friendly Neighborhood Map"
- [ ] Landing page body: "Find the places near you that make it easier to walk, bike, compost, repair, and shop locally."
- [ ] Stamp card headings: "We map what matters" / "We score the access" / "We show the gaps"
- [ ] Score band labels and definitions (Excellent / Moderate / Limited / Severely underserved)
- [ ] "Missing? Add it" CTA wording: "Something missing? Know a spot that should be on the map?"
- [ ] ScoreNarrative: dynamic sentence summarizing nearby amenities
- [ ] Transit copy showing subway/bus breakdown (confirmed by owner, now live)

## Design decisions confirmed

- [x] Stacked scroll layout for mobile (not side-by-side)
- [x] Cream paper (`#F2EBD9`) as default background
- [x] Transit copy shows subway/bus breakdown

## Remaining work

- [ ] Zine aesthetic can be pushed further on methodology and suggest pages (currently cleaner/more conventional)
- [ ] Dark mode visual testing (tokens are defined, layout untested)
- [ ] Walking radius label on the amenity map (shows "0.5 mi" near circle edge) could use font-text instead of font-body for readability
- [ ] Map page (`/map`) uses static `mapbox-gl` import (not lazy-loaded like the main page)
- [ ] Suggest page map does not have brand basemap applied (still stock light-v11)

## Data credibility notes

- Google Places API provides real-time POI data but coverage varies by category; thrift stores and refill shops are less reliably tagged
- MTA GTFS feed is authoritative for station locations but scheduled headways may differ from actual service
- Community garden data via NYC Open Data is comprehensive for GreenThumb gardens but may miss privately organized gardens
- Census ACS equity data is 2022 vintage; displacement risk model is a simplified proxy
