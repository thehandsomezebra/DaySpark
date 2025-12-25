import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';

export class SunProvider implements SparkProvider {
    id = 'sun-times';
    displayName = 'Sun Times';
    targetHeader = '## Daily Context';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.sunHeader) this.targetHeader = this.settings.sunHeader;
    }

    async getDataForDate(targetDate: Date): Promise<ProviderResult> {
        if (!this.settings.enableSun) return { items: [] };

        // Check if lat/long are roughly valid
        if (this.settings.latitude === 0 && this.settings.longitude === 0) {
             return { items: ["_Sun Times: Please set Latitude/Longitude in DaySpark settings._"] };
        }

        const times = this.getSunTimes(targetDate, this.settings.latitude, this.settings.longitude);
        
        if (!times) return { items: [] };

        return {
            items: [
                `🌅 **Sunrise:** ${times.sunrise}`,
                `🌇 **Sunset:** ${times.sunset}`
            ]
        };
    }

    // --- ASTRONOMICAL MATH (Sunrise Equation) ---
    private getSunTimes(date: Date, lat: number, lng: number) {
        // 1. Calculate Day of Year (N)
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);

        // 2. Convert Longitude to Hour Value (lngHour)
        const lngHour = lng / 15;

        // Calculate Timezone Offset based on the TARGET DATE
        const offsetMinutes = date.getTimezoneOffset();
        const localOffsetHours = -offsetMinutes / 60;

        // 3. Calculate Rise/Set
        const sunrise = this.calculateTime(dayOfYear, lat, lngHour, true, localOffsetHours);
        const sunset = this.calculateTime(dayOfYear, lat, lngHour, false, localOffsetHours);

        return {
            sunrise: this.formatTime(sunrise),
            sunset: this.formatTime(sunset)
        };
    }

    private calculateTime(N: number, lat: number, lngHour: number, isSunrise: boolean, localOffsetHours: number) {
        const t = N + ((isSunrise ? 6 : 18) - lngHour) / 24;
        const M = (0.9856 * t) - 3.289;
        
        let L = M + (1.916 * Math.sin(this.degToRad(M))) + (0.020 * Math.sin(this.degToRad(2 * M))) + 282.634;
        if (L > 360) L = L - 360;
        else if (L < 0) L = L + 360;

        let RA = this.radToDeg(Math.atan(0.91764 * Math.tan(this.degToRad(L))));
        if (RA > 360) RA = RA - 360;
        else if (RA < 0) RA = RA + 360;

        const Lquadrant = (Math.floor(L / 90)) * 90;
        const RAquadrant = (Math.floor(RA / 90)) * 90;
        RA = RA + (Lquadrant - RAquadrant);
        RA = RA / 15;

        const sinDec = 0.39782 * Math.sin(this.degToRad(L));
        const cosDec = Math.cos(Math.asin(sinDec));

        const zenith = 90.833;
        const cosH = (Math.cos(this.degToRad(zenith)) - (sinDec * Math.sin(this.degToRad(lat)))) / (cosDec * Math.cos(this.degToRad(lat)));

        if (cosH > 1) return null;
        if (cosH < -1) return null;

        let H;
        if (isSunrise) {
            H = 360 - this.radToDeg(Math.acos(cosH));
        } else {
            H = this.radToDeg(Math.acos(cosH));
        }
        H = H / 15;

        const T = H + RA - (0.06571 * t) - 6.622;
        let UT = T - lngHour;
        if (UT > 24) UT = UT - 24;
        else if (UT < 0) UT = UT + 24;

        let localT = UT + localOffsetHours;
        
        if (localT >= 24) localT -= 24;
        if (localT < 0) localT += 24;

        return localT;
    }

    private formatTime(decimalTime: number | null): string {
        if (decimalTime === null) return "--:--";
        const hours = Math.floor(decimalTime);
        const minutesDecimal = (decimalTime - hours) * 60;
        const minutes = Math.floor(minutesDecimal);
        const seconds = Math.floor((minutesDecimal - minutes) * 60);
        
        const mStr = minutes < 10 ? '0' + minutes : minutes;
        const sStr = seconds < 10 ? '0' + seconds : seconds;

        // CHANGED: Respect 24-hour setting
        if (this.settings.use24HourFormat) {
            const hStr = hours < 10 ? '0' + hours : hours;
            return `${hStr}:${mStr}:${sStr}`;
        } else {
            const period = hours >= 12 ? 'PM' : 'AM';
            const h12 = hours % 12 || 12;
            return `${h12}:${mStr}:${sStr} ${period}`;
        }
    }

    private degToRad(deg: number) { return deg * Math.PI / 180; }
    private radToDeg(rad: number) { return rad * 180 / Math.PI; }
}