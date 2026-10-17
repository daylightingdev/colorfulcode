"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type mapboxgl from "mapbox-gl";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function applyBrandBasemap(m: mapboxgl.Map) {
  try {
    const style = m.getStyle();
    if (!style?.layers) return;
    for (const layer of style.layers) {
      try {
        if (layer.id === "background") {
          m.setPaintProperty(layer.id, "background-color", "#F2EBD9");
          continue;
        }
        if (layer.type === "fill" && layer.id.includes("water")) {
          m.setPaintProperty(layer.id, "fill-color", "#C8DCDD");
          continue;
        }
        if (layer.type === "line" && layer.id.includes("waterway")) {
          m.setPaintProperty(layer.id, "line-color", "#B8D0D1");
          continue;
        }
        if (layer.type === "fill" && (layer.id.includes("park") || layer.id.includes("landuse"))) {
          m.setPaintProperty(layer.id, "fill-color", "#E5DFCA");
          continue;
        }
        if (layer.type === "fill" && layer.id.includes("building")) {
          m.setPaintProperty(layer.id, "fill-color", "#E6DBC5");
          continue;
        }
      } catch {}
    }
  } catch {}
}

const CATEGORIES = [
  { value: "transit", label: "Transit" },
  { value: "activeMobility", label: "Active Mobility" },
  { value: "dailyNeeds", label: "Daily Needs" },
  { value: "circularEconomy", label: "Circular Economy" },
  { value: "localFood", label: "Local Food" },
  { value: "socialInfrastructure", label: "Social Infrastructure" },
  { value: "other", label: "Not sure / something else" },
];

const NYC_BOUNDS: [[number, number], [number, number]] = [
  [-74.259, 40.477],
  [-73.7, 40.917],
];

type FormState = "idle" | "submitting" | "success" | "error";

