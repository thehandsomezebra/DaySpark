# DaySpark for Obsidian 🕯️

**DaySpark** is a "Digital Almanac" plugin for Obsidian that injects rich, context-aware data into your daily notes.

Unlike standard template plugins that just paste a date, DaySpark calculates the exact astronomical, meteorological, and calendar context for _any_ date you give it—whether it's today, a date in the future, or a journal entry from 10 years ago.

## ✨ Features

### 📅 Smart Calendars

- **Universal Support:** Works with generic `.ics` URLs and local `.ics` files in your vault.
- **Grouping:** Organize events into "Work," "Personal," or "Astrology" groups with their own headers.
- **Time Travel:** Correctly fetches past events for historical notes.
    

### 🌑 Precision Astronomy (Almanac Style)

- **Moon Phase:** Calculates phase, illumination, and age (in days) matching traditional Farmer's Almanac logic.
- **Constellations:** accurate Astronomical Positions (e.g., Ophiuchus, Cetus) using UTC Midnight calculations.
- **Rise & Set:** Precise local times for Sun and Moon, accounting for your exact coordinates and Daylight Saving Time.
    

### 🪐 Sky Watch

- **Planetary Visibility:** Tells you which naked-eye planets (Mercury, Venus, Mars, Jupiter, Saturn) are visible tonight.
- **Smart Advice:** Knows if a planet is visible "All Night," "In the Morning," or if it's "Difficult" due to twilight glare.
    

### 🌦️ Weather & Elements

- **Context Aware:** Pulls the actual observed weather for past dates or the forecast for future dates.
- **Metric/Imperial:** Supports °F/mph and °C/km/h.
- **Zero Config:** Uses the free Open-Meteo API (no API key required).
    
### 🕰️ On This Day in History

- **Historical Events:** Fetches significant events that happened on this specific date from Wikipedia.
- **Curated:** Limits the list to top events (configurable 1-10) to keep your notes focused without clutter.


### 📍 Dynamic Location

- **Auto-Detection:** Automatically reverse-geocodes your default Lat/Long settings to a city name (e.g., "Waterford, MI").
- **Travel Ready:** Manually override the location for a specific note by adding a `## My Location` section. DaySpark will recalculate the sun, moon, and weather for _that_ specific place.
    

### 📜 Seasons & Lore

- **Solar Events:** Automatically flags Equinoxes and Solstices.
- **Weather Lore:** Includes traditional monthly weather proverbs and rhymes.
    

## 🚀 Installation

### From Community Plugins

_Coming Soon!_

### Manual Installation

1. Download the latest release from the Releases tab.
2. Extract the files (`main.js`, `manifest.json`) into your vault's plugin folder: `.obsidian/plugins/dayspark/`.
3. Reload Obsidian and enable DaySpark in settings.
    

## ⚙️ Configuration

### 1. General Settings

- **Latitude/Longitude:** Set your home base coordinates (e.g., 40.7128, -74.0060).
- **24-Hour Time:** Toggle between `2:30 PM` and `14:30`.
- **Overwrite Sections:** If enabled, clicking the DaySpark button will update existing sections (useful if you change the location).
    

### 2. Calendars

- Add multiple groups of ICS feeds (Public ICS URLs or local file paths).
- **Descriptions:** Toggle whether to include event details/notes in your daily log.
    

### 3. Modules

- Enable or disable specific modules (Moon, Sun, Weather, Planets, Lore) to keep your notes clean.
    

## 📝 Usage

### The "Magic Button"

Open any note (e.g., `2025-12-25.md`) and click the **Sparkles** icon in the ribbon (or use the command `DaySpark: Add Context`).

### Changing Location

Traveling? Just add this to your daily note before clicking the button:

```
## My Location
- Las Vegas, NV

```

DaySpark will detect this, find the coordinates for Las Vegas, and generate the weather and astronomy data for Nevada instead of your home settings.

## 🔒 Privacy

DaySpark is privacy-focused:

- **No Tracking:** No user data is sent to the developer.
- **Open APIs:** Weather and Geocoding data are fetched directly from [Open-Meteo](https://open-meteo.com "null") and [Nominatim (OSM)](https://nominatim.org "null") from your device.
- **History Data:** Historical events are fetched from the [Wikimedia API](https://api.wikimedia.org "null") (Wikipedia).
- **Local Processing:** All astronomical math (Sun, Moon, Planets) is calculated locally on your device using high-precision algorithms.
    

## 🗺️ Roadmap


- **Location History:** Integration with Google Takeout location data.