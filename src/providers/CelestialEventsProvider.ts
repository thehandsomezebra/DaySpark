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

        const rawEvents: { timeMs: number, text: string }[] = [];
        
        const startDay = new Date(targetDate);
        startDay.setUTCHours(0,0,0,0);
        
        // 1. LUNAR EVENTS (Nodes, Perigee, etc.)
        const lunarEvents = this.getLunarEvents(startDay);
        rawEvents.push(...lunarEvents);

        // 2. PLANETARY EVENTS (Conjunctions, Aspects, Stations)
        const planetEvents = this.getPlanetaryEvents(startDay);
        rawEvents.push(...planetEvents);

        // Sort events by time
        rawEvents.sort((a, b) => a.timeMs - b.timeMs);

        const items = rawEvents.map(e => e.text);

        // 3. METEOR SHOWERS
        const meteors = this.getMeteorShower(targetDate);
        if (meteors) {
            items.push(`🌠 **Meteor Shower:** ${meteors}`);
        }

        return { items };
    }

    private formatTime(date: Date): string {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const mStr = minutes < 10 ? '0' + minutes : minutes;
        
        if (this.settings.use24HourFormat) {
            const hStr = hours < 10 ? '0' + hours : hours;
            return `${hStr}:${mStr}`;
        } else {
            const period = hours >= 12 ? 'PM' : 'AM';
            const h12 = hours % 12 || 12;
            return `${h12}:${mStr} ${period}`;
        }
    }

    // --- EVENT DETECTORS ---

    private getLunarEvents(date: Date): { timeMs: number, text: string }[] {
        const events: { timeMs: number, text: string }[] = [];
        const steps = 24; 
        
        let prevPos = this.getMoonFullPos(date, 0);
        let distTrend = 0; 
        let decTrend = 0;

        for (let i = 1; i <= steps; i++) {
            const t = new Date(date.getTime() + (i * 3600000));
            const currPos = this.getMoonFullPos(t, 0);

            const getEventTime = (prevVal: number, currVal: number, target: number = 0) => {
                const fraction = (target - prevVal) / (currVal - prevVal);
                return date.getTime() + ((i - 1) * 3600000) + (fraction * 3600000);
            };

            // A. NODES (Latitude crossing 0)
            // This IS the "Conjunction with Node"
            if (Math.sign(prevPos.lat) !== Math.sign(currPos.lat)) {
                const timeMs = getEventTime(prevPos.lat, currPos.lat, 0);
                const timeStr = this.formatTime(new Date(timeMs));
                if (prevPos.lat < 0) events.push({ timeMs, text: `${timeStr} ☽ **at ☊** (Ascending Node)` });
                else events.push({ timeMs, text: `${timeStr} ☽ **at ☋** (Descending Node)` });
            }

            if (this.settings.showAdvancedAstronomy) {
                if (Math.sign(prevPos.dec) !== Math.sign(currPos.dec)) {
                    const timeMs = getEventTime(prevPos.dec, currPos.dec, 0);
                    const timeStr = this.formatTime(new Date(timeMs));
                    events.push({ timeMs, text: `${timeStr} ☽ **on Eq.** (Crosses Equator)` });
                }

                const currDistTrend = Math.sign(currPos.dist - prevPos.dist);
                if (distTrend !== 0 && currDistTrend !== distTrend) {
                    const timeMs = t.getTime(); 
                    const timeStr = this.formatTime(t);
                    if (distTrend < 0) events.push({ timeMs, text: `${timeStr} ☽ **at Perig.** (Closest)` });
                    else events.push({ timeMs, text: `${timeStr} ☽ **at Apo.** (Furthest)` });
                }
                distTrend = currDistTrend;

                const currDecTrend = Math.sign(currPos.dec - prevPos.dec);
                if (decTrend !== 0 && currDecTrend !== decTrend) {
                    if (Math.abs(currPos.dec) > 18) {
                        const timeMs = t.getTime();
                        const timeStr = this.formatTime(t);
                        if (decTrend > 0) events.push({ timeMs, text: `${timeStr} ☽ **runs High**` });
                        else events.push({ timeMs, text: `${timeStr} ☽ **runs Low**` });
                    }
                }
                decTrend = currDecTrend;
            }

            prevPos = currPos;
        }
        
        const uniqueEvents = new Map();
        for (const e of events) { uniqueEvents.set(e.text, e); }
        return Array.from(uniqueEvents.values());
    }

    private getPlanetaryEvents(date: Date): { timeMs: number, text: string }[] {
        const events: { timeMs: number, text: string }[] = [];
        const bodies = [
            { id: 'sun', name: 'Sun', symbol: '☉' },
            { id: 'mercury', name: 'Mercury', symbol: '☿' },
            { id: 'venus', name: 'Venus', symbol: '♀' },
            { id: 'mars', name: 'Mars', symbol: '♂' },
            { id: 'jupiter', name: 'Jupiter', symbol: '♃' },
            { id: 'saturn', name: 'Saturn', symbol: '♄' },
            { id: 'uranus', name: 'Uranus', symbol: '♅' },
            { id: 'neptune', name: 'Neptune', symbol: '♆' }
        ];

        if (this.settings.showDeepAstrology) {
            bodies.push({ id: 'pluto', name: 'Pluto', symbol: '♇' });
            bodies.push({ id: 'chiron', name: 'Chiron', symbol: '⚷' });
            bodies.push({ id: 'node', name: 'Node', symbol: '☊' });
        }

        const posStart: any = {};
        const posEnd: any = {};
        
        const startDay = new Date(date); startDay.setUTCHours(0,0,0,0);
        const endDay = new Date(date); endDay.setUTCHours(23,59,59,999);
        const prevDay = new Date(startDay.getTime() - 86400000);
        const nextDay = new Date(endDay.getTime() + 86400000);

        for (const body of bodies) {
            posStart[body.id] = this.getBodyLongitude(startDay, body.id);
            posEnd[body.id] = this.getBodyLongitude(endDay, body.id);
            
            if (this.settings.showRetrogrades && body.id !== 'node' && body.id !== 'sun') {
                const lonPrev = this.getBodyLongitude(prevDay, body.id);
                const lonCurr = posStart[body.id];
                const lonNext = this.getBodyLongitude(nextDay, body.id);
                
                let v1 = lonCurr - lonPrev;
                let v2 = lonNext - lonCurr;
                if (v1 < -180) v1 += 360; if (v1 > 180) v1 -= 360;
                if (v2 < -180) v2 += 360; if (v2 > 180) v2 -= 360;

                if (Math.sign(v1) !== Math.sign(v2) && Math.abs(v1) > 0.0001) {
                    const timeMs = startDay.getTime() + (12 * 3600000);
                    events.push({ timeMs, text: `${body.symbol} **stat.** (${body.name} Stationary)` });
                }
            }
        }

        const moonStart = this.getMoonFullPos(startDay, 0).lon;
        const moonEnd = this.getMoonFullPos(endDay, 0).lon;

        // 1. Moon vs Planets
        for (const body of bodies) {
            // FIX: Pass check for Node to avoid duplicate Conjunctions
            this.checkAspects(events, 'Moon', '☾', moonStart, moonEnd, body.name, body.symbol, posStart[body.id], posEnd[body.id], startDay.getTime(), body.id === 'node');
        }

        // 2. Planet vs Planet
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const b1 = bodies[i];
                const b2 = bodies[j];
                if (b1.id === 'uranus' && b2.id === 'neptune') continue;
                if ((b1.id === 'node' || b2.id === 'node') && !this.settings.showDeepAstrology) continue;

                this.checkAspects(events, b1.name, b1.symbol, posStart[b1.id], posEnd[b1.id], b2.name, b2.symbol, posStart[b2.id], posEnd[b2.id], startDay.getTime(), false);
            }
        }

        return events;
    }

    private checkAspects(events: { timeMs: number, text: string }[], name1: string, sym1: string, start1: number, end1: number, name2: string, sym2: string, start2: number, end2: number, startTimeMs: number, isMoonNode: boolean) {
        let diffStart = start1 - start2;
        let diffEnd = end1 - end2;

        const checkCrossing = (targetAngle: number, symbol: string, label: string) => {
            // Prevent duplicate Conjunction (0) or Opposition (180) for Moon-Node
            // because 'at ☊' and 'at ☋' already cover these physical events.
            if (isMoonNode && (targetAngle === 0 || targetAngle === 180)) return;

            let d1 = diffStart - targetAngle;
            let d2 = diffEnd - targetAngle;
            while (d1 < -180) d1 += 360; while (d1 > 180) d1 -= 360;
            while (d2 < -180) d2 += 360; while (d2 > 180) d2 -= 360;

            if (Math.sign(d1) !== Math.sign(d2) && Math.abs(d1 - d2) < 20) {
                const fraction = (0 - d1) / (d2 - d1);
                const timeMs = startTimeMs + (fraction * 86400000);
                const timeStr = this.formatTime(new Date(timeMs));
                events.push({ timeMs, text: `${timeStr} ${symbol} **${label}:** ${sym1} ${sym2} (${name1} & ${name2})` });
            }
            
            if (targetAngle !== 0 && targetAngle !== 180) {
                 let d1_neg = diffStart - (-targetAngle);
                 let d2_neg = diffEnd - (-targetAngle);
                 while (d1_neg < -180) d1_neg += 360; while (d1_neg > 180) d1_neg -= 360;
                 while (d2_neg < -180) d2_neg += 360; while (d2_neg > 180) d2_neg -= 360;
                 
                 if (Math.sign(d1_neg) !== Math.sign(d2_neg) && Math.abs(d1_neg - d2_neg) < 20) {
                    const fraction = (0 - d1_neg) / (d2_neg - d1_neg);
                    const timeMs = startTimeMs + (fraction * 86400000);
                    const timeStr = this.formatTime(new Date(timeMs));
                    events.push({ timeMs, text: `${timeStr} ${symbol} **${label}:** ${sym1} ${sym2} (${name1} & ${name2})` });
                 }
            }
        };

        checkCrossing(0, '☌', 'Conjunction');
        checkCrossing(180, '☍', 'Opposition');

        if (this.settings.showAstrology || this.settings.showDeepAstrology) {
            checkCrossing(120, '△', 'Trine');
            checkCrossing(90, '□', 'Square');
            checkCrossing(60, '⚹', 'Sextile');
        }

        if (this.settings.showDeepAstrology) {
            checkCrossing(30, '⚺', 'Semi-Sextile');
            checkCrossing(45, '∠', 'Semi-Square');
            checkCrossing(72, '⬠', 'Quintile');
            checkCrossing(135, '⚼', 'Sesquiquadrate');
            checkCrossing(144, 'bQ', 'Bi-Quintile');
        }
    }

    // --- MATH ENGINE (Bodies) ---
    private getBodyLongitude(date: Date, bodyId: string): number {
        const d = (date.getTime() / 86400000) - 10957.5; 
        
        if (bodyId === 'node') {
            let omega = 125.04452 - 0.0529535 * d;
            return (omega % 360 + 360) % 360;
        }

        if (bodyId === 'sun') {
             return this.getSunPosition(date).eclipticLongitude;
        }

        const rad = Math.PI / 180;
        const elems: any = {
            mercury: { N: 48.3313, i: 7.0047, w: 29.1241, a: 0.387098, e: 0.205635, M: 168.6562 + 4.0923344368 * d },
            venus:   { N: 76.6799, i: 3.3946, w: 54.8910, a: 0.723330, e: 0.006773, M: 48.0052 + 1.6021302244 * d },
            mars:    { N: 49.5574, i: 1.8497, w: 286.5016, a: 1.523688, e: 0.093405, M: 18.6021 + 0.5240207766 * d },
            jupiter: { N: 100.4542, i: 1.3030, w: 273.8777, a: 5.202561, e: 0.048498, M: 19.8950 + 0.0830853001 * d },
            saturn:  { N: 113.6634, i: 2.4886, w: 339.3939, a: 9.55475, e: 0.055546, M: 316.9670 + 0.0334442282 * d },
            uranus:  { N: 74.0005, i: 0.7733, w: 96.6612, a: 19.18171, e: 0.047318, M: 142.5905 + 0.011725806 * d },
            neptune: { N: 131.7806, i: 1.7700, w: 272.8461, a: 30.05826, e: 0.008606, M: 260.2471 + 0.005995147 * d },
            pluto:   { N: 110.30347, i: 17.14175, w: 224.06676, a: 39.48168677, e: 0.24880766, M: 14.882 + 0.00396 * d },
            chiron:  { N: 209.3, i: 6.9, w: 339.4, a: 13.67, e: 0.38, M: 339.6 + 0.019 * d } 
        };

        const p = elems[bodyId];
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

    private getMoonFullPos(date: Date, offsetDays: number = 0) {
        const t = new Date(date.getTime() + (offsetDays * 86400000));
        const d = (t.getTime() / 86400000) - 10957.5;
        const rad = Math.PI / 180;

        const L = (218.316 + 13.176396 * d) * rad;
        const M = (134.963 + 13.064993 * d) * rad;
        const F = (93.272 + 13.229350 * d) * rad;
        const D = (297.850 + 12.190749 * d) * rad; 
        const Ms = (357.529 + 0.98560028 * d) * rad;

        let l = L + 6.289 * rad * Math.sin(M);
        l += 1.274 * rad * Math.sin(2 * D - M);
        l += 0.658 * rad * Math.sin(2 * D);
        l += -0.185 * rad * Math.sin(Ms);
        l += -0.114 * rad * Math.sin(2 * F);

        let b = 5.128 * rad * Math.sin(F);
        b += 0.280 * rad * Math.sin(M + F);
        b += 0.278 * rad * Math.sin(M - F);
        b += 0.173 * rad * Math.sin(2 * D - F);

        let dist = 385000.56;
        dist += -20905.355 * Math.cos(M);
        dist += -3699.111 * Math.cos(2*D - M);
        dist += -2955.968 * Math.cos(2*D);

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

    private getSunPosition(date: Date) {
        const d = (date.getTime() / 86400000) - 10957.5;
        const rad = Math.PI / 180;
        const M = (357.529 + 0.98560028 * d) * rad;
        const L = (280.466 + 0.98564736 * d) * rad;
        const l = L + 1.915 * rad * Math.sin(M) + 0.020 * rad * Math.sin(2 * M);
        return { eclipticLongitude: l * (180 / Math.PI) };
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