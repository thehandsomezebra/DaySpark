import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';
import { resolveLocation } from '../utils';

export class PlanetProvider implements SparkProvider {
    id = 'planet-watch';
    displayName = 'Sky Watch';
    targetHeader = '## Sky Watch';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.planetHeader) this.targetHeader = this.settings.planetHeader;
    }

    async getDataForDate(targetDate: Date, fileContent?: string): Promise<ProviderResult> {
        if (!this.settings.enablePlanets) return { items: [] };

        // Resolve Location
        const location = await resolveLocation(this.settings, fileContent);

        const items: string[] = [];
        const noonDate = new Date(targetDate);
        noonDate.setHours(12, 0, 0, 0);

        // Get Sun times based on Resolved Location
        const sunTimes = this.getSunTimes(noonDate, location.lat, location.lng);
        const sunPos = this.getSunPosition(noonDate); 

        if (!sunTimes.rise || !sunTimes.set || !sunTimes.riseDate || !sunTimes.setDate) return { items: [] };

        const sunRise = sunTimes.riseDate.getTime();
        const sunSet = sunTimes.setDate.getTime();
        const sunRiseNext = sunRise + 24 * 60 * 60 * 1000;

        const planets = [
            { name: "Mercury", id: "mercury", symbol: "☿️" },
            { name: "Venus", id: "venus", symbol: "♀️" },
            { name: "Mars", id: "mars", symbol: "♂️" },
            { name: "Jupiter", id: "jupiter", symbol: "♃" },
            { name: "Saturn", id: "saturn", symbol: "♄" }
        ];

        for (const planet of planets) {
            const pPos = this.getPlanetPosition(noonDate, planet.id);
            const times = this.calcRiseSet(noonDate, location.lat, location.lng, pPos.ra, pPos.dec);
            
            if (!times.rise || !times.set || !times.riseDate || !times.setDate) continue;

            const elong = this.calculateElongation(pPos.eclipticLon, pPos.eclipticLat, sunPos.lon);
            if (elong < 10) { 
                items.push(`${planet.symbol} **${planet.name}:** Not visible (Too close to Sun)`);
                continue;
            }

            const pRise = times.riseDate.getTime();
            const pSet = times.setDate.getTime();
            let status = "";

            // Visibility Logic Buckets
            if (pSet > sunRiseNext) {
                if (pRise < sunSet + (60*60000)) { 
                    status = `Visible All Night`;
                } else {
                    status = `Visible Most of Night (Rises ${times.rise})`;
                }
            }
            else if (pSet > sunSet && pSet < sunRiseNext) {
                if (pRise < sunSet) {
                    status = `Visible until ${times.set}`;
                } else {
                    status = `Visible Tonight (Sets ${times.set})`;
                }
            }
            else if (pRise > sunSet && pRise < sunRiseNext) {
                status = `Visible in Morning (Rises ${times.rise})`;
            }
            else {
                status = `Not visible (Up during day)`;
            }

            const isHardRise = (Math.abs(pRise - sunRiseNext) < 90*60000); 
            const isHardSet = (Math.abs(pSet - sunSet) < 90*60000);
            
            if ((status.includes("Morning") && isHardRise) || (status.includes("until") && isHardSet)) {
                status += " (Difficult)";
            }

            items.push(`${planet.symbol} **${planet.name}:** ${status}`);
        }

        return { items };
    }

    // --- ASTRONOMY MATH (Keplerian Elements) ---

    private calculateElongation(pLon: number, pLat: number, sLon: number): number {
        const rad = Math.PI / 180;
        let dLon = (pLon - sLon);
        while (dLon < -180) dLon += 360;
        while (dLon > 180) dLon -= 360;
        const lat = pLat;
        return Math.acos(Math.cos(lat*rad) * Math.cos(dLon*rad)) * (180/Math.PI);
    }

    private getPlanetPosition(date: Date, planet: string) {
        const d = (date.getTime() / 86400000) - 10957.5; 
        const rad = Math.PI / 180;
        const elems: any = {
            mercury: { N: 48.3313, i: 7.0047, w: 29.1241, a: 0.387098, e: 0.205635, M: 168.6562 + 4.0923344368 * d },
            venus:   { N: 76.6799, i: 3.3946, w: 54.8910, a: 0.723330, e: 0.006773, M: 48.0052 + 1.6021302244 * d },
            mars:    { N: 49.5574, i: 1.8497, w: 286.5016, a: 1.523688, e: 0.093405, M: 18.6021 + 0.5240207766 * d },
            jupiter: { N: 100.4542, i: 1.3030, w: 273.8777, a: 5.202561, e: 0.048498, M: 19.8950 + 0.0830853001 * d },
            saturn:  { N: 113.6634, i: 2.4886, w: 339.3939, a: 9.55475, e: 0.055546, M: 316.9670 + 0.0334442282 * d }
        };
        const p = elems[planet];
        
        // 1. Eccentric Anomaly
        let E = p.M + (180/Math.PI) * p.e * Math.sin(p.M * rad) * (1 + p.e * Math.cos(p.M * rad));
        for(let j=0; j<5; j++) {
            const E_rad = E * rad;
            const M_calc = E - (180/Math.PI) * p.e * Math.sin(E_rad);
            E = E + (p.M - M_calc);
        }
        
        // 2. Heliocentric coordinates
        const xv = p.a * (Math.cos(E * rad) - p.e);
        const yv = p.a * Math.sqrt(1 - p.e*p.e) * Math.sin(E * rad);
        const r = Math.sqrt(xv*xv + yv*yv); 
        
        // 3. Heliocentric Ecliptic coordinates
        const xh = r * (Math.cos(p.N*rad) * Math.cos((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) - Math.sin(p.N*rad) * Math.sin((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) * Math.cos(p.i*rad));
        const yh = r * (Math.sin(p.N*rad) * Math.cos((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) + Math.cos(p.N*rad) * Math.sin((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) * Math.cos(p.i*rad));
        const zh = r * (Math.sin((p.w + Math.atan2(yv, xv) * (180/Math.PI))*rad) * Math.sin(p.i*rad));
        
        // 4. Earth Position
        const Me = 357.529 + 0.98560028 * d;
        const Le = 280.466 + 0.98564736 * d;
        const le = Le + 1.915 * Math.sin(Me*rad) + 0.020 * Math.sin(2*Me*rad);
        const Re = 1.00014 - 0.01671 * Math.cos(Me*rad) - 0.00014 * Math.cos(2*Me*rad);
        const xe = Re * Math.cos(le*rad);
        const ye = Re * Math.sin(le*rad);
        const ze = 0;
        
        // 5. Geocentric coordinates (Planet from Earth)
        const xg = xh + xe;
        const yg = yh + ye;
        const zg = zh + ze;
        
        // 6. Equatorial coordinates
        const obl = 23.439 * rad;
        const xeq = xg;
        const yeq = yg * Math.cos(obl) - zg * Math.sin(obl);
        const zeq = yg * Math.sin(obl) + zg * Math.cos(obl);
        
        const ra = Math.atan2(yeq, xeq);
        const dec = Math.atan2(zeq, Math.sqrt(xeq*xeq + yeq*yeq));
        const eclipticLon = Math.atan2(yg, xg) * (180/Math.PI);
        const eclipticLat = Math.atan2(zg, Math.sqrt(xg*xg + yg*yg)) * (180/Math.PI);
        
        return { ra, dec, eclipticLon, eclipticLat };
    }

    private calcRiseSet(date: Date, lat: number, lng: number, ra: number, dec: number): { rise: string | null, set: string | null, riseDate?: Date, setDate?: Date } {
        const rad = Math.PI / 180;
        const utcMidnight = new Date(date);
        utcMidnight.setUTCHours(0,0,0,0);
        
        const d0 = (utcMidnight.getTime() / 86400000) - 10957.5;
        const T = d0 / 36525.0;
        let GMST = 100.46061837 + 36000.770053608 * T;
        GMST = GMST % 360; 
        if (GMST < 0) GMST += 360;
        
        const h0 = -0.5667 * rad; 
        const cosH = (Math.sin(h0) - Math.sin(lat*rad) * Math.sin(dec)) / (Math.cos(lat*rad) * Math.cos(dec));
        
        if (cosH > 1 || cosH < -1) return { rise: null, set: null };
        const H_rad = Math.acos(cosH);
        const H_deg = H_rad * (180/Math.PI);
        
        const RA_deg = (ra * 180 / Math.PI + 360) % 360;
        const rate = 15.04107;
        
        let transit_UTC = (RA_deg - lng - GMST) / rate;
        while (transit_UTC < 0) transit_UTC += 24;
        while (transit_UTC >= 24) transit_UTC -= 24;
        
        const duration_half = H_deg / rate;
        let rise_UTC = transit_UTC - duration_half;
        let set_UTC = transit_UTC + duration_half;
        
        if (rise_UTC < 0) rise_UTC += 24;
        if (rise_UTC >= 24) rise_UTC -= 24;
        if (set_UTC < 0) set_UTC += 24;
        if (set_UTC >= 24) set_UTC -= 24;
        
        const riseDate = new Date(utcMidnight.getTime() + rise_UTC * 3600000);
        const setDate = new Date(utcMidnight.getTime() + set_UTC * 3600000);
        
        if (setDate < riseDate) {
            setDate.setDate(setDate.getDate() + 1);
        }

        return {
            rise: this.formatTime(riseDate),
            set: this.formatTime(setDate),
            riseDate, setDate
        };
    }

    private getSunPosition(date: Date) {
        const d = (date.getTime() / 86400000) - 10957.5;
        const rad = Math.PI / 180;
        const L = (280.466 + 0.98564736 * d) * rad;
        const g = (357.529 + 0.98560028 * d) * rad;
        const l = L + 1.915 * rad * Math.sin(g) + 0.020 * rad * Math.sin(2 * g);
        return { lon: l * (180/Math.PI) };
    }

    private getSunTimes(date: Date, lat: number, lng: number) {
        const d = (date.getTime() / 86400000) - 10957.5;
        const rad = Math.PI / 180;
        const L = (280.466 + 0.98564736 * d) * rad;
        const g = (357.529 + 0.98560028 * d) * rad;
        const l = L + 1.915 * rad * Math.sin(g) + 0.020 * rad * Math.sin(2 * g);
        
        const obl = 23.439 * rad;
        const ra = Math.atan2(Math.cos(obl) * Math.sin(l), Math.cos(l));
        const dec = Math.asin(Math.sin(obl) * Math.sin(l));
        
        return this.calcRiseSet(date, lat, lng, ra, dec);
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
}