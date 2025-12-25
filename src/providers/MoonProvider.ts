import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';
import { resolveLocation } from '../utils';

export class MoonProvider implements SparkProvider {
    id = 'moon-phase';
    displayName = 'Moon Phase';
    targetHeader = '## Moon Phase';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.moonHeader) this.targetHeader = this.settings.moonHeader;
    }

    async getDataForDate(targetDate: Date, fileContent?: string): Promise<ProviderResult> {
        if (!this.settings.enableMoon) return { items: [] };

        // Resolve Location (Dynamic or Default)
        const location = await resolveLocation(this.settings, fileContent);

        // 1. MATCH ALMANAC POSITION: Calculate Constellation at UTC MIDNIGHT
        // Switching to UTC Midnight (00:00 UTC) aligns with standard astronomical almanacs.
        const utcMidnightDate = new Date(targetDate);
        utcMidnightDate.setUTCHours(0, 0, 0, 0);

        const moonPosMidnight = this.getMoonPosition(utcMidnightDate, location.lat, location.lng);
        
        // IAU Constellation boundaries (J2000 Tropical)
        const zodiac = this.getAstronomicalConstellation(moonPosMidnight.eclipticLongitude, moonPosMidnight.eclipticLatitude);
        
        // 2. PHASE (Noon - for visual percentage)
        const noonDate = new Date(targetDate);
        noonDate.setHours(12, 0, 0, 0);
        const moonPosNoon = this.getMoonPosition(noonDate, location.lat, location.lng);
        const sunPosNoon = this.getSunPosition(noonDate);
        const phaseData = this.calculatePhase(moonPosNoon.eclipticLongitude, sunPosNoon.eclipticLongitude);
        
        // 3. MATCH ALMANAC AGE: Calendar Day Difference
        // Find the date of the previous New Moon and count days elapsed on the calendar.
        const prevNewMoonDate = this.findPreviousNewMoon(noonDate);
        const age = this.getCalendarDayDifference(prevNewMoonDate, utcMidnightDate);

        // 4. Rise/Set (Local)
        const times = this.getMoonTimes(targetDate, location.lat, location.lng);

        const items = [
            `${phaseData.emoji} **Phase:** ${phaseData.name} (${phaseData.illumination}%)`,
            `**Astronomical Position:** ${zodiac.symbol} ${zodiac.name}`,
            `**Moon Age:** ${age} days`
        ];

        if (times.rise) items.push(`🌙 **Rise:** ${times.rise}`);
        if (times.set) items.push(`📉 **Set:** ${times.set}`);

        return { items };
    }

    // --- ALMANAC AGE LOGIC ---
    
    private findPreviousNewMoon(startDate: Date): Date {
        // Iteratively find the exact time of New Moon (Elongation = 0)
        let t = new Date(startDate.getTime());
        
        for (let i = 0; i < 5; i++) { // usually converges in 2-3 steps
            const moonPos = this.getMoonPosition(t, 0, 0); // Lat/Long don't matter for geocentric phase
            const sunPos = this.getSunPosition(t);
            
            // Calculate elongation difference from 0
            let diff = moonPos.eclipticLongitude - sunPos.eclipticLongitude;
            // Normalize to -180 to 180
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            
            // Force it to look backwards if we are "ahead" of the sun
            if (i === 0 && diff < 0) diff += 360; 

            const daysCorrection = diff / 12.1907;
            t = new Date(t.getTime() - (daysCorrection * 86400000));
            
            if (Math.abs(daysCorrection) < 0.001) break; // Precision < 1 minute
        }
        return t;
    }

    private getCalendarDayDifference(d1: Date, d2: Date): number {
        // Create new date objects to avoid mutating
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        
        // Reset to local midnight to compare strictly by calendar day
        date1.setHours(0,0,0,0);
        date2.setHours(0,0,0,0);
        
        const diffMs = date2.getTime() - date1.getTime();
        return Math.round(diffMs / 86400000);
    }

    // --- HIGH PRECISION ASTRONOMY (Meeus truncated) ---

    private getMoonPosition(date: Date, lat: number, lng: number) {
        const d = (date.getTime() / 86400000) - 10957.5; // Days since J2000
        const rad = Math.PI / 180;

        // Mean elements
        const L = (218.316 + 13.176396 * d) * rad;
        const M = (134.963 + 13.064993 * d) * rad;
        const F = (93.272 + 13.229350 * d) * rad;
        const D = (297.850 + 12.190749 * d) * rad; 
        const Ms = (357.529 + 0.98560028 * d) * rad;

        // Perturbations
        let l = L + 6.289 * rad * Math.sin(M);
        l += 1.274 * rad * Math.sin(2 * D - M);
        l += 0.658 * rad * Math.sin(2 * D);
        l += -0.185 * rad * Math.sin(Ms);
        l += -0.114 * rad * Math.sin(2 * F);

        let b = 5.128 * rad * Math.sin(F);
        b += 0.280 * rad * Math.sin(M + F);
        b += 0.278 * rad * Math.sin(M - F);
        b += 0.173 * rad * Math.sin(2 * D - F);

        const obl = 23.439 * rad;
        const sinDec = Math.sin(b) * Math.cos(obl) + Math.cos(b) * Math.sin(obl) * Math.sin(l);
        const cosDec = Math.sqrt(1 - sinDec * sinDec);
        const sinRA = (Math.cos(b) * Math.sin(l) * Math.cos(obl) - Math.sin(b) * Math.sin(obl)) / cosDec;
        const cosRA = Math.cos(b) * Math.cos(l) / cosDec;
        const RA = Math.atan2(sinRA, cosRA);

        return {
            eclipticLongitude: l * (180 / Math.PI),
            eclipticLatitude: b * (180 / Math.PI),
            ra: RA,
            dec: Math.asin(sinDec)
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

    private calculatePhase(moonLon: number, sunLon: number) {
        let elongation = moonLon - sunLon;
        elongation = elongation % 360;
        if (elongation < 0) elongation += 360;

        const phasePct = (1 - Math.cos(elongation * (Math.PI / 180))) / 2;
        const segment = Math.round((elongation / 360) * 8) % 8;
        
        const phases = [
            { name: "New Moon", emoji: "🌑" },
            { name: "Waxing Crescent", emoji: "🌒" },
            { name: "First Quarter", emoji: "🌓" },
            { name: "Waxing Gibbous", emoji: "🌔" },
            { name: "Full Moon", emoji: "🌕" },
            { name: "Waning Gibbous", emoji: "🌖" },
            { name: "Third Quarter", emoji: "🌗" },
            { name: "Waning Crescent", emoji: "🌘" }
        ];

        return {
            name: phases[segment].name,
            emoji: phases[segment].emoji,
            illumination: Math.round(phasePct * 100)
        };
    }

    // --- CONSTELLATION MAPPING ---
    private getAstronomicalConstellation(lon: number, lat: number) {
        let l = lon % 360;
        if (l < 0) l += 360;

        // 1. CHECK "INTRUDERS" (Almanac specifics)
        if (l >= 5 && l <= 25 && lat < -3.5) return { name: "Cetus", symbol: "🐋" };
        if (l >= 84 && l <= 91 && lat < -0.5) return { name: "Orion", symbol: "🏹" };
        if (l >= 80 && l <= 95 && lat > 4.5) return { name: "Auriga", symbol: "🐐" };
        if (l >= 143 && l <= 155 && lat < -2.5) return { name: "Sextans", symbol: "🧭" };

        // 2. CHECK STANDARD ZODIAC (IAU Boundaries)
        if (l >= 351.5 || l < 29.0) return { name: "Pisces", symbol: "♓" };
        if (l < 53.5)  return { name: "Aries", symbol: "♈" };
        if (l < 90.0)  return { name: "Taurus", symbol: "♉" };
        if (l < 118.0) return { name: "Gemini", symbol: "♊" };
        if (l < 138.0) return { name: "Cancer", symbol: "♋" };
        if (l < 174.0) return { name: "Leo", symbol: "♌" };
        if (l < 218.0) return { name: "Virgo", symbol: "♍" };
        if (l < 241.0) return { name: "Libra", symbol: "♎" };
        if (l < 248.0) return { name: "Scorpius", symbol: "♏" };
        if (l < 266.0) return { name: "Ophiuchus", symbol: "⛎" };
        if (l < 299.5) return { name: "Sagittarius", symbol: "♐" };
        if (l < 327.5) return { name: "Capricornus", symbol: "♑" };
        if (l < 351.5) return { name: "Aquarius", symbol: "♒" };

        return { name: "Unknown", symbol: "✨" };
    }

    private getMoonTimes(date: Date, lat: number, lng: number) {
        if (lat === 0 && lng === 0) return { rise: null, set: null };

        let riseTime = null;
        let setTime = null;
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0,0,0,0);
        
        const h0 = 0.125 * Math.PI / 180; 

        const getAlt = (t: Date) => {
            const pos = this.getMoonPosition(t, lat, lng);
            const d = (t.getTime() / 86400000) - 10957.5;
            
            const GMST_hours = 18.697374558 + 24.06570982441908 * d;
            const GMST_rad = (GMST_hours * 15 * (Math.PI/180)) % (2 * Math.PI);
            const LST = GMST_rad + (lng * (Math.PI/180));
            const HA = LST - pos.ra;

            const sinAlt = Math.sin(lat * (Math.PI/180)) * Math.sin(pos.dec) + Math.cos(lat * (Math.PI/180)) * Math.cos(pos.dec) * Math.cos(HA);
            return Math.asin(sinAlt) - h0;
        };

        let prevAlt = getAlt(startOfDay);
        
        for (let i = 1; i <= 180; i++) {
            const time = new Date(startOfDay.getTime() + (i * 10 * 60 * 1000));
            const alt = getAlt(time);

            if (prevAlt < 0 && alt >= 0 && !riseTime) {
                riseTime = this.formatTime(time);
            }
            if (prevAlt > 0 && alt <= 0 && !setTime) {
                setTime = this.formatTime(time);
            }
            prevAlt = alt;
        }

        return { rise: riseTime, set: setTime };
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