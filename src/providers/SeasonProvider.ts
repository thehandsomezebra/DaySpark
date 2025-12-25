import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';

export class SeasonProvider implements SparkProvider {
    id = 'season-events';
    displayName = 'Seasons';
    targetHeader = '## Daily Context'; // Defaults to same as Sun
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
    }

    async getDataForDate(targetDate: Date): Promise<ProviderResult> {
        if (!this.settings.enableSeasons) return { items: [] };

        const year = targetDate.getFullYear();
        const events = this.getSeasonEvents(year);
        
        // Normalize target date to compare just the day
        const targetDay = new Date(targetDate);
        targetDay.setHours(0,0,0,0);

        const items: string[] = [];

        for (const event of events) {
            // Check if event occurs on this day in local time
            // We create a date object from the event timestamp
            const eventDate = new Date(event.time);
            const eventDay = new Date(eventDate);
            eventDay.setHours(0,0,0,0);

            if (eventDay.getTime() === targetDay.getTime()) {
                const timeStr = this.formatTime(eventDate);
                items.push(`🌸 **${event.name}:** ${timeStr}`);
            }
        }

        return { items };
    }

    // --- ASTRONOMICAL ALGORITHMS (Meeus) ---
    // Returns approximate times for Equinoxes/Solstices
    private getSeasonEvents(year: number) {
        const events = [];
        
        // JDE Factors for each event (Meeus Ch 27)
        // 0 = March Equinox, 1 = June Solstice, 2 = Sept Equinox, 3 = Dec Solstice
        const Y = (year - 2000) / 1000;
        const Y2 = Y * Y;
        const Y3 = Y2 * Y;
        const Y4 = Y3 * Y;

        // March Equinox
        const jde0 = 2451623.80984 + 365242.37404 * Y + 0.05169 * Y2 - 0.00411 * Y3 - 0.00057 * Y4;
        events.push({ name: "Vernal Equinox", time: this.jdeToDate(jde0) });

        // June Solstice
        const jde1 = 2451716.56767 + 365241.62603 * Y + 0.00325 * Y2 + 0.00888 * Y3 - 0.00030 * Y4;
        events.push({ name: "Summer Solstice", time: this.jdeToDate(jde1) });

        // Sept Equinox
        const jde2 = 2451810.21715 + 365242.01767 * Y - 0.11575 * Y2 + 0.00337 * Y3 + 0.00078 * Y4;
        events.push({ name: "Autumnal Equinox", time: this.jdeToDate(jde2) });

        // Dec Solstice
        const jde3 = 2451900.05952 + 365242.74049 * Y - 0.06223 * Y2 - 0.00823 * Y3 + 0.00032 * Y4;
        events.push({ name: "Winter Solstice", time: this.jdeToDate(jde3) });

        return events;
    }

    private jdeToDate(jde: number): Date {
        // Convert Julian Ephemeris Date to JS Date
        // (Approximate, ignoring Delta T which is ~1 min error, acceptable for almanac)
        const z = Math.floor(jde + 0.5);
        const f = (jde + 0.5) - z;
        
        let alpha = Math.floor((z - 1867216.25) / 36524.25);
        let a = z + 1 + alpha - Math.floor(alpha / 4);
        let b = a + 1524;
        let c = Math.floor((b - 122.1) / 365.25);
        let d = Math.floor(365.25 * c);
        let e = Math.floor((b - d) / 30.6001);
        
        const day = b - d - Math.floor(30.6001 * e) + f;
        const month = e < 14 ? e - 1 : e - 13;
        const year = month > 2 ? c - 4716 : c - 4715;

        // Extract time from fractional day
        const dayInt = Math.floor(day);
        const dayFrac = day - dayInt;
        const hoursTotal = dayFrac * 24;
        const hours = Math.floor(hoursTotal);
        const minutesTotal = (hoursTotal - hours) * 60;
        const minutes = Math.floor(minutesTotal);
        
        // Create Date object in UTC
        const date = new Date(Date.UTC(year, month - 1, dayInt, hours, minutes));
        return date;
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