export default function SuggestSpotPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const mapboxRef = useRef<typeof mapboxgl | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [suggestions, setSuggestions] = useState<
    { place_name: string; center: [number, number] }[]
  >([]);
  const [wasClustered, setWasClustered] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const placePin = useCallback(
    (lng: number, lat: number, label?: string) => {
      if (
        lat < NYC_BOUNDS[0][1] ||
        lat > NYC_BOUNDS[1][1] ||
        lng < NYC_BOUNDS[0][0] ||
        lng > NYC_BOUNDS[1][0]
      ) {
        setValidationErrors((prev) => ({
          ...prev,
          location: "This spot needs to be within NYC.",
        }));
        return;
      }

      setLatitude(lat);
      setLongitude(lng);
      setLocationLabel(label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next.location;
        return next;
      });

      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else if (map.current && mapboxRef.current) {
        marker.current = new mapboxRef.current.Marker({
          color: "#E24B3A",
        })
          .setLngLat([lng, lat])
          .addTo(map.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    let mounted = true;
    import("mapbox-gl").then((mb) => {
      if (!mounted || !mapContainer.current) return;
      mb.default.accessToken = MAPBOX_TOKEN;

      const m = new mb.default.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-73.95, 40.71],
        zoom: 10.5,
        maxBounds: [
          [-74.35, 40.4],
          [-73.6, 41.0],
        ],
      });

      map.current = m;
      mapboxRef.current = mb.default;

      m.on("load", () => {
        applyBrandBasemap(m);
      });

      m.on("click", (e) => {
        placePin(e.lngLat.lng, e.lngLat.lat);
      });
    });

    return () => {
      mounted = false;
      map.current?.remove();
    };
  }, [placePin]);

  const searchLocation = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&bbox=${NYC_BOUNDS[0][0]},${NYC_BOUNDS[0][1]},${NYC_BOUNDS[1][0]},${NYC_BOUNDS[1][1]}&limit=5&types=address,poi`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion: {
    place_name: string;
    center: [number, number];
  }) => {
    const [lng, lat] = suggestion.center;
    placePin(lng, lat, suggestion.place_name);
    setLocationSearch(suggestion.place_name);
    setSuggestions([]);
    if (map.current) {
      map.current.flyTo({ center: [lng, lat], zoom: 15 });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) errors.name = "Give this spot a name.";
    if (latitude === null || longitude === null)
      errors.location = "Drop a pin or search for the address.";
    if (!category) errors.category = "Pick a category.";
    if (description.trim().length < 20)
      errors.description = "Tell us a bit more (at least 20 characters).";
    if (description.trim().length > 600)
      errors.description = "Keep it under 600 characters.";
    if (!publishConsent)
      errors.publishConsent =
        "We need your consent to share this on the map.";
    if (contactOpen && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errors.email = "That doesn't look like a valid email.";
    if (contactOpen && !email)
      errors.email = "Add your email or close the contact section.";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setFormState("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          latitude,
          longitude,
          category,
          description: description.trim(),
          link: link.trim() || null,
          email: contactOpen ? email.trim() : null,
          contact_consent: contactOpen && !!email,
          publish_consent: publishConsent,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormState("error");
        setErrorMessage(data.error || "Something went wrong.");
        return;
      }

      setFormState("success");
      setWasClustered(data.clustered);
    } catch {
      setFormState("error");
      setErrorMessage(
        "Could not reach the server. Check your connection and try again."
      );
    }
  };

  const descriptionLength = description.trim().length;

  if (formState === "success") {
    return (
      <main className="min-h-screen grain bg-paper">
        <nav className="border-b-2 border-ink bg-paper sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-4">
            <Link href="/" className="font-display font-extrabold text-[1rem] text-coral">
              LIVE LIGHTLY
            </Link>
            <Link href="/map" className="text-body-sm uppercase tracking-wide text-faded hover:text-ink transition-colors font-display font-bold">
              Gap Map
            </Link>
          </div>
        </nav>

        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <div className="border-2 border-ink p-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-teal flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--teal)"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="font-display font-extrabold text-section uppercase text-ink mb-2">
              Spot received
            </h1>
            <p className="text-body-sm text-faded mb-4">
              The Better Cities Lab team reviews submissions each month. If your
              spot is approved, it will appear on the community layer of the map.
              {wasClustered &&
                " Others have suggested a similar spot nearby, which strengthens the case."}
            </p>
            <Link
              href="/"
              className="inline-block border border-ink px-4 py-2 text-label uppercase font-display font-bold hover:bg-buff transition-colors"
            >
              Back to Live Lightly
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grain bg-paper">
      <nav className="border-b-2 border-ink bg-paper sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-4">
          <Link href="/" className="font-display font-extrabold text-[1rem] text-coral">
            LIVE LIGHTLY
          </Link>
          <Link href="/map" className="text-body-sm uppercase tracking-wide text-faded hover:text-ink transition-colors font-display font-bold">
            Gap Map
          </Link>
          <span className="text-body-sm uppercase tracking-wide text-teal font-display font-bold">
            Add to the Map
          </span>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4 py-8">
        <h1 className="font-display font-extrabold text-title-xl text-ink mb-1">
          Add to the Map
        </h1>
        <p className="text-body-sm text-faded mb-6">
          Know a place that helps people live more lightly? A bike shop, a
          community fridge, a zero-waste store? Tell us about it. The map is a
          work in progress, and you can help fill in the gaps.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Spot Name */}
          <fieldset className="mb-5">
            <label className="block font-display font-bold text-label uppercase text-ink mb-1">
              Spot name <span className="text-coral">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bushwick Community Compost"
              className="w-full border border-ink bg-paper px-3 py-2 text-body-sm text-ink placeholder:text-faded/50 focus:outline-none focus:ring-2 focus:ring-teal"
            />
            {validationErrors.name && (
              <p className="text-tag text-coral mt-1">
                {validationErrors.name}
              </p>
            )}
          </fieldset>

          {/* Location */}
          <fieldset className="mb-5">
            <label className="block font-display font-bold text-label uppercase text-ink mb-1">
              Location <span className="text-coral">*</span>
            </label>
            <p className="text-tag text-faded mb-2">
              Search for an address or click the map to drop a pin.
            </p>

            <div className="relative mb-2">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => {
                  setLocationSearch(e.target.value);
                  searchLocation(e.target.value);
                }}
                placeholder="Search an address in NYC"
                className="w-full border border-ink bg-paper px-3 py-2 text-body-sm text-ink placeholder:text-faded/50 focus:outline-none focus:ring-2 focus:ring-teal"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-20 w-full bg-paper border border-ink border-t-0 max-h-48 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => selectSuggestion(s)}
                        className="w-full text-left px-3 py-2 text-body-sm text-ink hover:bg-buff transition-colors border-b border-dashed border-buff last:border-b-0"
                      >
                        {s.place_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-ink overflow-hidden" style={{ height: 240 }}>
              {MAPBOX_TOKEN ? (
                <div ref={mapContainer} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-buff text-faded font-display text-label uppercase tracking-wide">
                  Map requires NEXT_PUBLIC_MAPBOX_TOKEN
                </div>
              )}
            </div>

            {locationLabel && (
              <p className="text-tag text-teal mt-1.5 flex items-center gap-1">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="var(--teal)"
                >
                  <circle cx="5" cy="5" r="4" />
                </svg>
                {locationLabel}
              </p>
            )}
            {validationErrors.location && (
              <p className="text-tag text-coral mt-1">
                {validationErrors.location}
              </p>
            )}
          </fieldset>

          {/* Category */}
          <fieldset className="mb-5">
            <label className="block font-display font-bold text-label uppercase text-ink mb-1">
              Category <span className="text-coral">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`px-3 py-1.5 text-tag uppercase tracking-wide border transition-colors ${
                    category === cat.value
                      ? "border-ink bg-ink text-paper font-bold"
                      : "border-ink text-faded hover:bg-buff"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            {validationErrors.category && (
              <p className="text-tag text-coral mt-1">
                {validationErrors.category}
              </p>
            )}
          </fieldset>

          {/* Description */}
          <fieldset className="mb-5">
            <label className="block font-display font-bold text-label uppercase text-ink mb-1">
              Why should it be on the map?{" "}
              <span className="text-coral">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What makes this place worth knowing about? How does it help people live more lightly?"
              className="w-full border border-ink bg-paper px-3 py-2 text-body-sm text-ink placeholder:text-faded/50 focus:outline-none focus:ring-2 focus:ring-teal resize-y"
            />
            <div className="flex justify-between mt-0.5">
              {validationErrors.description ? (
                <p className="text-tag text-coral">
                  {validationErrors.description}
                </p>
              ) : (
                <span />
              )}
              <span
                className={`text-tag ${
                  descriptionLength > 600
                    ? "text-coral"
                    : descriptionLength >= 20
                      ? "text-teal"
                      : "text-faded"
                }`}
              >
                {descriptionLength} / 600
              </span>
            </div>
          </fieldset>

          {/* Link */}
          <fieldset className="mb-5">
            <label className="block font-display font-bold text-label uppercase text-ink mb-1">
              Link{" "}
              <span className="text-faded font-normal normal-case">
                (optional)
              </span>
            </label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="w-full border border-ink bg-paper px-3 py-2 text-body-sm text-ink placeholder:text-faded/50 focus:outline-none focus:ring-2 focus:ring-teal"
            />
          </fieldset>

          {/* Contact (collapsible) */}
          <fieldset className="mb-5 border border-dashed border-faded">
            <button
              type="button"
              onClick={() => setContactOpen(!contactOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-body-sm text-faded">
                Happy to answer questions from the Better Cities Lab team?
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="var(--faded)"
                strokeWidth="1.5"
                className={`transition-transform ${contactOpen ? "rotate-180" : ""}`}
              >
                <polyline points="3 5 7 9 11 5" />
              </svg>
            </button>

            {contactOpen && (
              <div className="px-4 pb-4">
                <label className="block font-display font-bold text-label uppercase text-ink mb-1">
                  Your email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-ink bg-paper px-3 py-2 text-body-sm text-ink placeholder:text-faded/50 focus:outline-none focus:ring-2 focus:ring-teal mb-1.5"
                />
                <p className="text-tag text-faded">
                  Your email will only be used to follow up on this submission.
                  It is never shown publicly.
                </p>
                {validationErrors.email && (
                  <p className="text-tag text-coral mt-1">
                    {validationErrors.email}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          {/* Publish consent */}
          <fieldset className="mb-5">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={publishConsent}
                onChange={(e) => setPublishConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 border-ink accent-teal flex-shrink-0"
              />
              <span className="text-body-sm text-faded">
                I understand my submission text may be reviewed and published on
                the map. <span className="text-coral">*</span>
              </span>
            </label>
            {validationErrors.publishConsent && (
              <p className="text-tag text-coral mt-1 ml-6">
                {validationErrors.publishConsent}
              </p>
            )}
          </fieldset>

          {/* Privacy note */}
          <div className="mb-6 text-tag text-faded border-l-2 border-teal pl-3">
            We store only what you share here. Email addresses are visible only
            to the BCL review team and are never published. Your submission text
            and spot name may appear on the map if approved.
          </div>

          {/* Error state */}
          {formState === "error" && (
            <div className="mb-4 border border-coral p-3 text-body-sm text-coral">
              {errorMessage}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={formState === "submitting"}
            className="w-full border-2 border-ink bg-ink text-paper font-display font-bold text-label uppercase tracking-wide py-3 hover:bg-coral hover:border-coral transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formState === "submitting" ? "Sending..." : "Submit your spot"}
          </button>
        </form>
      </div>
    </main>
  );
}
