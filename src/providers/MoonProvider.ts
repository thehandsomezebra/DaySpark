import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';
import { resolveLocation } from '../utils';
import { 
    AstroTime, 
    Body, 
    Illumination, 
    SearchRiseSet, 
    Observer,
    Constellation,
    MoonPhase,
    Equator,
    SearchMoonQuarter
} from 'astronomy-engine';

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

        const location = await resolveLocation(this.settings, fileContent);
        const observer = new Observer(location.lat, location.lng, 0);
        
        // 1. Midnight calculations for Daily Position (Local Midnight)
        const midnight = new Date(targetDate);
        midnight.setHours(0, 0, 0, 0);
        const timeMidnight = new AstroTime(midnight);

        // 2. Noon calculations for Phase and Illumination
        const noon = new Date(targetDate);
        noon.setHours(12, 0, 0, 0);
        const timeNoon = new AstroTime(noon);
        
        // MoonPhase returns 0..360 (0=New, 180=Full)
        const phaseAngle = MoonPhase(timeNoon);
        const phaseInfo = this.getPhaseInfo(phaseAngle);
        
        // Illumination provides the fraction (0.0 to 1.0)
        const illum = Illumination(Body.Moon as any, timeNoon);

        const items: string[] = [
            `${phaseInfo.emoji} **Phase:** ${phaseInfo.name} (${Math.round(illum.phase_fraction * 100)}%)`
        ];

        // 3. Conditional: Astronomical Position
        if (this.settings.enableMoonPosition) {
            // Fetch equatorial coordinates to find the constellation correctly
            const equator = Equator(Body.Moon as any, timeMidnight, observer, true, true);
            const constel = Constellation(equator.ra, equator.dec);
            const zodiacEmoji = this.getZodiacEmoji(constel.name);
            items.push(`**Astronomical Position:** ${zodiacEmoji} ${constel.name}`);
        }

        // 4. Conditional: Moon Age (Calendar Days since New Moon)
        if (this.settings.enableMoonAge) {
            const age = this.calculateMoonAge(targetDate);
            items.push(`**Moon Age:** ${age} days`);
        }

        // 5. Rise/Set (Local) - ONLY IF TOGGLE IS ENABLED
        if (this.settings.enableMoonTimes) {
            // We search from local midnight. 
            const riseEvent = SearchRiseSet(Body.Moon as any, observer, +1, midnight, 1);
            const setEvent = SearchRiseSet(Body.Moon as any, observer, -1, midnight, 1);

            const riseDate = this.extractDate(riseEvent);
            const setDate = this.extractDate(setEvent);

            // Filter events to only those that occur on the target calendar date
            const events = [
                { label: 'Rise', icon: '🌙', date: riseDate && riseDate.getDate() === targetDate.getDate() ? riseDate : null },
                { label: 'Set', icon: '📉', date: setDate && setDate.getDate() === targetDate.getDate() ? setDate : null }
            ];

            // Sort events chronologically. Events that don't happen today (null date) are moved to the end.
            events.sort((a, b) => {
                if (a.date && b.date) return a.date.getTime() - b.date.getTime();
                if (a.date) return -1;
                if (b.date) return 1;
                return 0;
            });

            // Add formatted Rise/Set items in chronological order
            for (const e of events) {
                if (e.date) {
                    const timeStr = this.formatTime(e.date);
                    items.push(`${e.icon} **${e.label}:** ${timeStr}`);
                }
            }
        }

        return { items };
    }

    /**
     * Safely extracts a Date object from the various return types of astronomy-engine.
     */
    private extractDate(event: any): Date | null {
        if (!event) return null;
        if (event instanceof Date) return event;
        if (event.date instanceof Date) return event.date;
        if (event.time && event.time.date instanceof Date) return event.time.date;
        return null;
    }

    /**
     * Calculates the age of the moon in whole calendar days.
     * The day of the New Moon (Day 0) is the foundation.
     */
    private calculateMoonAge(targetDate: Date): number {
        // Search back ~40 days to ensure we find the start of the current cycle
        let searchTime = new AstroTime(new Date(targetDate.getTime() - 40 * 86400000));
        let lastNewMoonDate: Date | null = null;
        
        // Find the New Moon (quarter 0) that most closely precedes targetDate
        for (let i = 0; i < 10; i++) {
            const q = SearchMoonQuarter(searchTime);
            const qDate = q.time.date;
            
            if (qDate > targetDate) break;
            
            if (q.quarter === 0) {
                lastNewMoonDate = qDate;
            }
            // Step forward past the current quarter to find the next one
            searchTime = new AstroTime(new Date(qDate.getTime() + 86400000));
        }

        if (!lastNewMoonDate) return 0;

        // Reset both to midnight local time for calendar day comparison
        const d1 = new Date(lastNewMoonDate);
        d1.setHours(0, 0, 0, 0);
        
        const d2 = new Date(targetDate);
        d2.setHours(0, 0, 0, 0);
        
        const diffMs = d2.getTime() - d1.getTime();
        return Math.floor(diffMs / 86400000);
    }

    private getPhaseInfo(angle: number) {
        let a = angle % 360;
        if (a < 0) a += 360;

        if (a < 22.5 || a > 337.5) return { name: "New Moon", emoji: "🌑" };
        if (a < 67.5) return { name: "Waxing Crescent", emoji: "🌒" };
        if (a < 112.5) return { name: "First Quarter", emoji: "🌓" };
        if (a < 157.5) return { name: "Waxing Gibbous", emoji: "🌔" };
        if (a < 202.5) return { name: "Full Moon", emoji: "🌕" };
        if (a < 247.5) return { name: "Waning Gibbous", emoji: "🌖" };
        if (a < 292.5) return { name: "Third Quarter", emoji: "🌗" };
        if (a < 337.5) return { name: "Waning Crescent", emoji: "🌘" };
        
        return { name: "New Moon", emoji: "🌑" };
    }

    private getZodiacEmoji(name: string): string {
        const emojis: Record<string, string> = {
            "Aries": "♈", "Taurus": "♉", "Gemini": "♊", "Cancer": "♋", 
            "Leo": "♌", "Virgo": "♍", "Libra": "♎", "Scorpius": "♏", 
            "Sagittarius": "♐", "Capricornus": "♑", "Aquarius": "♒", "Pisces": "♓",
            "Ophiuchus": "⛎", "Cetus": "🐋", "Orion": "🏹"
        };
        return emojis[name] || "✨";
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