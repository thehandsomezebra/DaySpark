import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';
import { requestUrl, Notice } from 'obsidian';

export class WeatherProvider implements SparkProvider {
    id = 'weather-context';
    displayName = 'Weather';
    targetHeader = '## Weather';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.weatherHeader) this.targetHeader = this.settings.weatherHeader;
    }

    async getDataForDate(targetDate: Date): Promise<ProviderResult> {
        if (!this.settings.enableWeather) return { items: [] };

        // 1. Determine Date & API Strategy
        // Open-Meteo requires YYYY-MM-DD
        const dateStr = this.formatDateISO(targetDate);
        
        // Strategy:
        // Future/Today/Recent Past (last 5 days) -> Forecast API
        // Older Past -> Archive API
        const now = new Date();
        const diffTime = targetDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const isArchive = diffDays < -5;

        // 2. Build URL
        const lat = this.settings.latitude;
        const lng = this.settings.longitude;
        const unitTemp = this.settings.useMetric ? 'celsius' : 'fahrenheit';
        const unitWind = this.settings.useMetric ? 'kmh' : 'mph';
        
        let url = "";
        
        if (isArchive) {
            // Historical Data
            url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant&temperature_unit=${unitTemp}&wind_speed_unit=${unitWind}&timezone=auto`;
        } else {
            // Forecast (includes recent past)
            // Note: We might need 'past_days' if target is yesterday, but supplying start/end date usually works for forecast range
            url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant&temperature_unit=${unitTemp}&wind_speed_unit=${unitWind}&timezone=auto`;
        }

        console.log(`DaySpark Weather: Fetching (${isArchive ? 'Archive' : 'Forecast'})`, url);

        try {
            const response = await requestUrl({ url: url });
            const data = response.json;

            if (!data || !data.daily || !data.daily.time || data.daily.time.length === 0) {
                console.warn("DaySpark: No weather data found.");
                return { items: [] };
            }

            // 3. Extract Data (First index is the target day)
            const i = 0;
            const high = Math.round(data.daily.temperature_2m_max[i]);
            const low = Math.round(data.daily.temperature_2m_min[i]);
            const code = data.daily.weather_code[i];
            const windSpeed = Math.round(data.daily.wind_speed_10m_max[i]);
            const windDirDeg = data.daily.wind_direction_10m_dominant[i];

            // 4. Format Output
            const wmo = this.getWmoInfo(code);
            const windDir = this.degreesToDirection(windDirDeg);
            const tempUnit = this.settings.useMetric ? '°C' : '°F';
            const windUnit = this.settings.useMetric ? 'km/h' : 'mph';

            const weatherLine = `${wmo.emoji} **${wmo.label}:** High ${high}${tempUnit} / Low ${low}${tempUnit}`;
            const windLine = `💨 **Wind:** ${windSpeed} ${windUnit} ${windDir}`;

            return {
                items: [weatherLine, windLine]
            };

        } catch (err) {
            console.error("DaySpark: Weather API Error", err);
            // new Notice("DaySpark: Could not fetch weather."); // Optional: Don't spam user on fail
            return { items: [] };
        }
    }

    private formatDateISO(date: Date): string {
        // Returns YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private degreesToDirection(degrees: number): string {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        // Split 360 into 16 slices (22.5 deg each). Offset by half slice (11.25) to center N.
        const val = Math.floor((degrees / 22.5) + 0.5);
        return directions[val % 16];
    }

    private getWmoInfo(code: number): { label: string, emoji: string } {
        // WMO Weather interpretation codes (WW)
        const codes: { [key: number]: { label: string, emoji: string } } = {
            0: { label: 'Clear Sky', emoji: '☀️' },
            1: { label: 'Mainly Clear', emoji: '🌤️' },
            2: { label: 'Partly Cloudy', emoji: '⛅' },
            3: { label: 'Overcast', emoji: '☁️' },
            45: { label: 'Fog', emoji: '🌫️' },
            48: { label: 'Depositing Rime Fog', emoji: '🌫️' },
            51: { label: 'Light Drizzle', emoji: '🌦️' },
            53: { label: 'Moderate Drizzle', emoji: '🌦️' },
            55: { label: 'Dense Drizzle', emoji: '🌧️' },
            56: { label: 'Light Freezing Drizzle', emoji: '🌨️' },
            57: { label: 'Dense Freezing Drizzle', emoji: '🌨️' },
            61: { label: 'Slight Rain', emoji: '🌧️' },
            63: { label: 'Moderate Rain', emoji: '🌧️' },
            65: { label: 'Heavy Rain', emoji: '🌧️' },
            66: { label: 'Light Freezing Rain', emoji: '🌨️' },
            67: { label: 'Heavy Freezing Rain', emoji: '🌨️' },
            71: { label: 'Slight Snow Fall', emoji: '❄️' },
            73: { label: 'Moderate Snow Fall', emoji: '❄️' },
            75: { label: 'Heavy Snow Fall', emoji: '❄️' },
            77: { label: 'Snow Grains', emoji: '❄️' },
            80: { label: 'Slight Rain Showers', emoji: '🌦️' },
            81: { label: 'Moderate Rain Showers', emoji: '🌦️' },
            82: { label: 'Violent Rain Showers', emoji: '⛈️' },
            85: { label: 'Slight Snow Showers', emoji: '🌨️' },
            86: { label: 'Heavy Snow Showers', emoji: '🌨️' },
            95: { label: 'Thunderstorm', emoji: '⚡' },
            96: { label: 'Thunderstorm with Slight Hail', emoji: '⛈️' },
            99: { label: 'Thunderstorm with Heavy Hail', emoji: '⛈️' }
        };

        return codes[code] || { label: 'Unknown', emoji: '❓' };
    }
}