import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';

interface PlanetPosition {
    ra: number;
}

interface OrbitalElements {
    L: number;
    v: number;
    e: number;
    M: number;
    a: number;
}

/**
 * MANUAL ASTRONOMY PROVIDER (Farmer's Almanac Edition)
 * This provider uses manual orbital mechanics to calculate geocentric positions.
 * It includes Earth's orbit to provide accurate geocentric Right Ascension for conjunctions.
 * Fully self-contained: no external astronomy libraries required.
 */

export class CelestialEventsProvider implements SparkProvider {
    id = 'celestial-events';
    displayName = 'Celestial Events';
    targetHeader = '## Celestial Events';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.celestialHeader) this.targetHeader = this.settings.celestialHeader;
    }

    getDataForDate(targetDate: Date, fileContent?: string): Promise<ProviderResult> {
        if (!this.settings.enableCelestialEvents) return Promise.resolve({ items: [] });

        const rawEvents: { time: Date, text: string }[] = [];
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        
        // 1-Minute Resolution Scanner (1440 steps)
        const steps = 1440;
        const stepSize = 60000;

        const planets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

        // Initial state
        let prevMoon = this.getMoonPosition(dayStart);
        let prevPlanets = new Map<string, PlanetPosition>();
        planets.forEach(p => prevPlanets.set(p, this.getGeocentricPlanetPosition(p, dayStart)));

        // 1. High-Resolution Scanner
        if (this.settings.enableBasicEvents || this.settings.enableAdvancedAstronomy) {
            for (let i = 1; i <= steps; i++) {
                const currentTime = new Date(dayStart.getTime() + i * stepSize);
                const currMoon = this.getMoonPosition(currentTime);
                const currPlanets = new Map<string, PlanetPosition>();
                planets.forEach(p => currPlanets.set(p, this.getGeocentricPlanetPosition(p, currentTime)));

                // --- A. CONJUNCTIONS (Geocentric Right Ascension) ---
                if (this.settings.enableBasicEvents) {
                    planets.forEach(p => {
                        const p1 = prevPlanets.get(p);
                        const p2 = currPlanets.get(p);
                        
                        const d1 = this.normalizeRA(prevMoon.ra - p1.ra);
                        const d2 = this.normalizeRA(currMoon.ra - p2.ra);

                        if (d1 * d2 <= 0 && Math.abs(d1 - d2) < 1) {
                            const symbol = this.getPlanetSymbol(p);
                            rawEvents.push({ 
                                time: currentTime, 
                                text: `☌ ☾ ${symbol} **Conjunction**` 
                            });
                        }
                    });

                    // --- B. MOON NODES (Latitude Crossing) ---
                    if (prevMoon.lat * currMoon.lat <= 0) {
                        const label = currMoon.lat > prevMoon.lat ? 'at ☊ (Ascending)' : 'at ☋ (Descending)';
                        rawEvents.push({ 
                            time: currentTime, 
                            text: `☽ **${label} Node**` 
                        });
                    }
                }

                // --- C. ADVANCED EVENTS ---
                if (this.settings.enableAdvancedAstronomy) {
                    // Equator Crossing
                    if (prevMoon.dec * currMoon.dec <= 0) {
                        const label = currMoon.dec > prevMoon.dec ? 'crosses Equator North' : 'crosses Equator South';
                        rawEvents.push({ time: currentTime, text: `☽ **${label}**` });
                    }

                    if (i > 1) {
                        const t0 = new Date(dayStart.getTime() + (i-2) * stepSize);
                        const moon0 = this.getMoonPosition(t0);
                        
                        const vDec1 = prevMoon.dec - moon0.dec;
                        const vDec2 = currMoon.dec - prevMoon.dec;
                        if (vDec1 * vDec2 < 0 && Math.abs(vDec1) > 0) {
                            const label = prevMoon.dec > 0 ? 'runs High' : 'runs Low';
                            rawEvents.push({ time: currentTime, text: `☽ **${label}**` });
                        }

                        const vDist1 = prevMoon.dist - moon0.dist;
                        const vDist2 = currMoon.dist - prevMoon.dist;
                        if (vDist1 * vDist2 < 0 && Math.abs(vDist1) > 0) {
                            const label = vDist1 > 0 ? 'at Apogee (Furthest)' : 'at Perigee (Closest)';
                            rawEvents.push({ time: currentTime, text: `☽ **${label}**` });
                        }
                    }
                }

                prevMoon = currMoon;
                prevPlanets = currPlanets;
            }
        }

        // 2. METEOR SHOWERS (Updated with associated comets)
        if (this.settings.enableMeteorShowers) {
            const shower = this.getMeteorShower(targetDate);
            if (shower) {
                rawEvents.push({ time: dayStart, text: `🌠 **Meteor Shower:** ${shower}` });
            }
        }

        // Sort by time, then map to unique text items
        rawEvents.sort((a, b) => a.time.getTime() - b.time.getTime());
        const uniqueItems = [...new Set(rawEvents.map(e => e.text))];

        return Promise.resolve({ items: uniqueItems });
    }

    private getJulianDate(date: Date): number {
        return (date.getTime() / 86400000.0) + 2440587.5;
    }

    private getMoonPosition(date: Date) {
        const d = this.getJulianDate(date) - 2451545.0;

        const L = this.rev(218.316 + 13.176396 * d); 
        const M = this.rev(134.963 + 13.064993 * d); 
        const F = this.rev(93.272 + 13.229350 * d);  
        const D = this.rev(297.850 + 12.190749 * d); 

        let lon = L + 6.289 * Math.sin(this.rad(M)) 
                    + 1.274 * Math.sin(this.rad(2 * D - M))
                    + 0.658 * Math.sin(this.rad(2 * D))
                    + 0.214 * Math.sin(this.rad(2 * M))
                    - 0.186 * Math.sin(this.rad(this.rev(357.529 + 0.9856 * d)));
        
        let lat = 5.128 * Math.sin(this.rad(F))
                    + 0.280 * Math.sin(this.rad(M + F))
                    + 0.277 * Math.sin(this.rad(M - F))
                    + 0.173 * Math.sin(this.rad(2 * D - F));

        const dist = 385001 - 20905 * Math.cos(this.rad(M))
                            - 3699 * Math.cos(this.rad(2 * D - M))
                            - 2956 * Math.cos(this.rad(2 * D));

        const ecl = this.rad(23.4393 - 0.0000004 * d);
        const rLon = this.rad(lon);
        const rLat = this.rad(lat);

        const ra = this.rev(this.deg(Math.atan2(
            Math.sin(rLon) * Math.cos(ecl) - Math.tan(rLat) * Math.sin(ecl),
            Math.cos(rLon)
        ))) / 15;

        const dec = this.deg(Math.asin(
            Math.sin(rLat) * Math.cos(ecl) + Math.cos(rLat) * Math.sin(ecl) * Math.sin(rLon)
        ));

        return { ra, dec, lat, dist };
    }

    private getGeocentricPlanetPosition(name: string, date: Date): PlanetPosition {
        const d = this.getJulianDate(date) - 2451545.0;

        const sunL = this.rev(280.466 + 0.985647 * d);
        const sunM = this.rev(357.529 + 0.985600 * d);
        const sunR = 1.00014 - 0.01671 * Math.cos(this.rad(sunM));
        const sunLon = this.rev(sunL + 1.915 * Math.sin(this.rad(sunM)));

        const elements: Record<string, OrbitalElements> = {
            'Mercury': { L: 252.25, v: 4.09233, e: 0.2056, M: 174.79, a: 0.3871 },
            'Venus':   { L: 181.98, v: 1.60213, e: 0.0067, M: 50.40,  a: 0.7233 },
            'Mars':    { L: 355.45, v: 0.52402, e: 0.0934, M: 19.38,  a: 1.5237 },
            'Jupiter': { L: 34.40,  v: 0.08308, e: 0.0484, M: 20.02,  a: 5.2026 },
            'Saturn':  { L: 49.94,  v: 0.03344, e: 0.0541, M: 317.02, a: 9.5549 },
            'Uranus':  { L: 313.23, v: 0.01173, e: 0.0471, M: 142.59, a: 19.2184 },
            'Neptune': { L: 304.88, v: 0.00598, e: 0.0086, M: 260.24, a: 30.1104 },
            'Pluto':   { L: 238.93, v: 0.00397, e: 0.2488, M: 14.86,  a: 39.482 }
        };

        const el = elements[name];
        if (!el) return { ra: 0 };

        const pM = this.rev(el.M + el.v * d);
        const pHeliolon = this.rev(el.L + el.v * d + (360/Math.PI) * el.e * Math.sin(this.rad(pM)));
        const pR = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(this.rad(pM)));

        const x = pR * Math.cos(this.rad(pHeliolon)) + sunR * Math.cos(this.rad(sunLon));
        const y = pR * Math.sin(this.rad(pHeliolon)) + sunR * Math.sin(this.rad(sunLon));
        const lon = this.rev(this.deg(Math.atan2(y, x)));

        const ecl = this.rad(23.439);
        const ra = this.rev(this.deg(Math.atan2(
            Math.sin(this.rad(lon)) * Math.cos(ecl),
            Math.cos(this.rad(lon))
        ))) / 15;

        return { ra };
    }

    private rad(deg: number) { return deg * Math.PI / 180; }
    private deg(rad: number) { return rad * 180 / Math.PI; }
    private rev(deg: number) { 
        let a = deg % 360;
        if (a < 0) a += 360;
        return a;
    }
    private normalizeRA(diff: number) {
        let d = diff;
        while (d < -12) d += 24;
        while (d > 12) d -= 24;
        return d;
    }

    private getPlanetSymbol(name: string): string {
        const symbols: Record<string, string> = {
            'Mercury': '☿', 'Venus': '♀', 'Mars': '♂', 
            'Jupiter': '♃', 'Saturn': '♄', 'Uranus': '⛢', 'Neptune': '♆',
            'Pluto': '♇'
        };
        return symbols[name] || '';
    }

    private getMeteorShower(date: Date): string | null {
        const m = date.getMonth();
        const d = date.getDate();

        // Data derived from Farmer's Almanac Principle Meteor Showers table
        // Month is 0-indexed (Jan=0, Apr=3, etc.)
        const showers = [ 
            { name: "Quadrantids", m: 0, d: 4, range: 0, comet: null }, 
            { name: "Lyrids", m: 3, d: 22, range: 0, comet: "Thatcher" }, 
            { name: "Eta Aquarids", m: 4, d: 4, range: 0, comet: "Halley" }, 
            { name: "Delta Aquarids", m: 6, d: 30, range: 0, comet: null }, 
            { name: "Perseids", m: 7, d: 12, range: 1, comet: "Swift-Tuttle" }, 
            { name: "Draconids", m: 9, d: 9, range: 0, comet: "Giacobini-Zinner" }, 
            { name: "Orionids", m: 9, d: 21, range: 1, comet: "Halley" }, 
            { name: "Northern Taurids", m: 10, d: 9, range: 0, comet: "Encke" }, 
            { name: "Leonids", m: 10, d: 17, range: 1, comet: "Tempel-Tuttle" }, 
            { name: "Andromedids", m: 10, d: 26, range: 1, comet: "Biela" }, 
            { name: "Geminids", m: 11, d: 13, range: 1, comet: null }, 
            { name: "Ursids", m: 11, d: 22, range: 0, comet: "Tuttle" } 
        ];

        for (const s of showers) { 
            if (m === s.m && Math.abs(d - s.d) <= s.range) {
                let text = `${s.name} (Peak)`;
                if (s.comet) {
                    text += ` — Associated Comet: ${s.comet}`;
                }
                return text;
            } 
        }
        return null;
    }
}