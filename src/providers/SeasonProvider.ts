import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';

export class SeasonProvider implements SparkProvider {
    id = 'seasons';
    displayName = 'Seasons';
    targetHeader = '## Seasons';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.seasonsHeader) this.targetHeader = this.settings.seasonsHeader;
    }

    getDataForDate(targetDate: Date): Promise<ProviderResult> {
        if (!this.settings.enableSeasons) return Promise.resolve({ items: [] });

        const month = targetDate.getMonth(); // 0-indexed
        const day = targetDate.getDate();
        const items: string[] = [];

        // 1. Astronomical Seasons (Equinoxes and Solstices - Default)
        if (month === 2 && day === 20) items.push("✨ **Spring Equinox** (Astronomical Spring begins)");
        if (month === 5 && day === 21) items.push("☀️ **Summer Solstice** (Astronomical Summer begins)");
        if (month === 8 && day === 22) items.push("🍂 **Autumnal Equinox** (Astronomical Fall begins)");
        if (month === 11 && day === 21) items.push("❄️ **Winter Solstice** (Astronomical Winter begins)");

        // 2. Cross-Quarter Days (Mid-season markers common in Almanacs)
        if (this.settings.enableCrossQuarterDays) {
            if (month === 1 && (day === 1 || day === 2)) items.push("🌱 **Imbolc** (Mid-Winter / First Stirrings of Spring)");
            if (month === 4 && day === 1) items.push("🌸 **Beltane** (Mid-Spring / First of May)");
            if (month === 7 && day === 1) items.push("🌾 **Lammas** (Mid-Summer / First Harvest)");
            if (month === 10 && day === 1) items.push("🎃 **Samhain** (Mid-Autumn / Final Harvest)");
        }

        // 3. Meteorological Seasons (1st of the month - Optional)
        if (this.settings.enableMeteorologicalSeasons && day === 1) {
            if (month === 2) items.push("🌱 **Meteorological Spring begins**");
            if (month === 5) items.push("☀️ **Meteorological Summer begins**");
            if (month === 8) items.push("🍂 **Meteorological Fall (Autumn) begins**");
            if (month === 11) items.push("❄️ **Meteorological Winter begins**");
        }

        return Promise.resolve({ items });
    }
}