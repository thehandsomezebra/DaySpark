import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';

export class CelestialEventsProvider implements SparkProvider {
    id = 'celestial-events';
    displayName = 'Celestial Events';
    targetHeader = '## Celestial Events';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.celestialHeader) this.targetHeader = this.settings.celestialHeader;
    }

    async getDataForDate(targetDate: Date): Promise<ProviderResult> {
        if (!this.settings.enableCelestialEvents) return { items: [] };

        const items: string[] = [];
        
        // We scan the day in steps to find events crossing thresholds
        const startDay = new Date(targetDate);
        startDay.setUTCHours(0,0,0,0);
        
        // 1. LUNAR EVENTS (Nodes, Equator, Distance, Declination)
        const lunarEvents = this.getLunarEvents(startDay);
        items.push(...lunarEvents);

        // 2. PLANETARY EVENTS (Conjunctions, Stations)
        const planetEvents = this.getPlanetaryEvents(startDay);
        items.push(...planetEvents);

        // 3. METEOR SHOWERS
        const meteors = this.getMeteorShower(targetDate);
        if (meteors) {
            items.push(`🌠 **Meteor Shower:** ${meteors}`);
        }

        return { items };
    }

    // --- EVENT DETECTORS ---

    private getLunarEvents(date: Date): string[] {
        const events: string[] = [];
        const steps = 24; // Check every hour
        
        let prevPos = this.getMoonFullPos(date, 0); // 0 offset
        
        // State trackers for extremes
        let minDist = prevPos.dist, maxDist = prevPos.dist;
        let minDec = prevPos.dec, maxDec = prevPos.dec;
        let distTrend = 0; // -1 shrinking, 1 growing
        let decTrend = 0;

        for (let i = 1; i <= steps; i++) {
            const t = new Date(date.getTime() + (i * 3600000));
            const currPos = this.getMoonFullPos(t, 0);

            // 1. NODES (Latitude crossing 0)
            if (Math.sign(prevPos.lat) !== Math.sign(currPos.lat)) {
                if (prevPos.lat < 0) events.push(`☽ **at ☊** (Ascending Node)`);
                else events.push(`☽ **at ☋** (Descending Node)`);
            }

            // 2. EQUATOR (Declination crossing 0)
            if (Math.sign(prevPos.dec) !== Math.sign(currPos.dec)) {
                events.push(`☽ **on Eq.** (Crosses Equator)`);
            }

            // 3. APOGEE / PERIGEE (Distance Extremes)
            // We check the derivative (slope)
            const currDistTrend = Math.sign(currPos.dist - prevPos.dist);
            if (distTrend !== 0 && currDistTrend !== distTrend) {
                // Direction changed
                if (distTrend < 0) events.push(`☽ **at Perig.** (Closest)`); // Was shrinking, now growing
                else events.push(`☽ **at Apo.** (Furthest)`); // Was growing, now shrinking
            }
            distTrend = currDistTrend;

            // 4. RUNS HIGH / LOW (Declination Extremes)
            // Usually happens once every ~14 days
            // Only flagging major extremes (> 18 degrees usually)
            const currDecTrend = Math.sign(currPos.dec - prevPos.dec);
            if (decTrend !== 0 && currDecTrend !== decTrend) {
                if (Math.abs(currPos.dec) > 18) { // Filter out minor wobbles
                    if (decTrend > 0) events.push(`☽ **runs High**`);
                    else events.push(`☽ **runs Low**`);
                }
            }
            decTrend = currDecTrend;

            prevPos = currPos;
        }
        
        return [...new Set(events)]; // Dedup
    }

    private getPlanetaryEvents(date: Date): string[] {
        const events: string[] = [];
        const bodies = [
            { id: 'mercury', name: 'Mercury', symbol: '☿' },
            { id: 'venus', name: 'Venus', symbol: '♀' },
            { id: 'mars', name: 'Mars', symbol: '♂' },
            { id: 'jupiter', name: 'Jupiter', symbol: '♃' },
            { id: 'saturn', name: 'Saturn', symbol: '♄' },
            { id: 'uranus', name: 'Uranus', symbol: '♅' },
            { id: 'neptune', name: 'Neptune', symbol: '♆' }
        ];

        const posStart: any = {};
        const posEnd: any = {};
        
        // Calculate Start/End positions for conjunctions
        const startDay = new Date(date); startDay.setUTCHours(0,0,0,0);
        const endDay = new Date(date); endDay.setUTCHours(23,59,59,999);

        // Also calculate "Yesterday" and "Tomorrow" to detect Stations (change in direction)
        const prevDay = new Date(startDay.getTime() - 86400000);
        const nextDay = new Date(endDay.getTime() + 86400000);

        for (const body of bodies) {
            posStart[body.id] = this.getPlanetEclipticLon(startDay, body.id);
            posEnd[body.id] = this.getPlanetEclipticLon(endDay, body.id);
            
            // CHECK STATIONARY
            // Retrograde motion logic: Longitude decreases. Direct: Increases.
            // Station is when it flips.
            const lonPrev = this.getPlanetEclipticLon(prevDay, body.id);
            const lonCurr = posStart[body.id]; // Approx middle
            const lonNext = this.getPlanetEclipticLon(nextDay, body.id);
            
            // Calculate velocity (diff)
            let v1 = lonCurr - lonPrev;
            let v2 = lonNext - lonCurr;
            // Normalize wrapping
            if (v1 < -180) v1 += 360; if (v1 > 180) v1 -= 360;
            if (v2 < -180) v2 += 360; if (v2 > 180) v2 -= 360;

            if (Math.sign(v1) !== Math.sign(v2) && Math.abs(v1) > 0.0001) {
                events.push(`${body.symbol} **stat.** (${body.name} Stationary)`);
            }
        }

        // CHECK CONJUNCTIONS (Moon vs Planets, Planets vs Planets)
        const moonStart = this.getMoonFullPos(startDay, 0).lon;
        const moonEnd = this.getMoonFullPos(endDay, 0).lon;

        for (const body of bodies) {
            // Moon vs Planet
            if (this.checkCrossing(moonStart, moonEnd, posStart[body.id], posEnd[body.id])) {
                events.push(`☌ **Conjunction:** ☾ ${body.symbol} (Moon & ${body.name})`);
            }
        }

        // Planet vs Planet
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const b1 = bodies[i];
                const b2 = bodies[j];
                // Skip outer planets mutuals (too slow, rare)
                if (b1.id === 'uranus' && b2.id === 'neptune') continue;

                if (this.checkCrossing(posStart[b1.id], posEnd[b1.id], posStart[b2.id], posEnd[b2.id])) {
                    events.push(`☌ **Conjunction:** ${b1.symbol} ${b2.symbol} (${b1.name} & ${b2.name})`);
                }
            }
        }

        return events;
    }

    private checkCrossing(start1: number, end1: number, start2: number, end2: number): boolean {
        let diff1 = start1 - start2;
        let diff2 = end1 - end2;
        // Normalize
        while (diff1 < -180) diff1 += 360; while (diff1 > 180) diff1 -= 360;
        while (diff2 < -180) diff2 += 360; while (diff2 > 180) diff2 -= 360;
        
        // Sign change means they crossed (0 difference)
        // Filter out cases where they are far apart but wrapping makes it look like a cross (rare with normalization)
        return (Math.sign(diff1) !== Math.sign(diff2) && Math.abs(diff1 - diff2) < 20);
    }

    // --- MATH ENGINE ---

    private getMoonFullPos(date: Date, offsetDays: number = 0) {
        // High Precision Meeus (Truncated for speed/file size)
        const t = new Date(date.getTime() + (offsetDays * 86400000));
        const d = (t.getTime() / 86400000) - 10957.5;
        const rad = Math.PI / 180;

        const L = (218.316 + 13.176396 * d) * rad;
        const M = (134.963 + 13.064993 * d) * rad;
        const F = (93.272 + 13.229350 * d) * rad;
        const D = (297.850 + 12.190749 * d) * rad; 
        const Ms = (357.529 + 0.98560028 * d) * rad;

        // Longitude
        let l = L + 6.289 * rad * Math.sin(M);
        l += 1.274 * rad * Math.sin(2 * D - M);
        l += 0.658 * rad * Math.sin(2 * D);
        l += -0.185 * rad * Math.sin(Ms);
        l += -0.114 * rad * Math.sin(2 * F);

        // Latitude (Important for Nodes)
        let b = 5.128 * rad * Math.sin(F);
        b += 0.280 * rad * Math.sin(M + F);
        b += 0.278 * rad * Math.sin(M - F);
        b += 0.173 * rad * Math.sin(2 * D - F);

        // Distance (Important for Apo/Perig)
        // Base distance approx 385000 km. 
        // Variation is -20905 * cos(M) ...
        let dist = 385000.56;
        dist += -20905.355 * Math.cos(M);
        dist += -3699.111 * Math.cos(2*D - M);
        dist += -2955.968 * Math.cos(2*D);

        // Declination (Requires Conversion to Equatorial)
        const obl = 23.439 * rad;
        const sinDec = Math.sin(b) * Math.cos(obl) + Math.cos(b) * Math.sin(obl) * Math.sin(l);
        const dec = Math.asin(sinDec) * (180/Math.PI);

        return {
            lon: l * (180/Math.PI) % 360,
            lat: b * (180/Math.PI),
            dist: dist,
            dec: dec
        };
    }

    private getPlanetEclipticLon(date: Date, planet: string): number {
        const d = (date.getTime() / 86400000) - 10957.5; 
        const rad = Math.PI / 180;
        
        // J2000 Elements
        const elems: any = {
            mercury: { N: 48.3313, i: 7.0047, w: 29.1241, a: 0.387098, e: 0.205635, M: 168.6562 + 4.0923344368 * d },
            venus:   { N: 76.6799, i: 3.3946, w: 54.8910, a: 0.723330, e: 0.006773, M: 48.0052 + 1.6021302244 * d },
            mars:    { N: 49.5574, i: 1.8497, w: 286.5016, a: 1.523688, e: 0.093405, M: 18.6021 + 0.5240207766 * d },
            jupiter: { N: 100.4542, i: 1.3030, w: 273.8777, a: 5.202561, e: 0.048498, M: 19.8950 + 0.0830853001 * d },
            saturn:  { N: 113.6634, i: 2.4886, w: 339.3939, a: 9.55475, e: 0.055546, M: 316.9670 + 0.0334442282 * d },
            uranus:  { N: 74.0005, i: 0.7733, w: 96.6612, a: 19.18171, e: 0.047318, M: 142.5905 + 0.011725806 * d },
            neptune: { N: 131.7806, i: 1.7700, w: 272.8461, a: 30.05826, e: 0.008606, M: 260.2471 + 0.005995147 * d }
        };

        const p = elems[planet];
        if (!p) return 0;

        let E = p.M + (180/Math.PI) * p.e * Math.sin(p.M * rad) * (1 + p.e * Math.cos(p.M * rad));
        for(let j=0; j<5; j++) {
            const E_rad = E * rad;
            const M_calc = E - (180/Math.PI) * p.e * Math.sin(E_rad);
            E = E + (p.M - M_calc);
        }

        const xv = p.a * (Math.cos(E * rad) - p.e);
        const yv = p.a * Math.sqrt(1 - p.e*p.e) * Math.sin(E * rad);
        const r = Math.sqrt(xv*xv + yv*yv); 
        const xh = r * (Math.cos(p.N*rad) * Math.cos((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) - Math.sin(p.N*rad) * Math.sin((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) * Math.cos(p.i*rad));
        const yh = r * (Math.sin(p.N*rad) * Math.cos((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) + Math.cos(p.N*rad) * Math.sin((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) * Math.cos(p.i*rad));
        
        // Earth
        const Me = 357.529 + 0.98560028 * d;
        const Le = 280.466 + 0.98564736 * d;
        const le = Le + 1.915 * Math.sin(Me*rad) + 0.020 * Math.sin(2*Me*rad);
        const Re = 1.00014 - 0.01671 * Math.cos(Me*rad) - 0.00014 * Math.cos(2*Me*rad);
        const xe = Re * Math.cos(le*rad);
        const ye = Re * Math.sin(le*rad);

        // Geocentric
        const xg = xh + xe;
        const yg = yh + ye;
        
        const lon = Math.atan2(yg, xg) * (180/Math.PI);
        return (lon + 360) % 360;
    }

    private getMeteorShower(date: Date): string | null {
        const showers = [
            { name: "Quadrantids", m: 0, d: 3, range: 2 },
            { name: "Lyrids", m: 3, d: 22, range: 1 },
            { name: "Eta Aquariids", m: 4, d: 6, range: 2 },
            { name: "Perseids", m: 7, d: 12, range: 2 },
            { name: "Orionids", m: 9, d: 21, range: 2 },
            { name: "Leonids", m: 10, d: 17, range: 1 },
            { name: "Geminids", m: 11, d: 14, range: 2 },
            { name: "Ursids", m: 11, d: 22, range: 1 }
        ];

        const m = date.getMonth();
        const d = date.getDate();

        for (const s of showers) {
            if (m === s.m && Math.abs(d - s.d) <= s.range) {
                return `${s.name} (Peak)`;
            }
        }
        return null;
    }
}