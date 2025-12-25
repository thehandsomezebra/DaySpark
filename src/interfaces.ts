import { Plugin } from 'obsidian';

export interface ProviderResult {
    items: string[];
    rawContext?: any;
}

export interface SparkProvider {
    id: string;
    displayName: string;
    targetHeader: string;
    getDataForDate(date: Date, fileContent?: string): Promise<ProviderResult>;
}

export interface CalendarGroup {
    id: string;
    name: string;
    enabled: boolean;
    header: string;
    urls: string[];
    showDescription: boolean;
}

export interface DaySparkSettings {
    calendarGroups: CalendarGroup[];

    // Moon Settings
    enableMoon: boolean;
    moonHeader: string;

    // Sun Settings
    enableSun: boolean;
    sunHeader: string;
    // Location Settings
    latitude: number;
    longitude: number;
    // defaultLocationName REMOVED - Auto-calculated now
    use24HourFormat: boolean;

    // Almanac Settings
    enableAlmanac: boolean;
    almanacHeader: string;

    // Planet Settings
    enablePlanets: boolean;
    planetHeader: string;

    // Season Settings
    enableSeasons: boolean;

    // Weather Settings
    enableWeather: boolean;
    weatherHeader: string;
    useMetric: boolean;

    // General Behavior
    replaceContext: boolean;
}

export const DEFAULT_SETTINGS: DaySparkSettings = {
    calendarGroups: [
        {
            id: 'default',
            name: 'Main Calendar',
            enabled: true,
            header: '## Agenda',
            urls: [],
            showDescription: true
        }
    ],
    enableMoon: true,
    moonHeader: '## Moon Phase',
    enableSun: true,
    sunHeader: '## Daily Context',
    latitude: 40.7128, 
    longitude: -74.0060,
    use24HourFormat: false,
    enableAlmanac: true,
    almanacHeader: '## Almanac',
    enablePlanets: true,
    planetHeader: '## Sky Watch',
    enableSeasons: true,
    enableWeather: true,
    weatherHeader: '## Weather',
    useMetric: false,
    replaceContext: true
};