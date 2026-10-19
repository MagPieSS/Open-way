# Research behind Open Way's accessibility model

Compiled 2026-10-16/17 for the trust-and-evidence work on branch `improve/trust-and-safety`. It records
what we found, where it came from, and how it shaped the code. Facts are tagged:

- **[V]** read from the primary source (page fetched, API queried)
- **[S]** secondary source or search summary only, not confirmed
- **[!]** could not be verified

Statistics are quoted as the source states them. Nothing here comes from Open Way user research; we
have not yet talked to Open Way users (see "Gaps").

## 1. What people need to know before visiting

- People look for access information before going somewhere new, and often find it wrong.
  - Euan's Guide 2019 Access Survey (published 15 May 2020, 1,000+ respondents): 93% look for access
    information before visiting somewhere new, 77% found it inaccurate, 70% use two or more sources. [V]
  - Euan's Guide 2025 survey (published 12 Mar 2026, 4,000+ respondents, 88% disabled): 47% find access
    information hard to locate, 42% avoid a venue if they can't find it, 41% found no toilet that suited
    their needs. [V]
- Needs differ between people, and a single verdict hides that.
  - Li et al., CHI 2025, "Accessibility for Whom?" (N=190, five mobility-aid groups): the share of barriers
    judged impassable ranged from 28% (cane users) to 46% (scooter users); groups disagreed most on
    mid-severity barriers. The authors reject a one-size-fits-all model. [V]
  - A Project Sidewalk participant: "someone said this was accessible and I got there and it wasn't…
    everyone has different opinions on accessibility." [V]
- Specifics matter more than labels. Chi, Sha & Zhang (W4A 2023, 14 wheelchair users) found people need
  measurements and details photos miss (door swing, door weight, surfaces, space under tables), and that
  owners over-claim accessibility. [V]
- Autistic adults describe places as disabling or enabling by sensory load, crowding, predictability,
  staff understanding, adjustments and a place to recover (MacLennan et al., *Autism in Adulthood*
  5(4):411-422). [V, via summary pages] The Franklin Institute's 2024 Sensory Guide rates exhibits for
  sound, sight, touch, movement and complexity. [V]

**What we built from this:** accessibility is stored and shown feature by feature
(`shared/accessibility.ts`), with "step-free entrance", "step-free route inside" and "accessible
restroom" first, because those decide whether a visit is possible at all. Sensory and communication
features are part of the catalog. The place page says that one overall label can't fit every need.

## 2. How other products model accessibility

| Product | Model | Trust and freshness | Takeaway for Open Way |
|---|---|---|---|
| OpenStreetMap `wheelchair=*` (wiki edited 26 Jul 2026) [V] | yes / limited / no; no default; missing = unknown | `check_date` per key | Same yes/limited/no + unknown. Unknown is never a barrier. |
| StreetComplete (source checked 14 Oct 2026) [V] | asks one question at a time | re-asks about wheelchair access after 4 years (8 for some) | Structural facts stay current for 4 years. Short, one-feature questions. |
| AccessAble (UK) [V via NHS partner pages] | ~1,000 surveyed facts per venue; deliberately no ratings | annual resurvey [S] | Facts, not scores. |
| Euan's Guide [V] | reviews with date of visit; disclosing your access needs is optional | date of visit shown | Show the visit date; never require disability disclosure. |
| Google Maps / Yelp [V] | yes/no attributes, often owner-set | no visible date or provenance | Show where each fact came from and when. |

## 3. Trust in crowdsourced data

