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
    enableMoonTimes: boolean; 
    enableMoonAge: boolean;
    enableMoonPosition: boolean;
    moonHeader: string;

    // Sun Settings
    enableSun: boolean;
    sunHeader: string;
    latitude: number;
    longitude: number;
    use24HourFormat: boolean;

    // Almanac Settings
    enableAlmanac: boolean;
    almanacHeader: string;

    // Planet Settings
    enablePlanets: boolean;
    planetHeader: string;

    // Season Settings
    enableSeasons: boolean;
    seasonsHeader: string;
    enableMeteorologicalSeasons: boolean;
    enableCrossQuarterDays: boolean;

    // Weather Settings
    enableWeather: boolean;
    weatherHeader: string;
    useMetric: boolean;

    // History Settings
    enableHistory: boolean;
    historyHeader: string;
    historyLimit: number;

    // Celestial Events Settings
    enableCelestialEvents: boolean; 
    celestialHeader: string;
    enableBasicEvents: boolean;      
    enableMeteorShowers: boolean;    
    enableAdvancedAstronomy: boolean; 

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
    enableMoonTimes: true, 
    enableMoonAge: true,
    enableMoonPosition: true,
    moonHeader: '## Moon Phase',
    enableSun: true,
    sunHeader: '## Daily Context',
    latitude: 40.7128, 
    longitude: -74.0060,
    use24HourFormat: false,
    enableAlmanac: true,
    almanacHeader: '## Almanac Lore',
    enablePlanets: true,
    planetHeader: '## Sky Watch',
    enableSeasons: true,
    seasonsHeader: '## Seasons',
    enableMeteorologicalSeasons: false,
    enableCrossQuarterDays: true, // Defaulted to on for Almanac accuracy
    enableWeather: true,
    weatherHeader: '## Weather',
    useMetric: false,
    enableHistory: true, 
    historyHeader: '## On This Day',
    historyLimit: 5,
    replaceContext: true,
    
    enableCelestialEvents: true,
    celestialHeader: '## Celestial Events',
    enableBasicEvents: false,
    enableMeteorShowers: true,
    enableAdvancedAstronomy: false
};