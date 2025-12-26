# DaySpark for Obsidian 🕯️

**DaySpark** is a "Digital Almanac" plugin for Obsidian that injects rich, context-aware data into your daily notes.

Unlike standard template plugins that just paste a date, DaySpark calculates the exact astronomical, meteorological, and calendar context for _any_ date you give it—whether it's today, a date in the future, or a journal entry from 10 years ago.

## ✨ Features

### 📅 Smart Calendars

- **Universal Support:** Works with generic `.ics` URLs and local `.ics` files in your vault.
- **Grouping:** Organize events into "Work," "Personal," or "Birthdays" groups with their own custom headers.
- **Time Travel:** Correctly fetches past events for historical notes, keeping your archives accurate.

### 🌑 Precision Astronomy (Almanac Style)

- **Moon Phase:** Calculates phase and illumination percentage using high-precision geocentric algorithms.
- **Moon Age:** Tracks the moon's age in calendar days since the last New Moon, matching traditional logic.
- **Constellations:** Identifies the Moon's actual Astronomical Position (e.g., Ophiuchus, Cetus) using UTC-based calculations.
- **Rise & Set:** Precise local times for Sun and Moon, accounting for your exact coordinates and local time zone shifts.

### ✨ Celestial Events

- **Conjunctions:** Identifies when planets or the Moon align in Right Ascension (e.g., `☌ ☾ ♄`).
- **Meteor Showers:** Alerts you to major meteor shower peaks (e.g., Perseids, Geminids).
- **Lunar Events:** Tracks Lunar Nodes (`at ☊`), Equator crossings (`crosses Eq.`), and distance extremes (`at Perigee` / `at Apogee`).
- **Planetary Stations:** (Optional) Can be configured to track when planets turn Retrograde or Direct.

### 🪐 Sky Watch

- **Planetary Visibility:** Identifies which naked-eye planets (Mercury through Saturn) are visible on any given night.
- **Observational Advice:** Automatically determines if a planet is visible "All Night," "In the Morning," or if it is "Difficult" due to proximity to the Sun.

### 🌦️ Weather & Elements

- **Context Aware:** Pulls actual observed weather data for past dates or the local forecast for future dates.
- **Unit Support:** Fully supports both Metric (°C/km/h) and Imperial (°F/mph) systems.
- **Zero Config:** Powered by the free Open-Meteo API—no API keys or sign-ups required.

### 🕰️ On This Day in History

- **Wikipedia Integration:** Fetches significant historical events that happened on your note's specific date.
- **Curated Results:** Limits results to a configurable list (1-10) to keep your daily notes clean and focused.

### 📍 Dynamic Location

- **Auto-Detection:** Reverse-geocodes your default Lat/Long settings to a recognizable city name.
- **Travel Overrides:** Traveling? Simply add a `## My Location` section with a city name (e.g., `- Las Vegas, NV`) to your note. DaySpark will detect the change and recalculate all astronomy and weather data for that specific location.

### 📜 Seasons & Lore

- **Astronomical Seasons:** Flags Equinoxes and Solstices based on the Sun's position.
- **Cross-Quarter Days:** Includes traditional Almanac mid-season markers like Samhain (Nov 1), Imbolc, Beltane, and Lammas.
- **Meteorological Seasons:** (Optional) Markers for the 1st of the month transitions.
- **Weather Lore:** Includes traditional monthly weather proverbs and rhymes straight from the Farmer's Almanac.

## 🚀 Installation

### Manual Installation

1. Download the latest release.
2. Extract `main.js`, `manifest.json`, and `styles.css` into your vault's plugin folder: `.obsidian/plugins/dayspark/`.
3. Reload Obsidian and enable **DaySpark** in the community plugins settings.

## ⚙️ Configuration

- **Latitude/Longitude:** Set your home base coordinates for default calculations.
- **24-Hour Time:** Toggle between `2:30 PM` and `14:30` formats.
- **Overwrite Sections:** Enable this to allow DaySpark to update existing sections (perfect for refreshing weather or correcting location).
- **Modular Toggles:** Every data point (Moon age, Zodiac position, Meteor showers, etc.) has its own toggle to let you build the perfect "Spark."

## 🔒 Privacy

DaySpark is built for privacy:

- **Local Math:** All astronomical calculations are performed locally on your device.
- **No Tracking:** No user data or coordinates are ever sent to a central server.
- **Direct APIs:** Weather and History data are fetched directly from public, open APIs (Open-Meteo, Wikipedia, and Nominatim).

## 🗺️ Roadmap

- I think that's it for sure now.