- Project Sidewalk (Saha et al., CHI 2019): single labels were 71.7% accurate. With five labellers,
  majority vote raised precision from 68.8% to 87.4% but cut recall from 67.8% to 59.5%. Stakeholders asked
  to see how old data is and wanted to know about possible barriers even if unconfirmed ("If there was a
  label, I'd rather be aware of it"). [V]
- Owner claims are unreliable: owners over-claim (Chi et al.) [V]; 77% of Euan's Guide 2024 respondents
  found venue websites misleading or inaccurate. [S, reported by THIIS 19 Feb 2025]
- [!] We found no peer-reviewed study that directly measures how disabled people judge the reliability of
  crowdsourced venue information.

**What we built from this** (`summarizeFeature` in `shared/accessibility.ts`, tests in
`shared/accessibility.test.ts`):

- Each feature shows its evidence: "The venue says so", "Reported by 1 visitor", "Confirmed by N
  visitors", "Reports disagree", or "No one has reported this yet".
- A fact is "confirmed" only with two agreeing current reports, or a visitor agreeing with the venue.
- Dated visitor reports outrank the venue's own claim; when they disagree, both sides are shown.
- A single report is still shown (not hidden until confirmed).
- Reports stay current for 4 years for structural features and 1 year for services and schedules; older
  information is marked "may be out of date".
- No place-wide score is derived from the features.

## 4. Standards

- **2010 ADA Standards** [V, ada.gov]: door clear width 32 in minimum (404.2.3); thresholds 1/2 in maximum
  (404.2.5); ramps no steeper than 1:12 (405.2); changes in level over 1/2 in must be ramped (303.4).
  Open Way does not claim ADA compliance for any place; the FAQ says labels are reports, not inspections.
- **WCAG 2.2** (W3C Recommendation 5 Oct 2023; current version 12 Dec 2024) [V]: new AA criteria used as
  the engineering target here include 2.4.11 Focus Not Obscured, 2.5.7 Dragging Movements, 2.5.8 Target
  Size (24×24 CSS px) and 3.3.8 Accessible Authentication.
- **DOJ Title II web rule** [V, ada.gov]: WCAG 2.1 AA for state and local governments. An interim final
  rule of 20 Apr 2026 moved compliance to 26 Apr 2027 (populations of 50,000+) and 26 Apr 2028
  (smaller). That applies to the City and SEPTA, not to Open Way, but matters for any partnership.

## 5. Philadelphia sources

- **SEPTA elevator outages** [V, queried 2026-10-16 and 2026-10-17]:
  `https://www3.septa.org/api/elevator/index.php`, no key, JSON served as `text/html`, no CORS header,
  lists only elevators that are out of service (7 on both days). Station names match SEPTA GTFS
  `stop_name`. No published documentation or terms were found [!]. SEPTA's elevator hotline is
  877-737-8248. → `server/septa.ts` and the `/transit/elevators` page. A failed fetch is shown as
  "live status unavailable", never as "no outages".
- **SEPTA GTFS** [V]: `wheelchair_boarding` is present in `stops.txt` (rail: 77 stops accessible, 79 not).
  Licence: SEPTA's developer agreement (18 Mar 2014), revocable. Not used yet (roadmap).
- **Polling places** [V]: City Commissioners' accessibility codes (F, A, B, R, M, N) via the Carto SQL API,
  1,703 rows. These are election-day ratings, not ADA audits. Not used yet (roadmap).
- **City AIS geocoder** [V]: answers without a key, but its documentation says it is for internal use and
  asks for an API key. Open Way still geocodes with Nominatim (1 request/second, identified User-Agent).
- **Venue pages**: the Museum of Art's accessibility page says "All floors are accessible by elevator" and
  "All restrooms are accessible…", and lists "Barrier-Free Entry" without saying which entrance
  [V, read 2026-10-16]. Those three seeded facts carry that check date; the other seeded facts say
  "check date not recorded".
- **Map tiles** [V, 2026-10-17]: CARTO's free basemap URLs now return an "API KEY REQUIRED" placeholder
  image, which had left every Open Way map blank. The app now defaults to OpenStreetMap's standard tiles
  (light use allowed with attribution) and accepts `VITE_MAP_TILE_URL` for another provider.
- **CDC**: "More than 1 in 4 U.S. adults have some type of disability" (CDC infographic page dated
  5 May 2026) [V]. Used on the Petitions page with a link.

## 6. Privacy

- The UK ICO treats information about disability, and inferences about it, as special category data.
  [V, updated 9 Apr 2024] Open Way never asks contributors about their disability, and reports are shown
  without names.
- OWASP's file-upload guidance is to decode and re-encode images to drop metadata. [V] Uploads are now
  re-encoded with sharp, which removes GPS position, time and device data (`server/images.ts`).
- Google's contribution policy bans photos of people's faces without consent [V]; the upload prompt asks
  people not to photograph others. Automatic face blurring is on the roadmap.

## Gaps

- No interviews or testing with disabled Philadelphians yet. Every recommendation above comes from
  published research and other products, not from Open Way's own users.
- Several sources could not be fetched (Wheelmap FAQ, AccessAble, ACM Digital Library, Euan's Guide 2024
  PDF). Claims from them are marked [S] or left out.
- SEPTA's elevator feed has no published terms or uptime commitment.

## Sources (accessed 2026-10-16 unless noted)

- Euan's Guide, 2019 Access Survey: https://www.euansguide.com/news/2019-access-survey/ (15 May 2020)
- Euan's Guide, 2025 survey results: https://www.euansguide.com/news/access-survey-results-overview (12 Mar 2026)
- THIIS on the Euan's Guide 2024 survey: https://thiis.co.uk/latest-euans-guide-survey-reveals-a-generation-of-disabled-peopled-failed-by-disabled-access/ (19 Feb 2025)
- Li et al., "Accessibility for Whom?", CHI 2025: https://arxiv.org/html/2502.19888v1
- Saha et al., Project Sidewalk, CHI 2019: https://makeabilitylab.cs.washington.edu/media/publications/Saha_ProjectSidewalkAWebBasedCrowdsourcingToolForCollectingSidewalkAccessibilityDataAtScale_CHI2019.pdf
- Chi, Sha & Zhang, W4A 2023: https://par.nsf.gov/servlets/purl/10532879
- MacLennan et al., Autism in Adulthood: https://durham-repository.worktribe.com/output/1189424
- Franklin Institute Sensory Guide (2024): https://www.fi.edu/sites/default/files/2024-02/24_TFI_Sensory_Guide_v08.pdf
- OSM wiki, Key:wheelchair: https://wiki.openstreetmap.org/wiki/Key:wheelchair (edited 26 Jul 2026)
- OSM wiki, Key:check_date: https://wiki.openstreetmap.org/wiki/Key:check_date (edited 18 May 2026)
- StreetComplete: https://github.com/streetcomplete/StreetComplete (commit of 14 Oct 2026)
- Google Maps accessibility help: https://support.google.com/maps/answer/9882117
- Yelp accessibility features: https://blog.yelp.com/news/yelp-unveils-new-accessibility-features-to-help-people-with-disabilities-connect-with-local-businesses/ (25 Jun 2024)
- 2010 ADA Standards: https://www.ada.gov/law-and-regs/design-standards/2010-stds/
- What's New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- DOJ Title II web rule fact sheet: https://www.ada.gov/resources/2024-03-08-web-rule/
- SEPTA elevator feed: https://www3.septa.org/api/elevator/index.php (also queried 2026-10-17)
- SEPTA station accessibility: https://wwww.septa.org/accessibility/station-accessibility/
- SEPTA GTFS releases: https://github.com/septadev/GTFS/releases
- Philadelphia polling place accessibility: https://vote.phila.gov/voting/voting-at-the-polls/polling-place-accessibility
- City AIS API usage: https://github.com/CityOfPhiladelphia/ais/blob/master/docs/APIUSAGE.md
- Nominatim usage policy: https://operations.osmfoundation.org/policies/nominatim/
- OSM tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- Philadelphia Museum of Art accessibility: https://philamuseum.org/visit/accessibility
- CDC, Disability Impacts All of Us: https://www.cdc.gov/disability-and-health/articles-documents/disability-impacts-all-of-us-infographic.html (page dated 5 May 2026; read 2026-10-17)
- ICO, special category data: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Google contribution policy: https://support.google.com/contributionpolicy/answer/7400114
