/* eslint-disable obsidianmd/ui/sentence-case */
import { Plugin, Notice, Setting, PluginSettingTab, App } from 'obsidian';
import { SparkProvider, DaySparkSettings, DEFAULT_SETTINGS } from './src/interfaces';
import { getDateFromFile, insertOrUpdateSection } from './src/utils';
import { IcsProvider } from './src/providers/IcsProvider';
import { MoonProvider } from './src/providers/MoonProvider';
import { SunProvider } from './src/providers/SunProvider';
import { AlmanacProvider } from './src/providers/AlmanacProvider';
import { PlanetProvider } from './src/providers/PlanetProvider';
import { SeasonProvider } from './src/providers/SeasonProvider';
import { WeatherProvider } from './src/providers/WeatherProvider';
import { LocationProvider } from './src/providers/LocationProvider';
import { HistoryProvider } from './src/providers/HistoryProvider';
import { CelestialEventsProvider } from './src/providers/CelestialEventsProvider';

export default class DaySparkPlugin extends Plugin {
    settings: DaySparkSettings;
    providers: SparkProvider[] = [];

    async onload() {
        await this.loadSettings();
        this.refreshProviders();

        this.addRibbonIcon('sparkles', 'Add to today', async () => {
            await this.activateMagic();
        });

        this.addCommand({
            id: 'add',
            name: 'Add context to current note',
            callback: () => this.activateMagic()
        });

        this.addSettingTab(new DaySparkSettingTab(this.app, this));
    }

    refreshProviders() {
        this.providers = [];
        
        // 0. Location Context
        this.providers.push(new LocationProvider(this.settings));

        // 1. Calendars (Dynamic Groups)
        for (const group of this.settings.calendarGroups) {
            this.providers.push(new IcsProvider(this.app, group));
        }

        // 2. Context Modules
        this.providers.push(new WeatherProvider(this.settings)); 
        this.providers.push(new MoonProvider(this.settings));
        this.providers.push(new SunProvider(this.settings));
        this.providers.push(new PlanetProvider(this.settings));
        this.providers.push(new CelestialEventsProvider(this.settings));
        this.providers.push(new SeasonProvider(this.settings));
        this.providers.push(new AlmanacProvider(this.settings));
        this.providers.push(new HistoryProvider(this.settings));
    }

    async activateMagic() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("No active file.");
            return;
        }

        const date = getDateFromFile(activeFile, this.app);
        if (!date) {
            new Notice("Could not determine a date for this file.");
            return;
        }

        new Notice(`DaySparking context for ${date.toDateString()}...`);

        let currentContent = await this.app.vault.read(activeFile);
        let modificationsMade = false;

        for (const provider of this.providers) {
            try {
                const result = await provider.getDataForDate(date, currentContent);
                if (result.items.length > 0) {
                    const newContent = insertOrUpdateSection(currentContent, provider.targetHeader, result.items, this.settings.replaceContext);
                    if (newContent !== currentContent) {
                        currentContent = newContent;
                        modificationsMade = true;
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-undef
                console.error(`DaySpark: Error in ${provider.displayName}`, e);
            }
        }

        if (modificationsMade) {
            await this.app.vault.modify(activeFile, currentContent);
            new Notice("DaySpark updated your note!");
        } else {
            new Notice("DaySpark: No new items found to add.");
        }
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) as (DaySparkSettings & { icsUrls?: string[], icsHeader?: string }) | null;
        
        // Backward compatibility migration for older single-URL calendar formats
        if (loadedData && loadedData.icsUrls && !loadedData.calendarGroups) {
            loadedData.calendarGroups = [{
                id: 'migrated',
                name: 'Main calendar',
                enabled: true,
                header: loadedData.icsHeader || '## Agenda',
                urls: loadedData.icsUrls,
                showDescription: true
            }];
        }

        // Ensure showDescription defaults to true for migrated or new groups
        if (loadedData && loadedData.calendarGroups) {
            loadedData.calendarGroups.forEach((group) => {
                if (group.showDescription === undefined) group.showDescription = true;
            });
        }

        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.refreshProviders();
    }
}

class DaySparkSettingTab extends PluginSettingTab {
    plugin: DaySparkPlugin;

    constructor(app: App, plugin: DaySparkPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        ;

        // --- GENERAL ---
        ;
        
        new Setting(containerEl)
            .setName('Overwrite sections')
            .setDesc('If enabled, DaySpark will update existing sections instead of appending new data. Useful if you change location or context.')
            .addToggle(t => t.setValue(this.plugin.settings.replaceContext).onChange(async v => { 
                this.plugin.settings.replaceContext = v; 
                await this.plugin.saveSettings(); 
            }));

        new Setting(containerEl)
            .setName('Latitude')
            .setDesc('Your home base latitude for sun and moon calculations.')
            .addText(t => t.setValue(String(this.plugin.settings.latitude)).onChange(async v => { 
                this.plugin.settings.latitude = parseFloat(v); 
                await this.plugin.saveSettings(); 
            }));

        new Setting(containerEl)
            .setName('Longitude')
            .setDesc('Your home base longitude.')
            .addText(t => t.setValue(String(this.plugin.settings.longitude)).onChange(async v => { 
                this.plugin.settings.longitude = parseFloat(v); 
                await this.plugin.saveSettings(); 
            }));

        new Setting(containerEl)
            .setName('24-hour time')
            .setDesc('Toggle between AM/PM and 24-hour clock formats.')
            .addToggle(t => t.setValue(this.plugin.settings.use24HourFormat).onChange(async v => { 
                this.plugin.settings.use24HourFormat = v; 
                await this.plugin.saveSettings(); 
            }));

        // --- CALENDAR GROUPS ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("📅 Calendar groups").setHeading();
        containerEl.createEl('p', { text: 'Add multiple groups of .ics feeds. Each group can have its own section and header.', cls: 'setting-item-description' });
        
        this.plugin.settings.calendarGroups.forEach((group, index) => {
            const div = containerEl.createDiv({ 
                cls: 'dayspark-group-box', 
                attr: { style: 'border: 1px solid var(--background-modifier-border); padding: 15px; margin-bottom: 15px; border-radius: 8px;' } 
            });
            
            new Setting(div)
                .setName(`Calendar group header: ${group.header || (index + 1)}`)
                .setHeading()
                .addToggle(toggle => toggle
                    .setValue(group.enabled)
                    .onChange(async (val) => {
                        group.enabled = val;
                        await this.plugin.saveSettings();
                    }))
                .addExtraButton(btn => btn
                    .setIcon('trash')
                    .setTooltip('Delete this calendar group')
                    .onClick(async () => {
                        this.plugin.settings.calendarGroups.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));

            new Setting(div)
                .setName('Header')
                .setDesc('The Markdown header DaySpark will look for or create in your note.')
                .addText(text => text
                    .setPlaceholder('## Agenda')
                    .setValue(group.header)
                    .onChange(async (val) => {
                        group.header = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('Show descriptions')
                .setDesc('Include event notes and descriptions in the output.')
                .addToggle(toggle => toggle
                    .setValue(group.showDescription)
                    .onChange(async (val) => {
                        group.showDescription = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('ICS URLs')
                .setDesc('Public iCal URLs or local .ics file paths. Put each one on a new line.')
                .addTextArea(text => text
                    .setPlaceholder('https://calendar.google.com/.../basic.ics\nCalendars/MyEvents.ics')
                    .setValue(group.urls.join('\n'))
                    .onChange(async (val) => {
                        group.urls = val.split('\n').filter(u => u.trim().length > 0);
                        await this.plugin.saveSettings();
                    }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ Add calendar group')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.calendarGroups.push({
                        id: Date.now().toString(),
                        name: 'New group',
                        enabled: true,
                        header: '## Agenda',
                        urls: [],
                        showDescription: true
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // --- WEATHER ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("🌦️ Weather").setHeading();
        
        new Setting(containerEl)
            .setName('Enable weather')
            .setDesc('Pulls meteorological data from Open-Meteo.')
            .addToggle(t => t.setValue(this.plugin.settings.enableWeather).onChange(async v => { 
                this.plugin.settings.enableWeather = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enableWeather) {
            new Setting(containerEl)
                .setName('Use metric units')
                .setDesc('Celsius and km/h instead of Fahrenheit and mph.')
                .addToggle(t => t.setValue(this.plugin.settings.useMetric).onChange(async v => { 
                    this.plugin.settings.useMetric = v; 
                    await this.plugin.saveSettings(); 
                }));

            new Setting(containerEl)
                .setName('Weather header')
                .addText(t => t.setValue(this.plugin.settings.weatherHeader).onChange(async v => { 
                    this.plugin.settings.weatherHeader = v; 
                    await this.plugin.saveSettings(); 
                }));
        }

        // --- MOON ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("🌑 Moon phase").setHeading();
        
        new Setting(containerEl)
            .setName('Enable moon phase')
            .setDesc('Include phase and illumination percentage.')
            .addToggle(t => t
                .setValue(this.plugin.settings.enableMoon)
                .onChange(async v => {
                    this.plugin.settings.enableMoon = v;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.enableMoon) {
            new Setting(containerEl)
                .setName('Moon header')
                .addText(t => t
                    .setValue(this.plugin.settings.moonHeader)
                    .onChange(async v => {
                        this.plugin.settings.moonHeader = v;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Enable moon rise/set')
                .setDesc('Include local moonrise and moonset times for the day.')
                .addToggle(t => t
                    .setValue(this.plugin.settings.enableMoonTimes)
                    .onChange(async v => {
                        this.plugin.settings.enableMoonTimes = v;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Enable moon age')
                .setDesc('Include the age of the moon in days.')
                .addToggle(t => t
                    .setValue(this.plugin.settings.enableMoonAge)
                    .onChange(async v => {
                        this.plugin.settings.enableMoonAge = v;
                        await this.plugin.saveSettings();
                    }));

            new Setting(containerEl)
                .setName('Enable astronomical position')
                .setDesc('Include the current zodiac constellation position of the moon.')
                .addToggle(t => t
                    .setValue(this.plugin.settings.enableMoonPosition)
                    .onChange(async v => {
                        this.plugin.settings.enableMoonPosition = v;
                        await this.plugin.saveSettings();
                    }));
        }

        // --- SUN ---
        new Setting(containerEl).setName("☀️ Sun times").setHeading();
        new Setting(containerEl)
            .setName('Enable sun times')
            .setDesc('Include local sunrise and sunset times.')
            .addToggle(t => t.setValue(this.plugin.settings.enableSun).onChange(async v => { 
                this.plugin.settings.enableSun = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enableSun) {
            new Setting(containerEl)
                .setName('Sun header')
                .addText(t => t.setValue(this.plugin.settings.sunHeader).onChange(async v => { 
                    this.plugin.settings.sunHeader = v; 
                    await this.plugin.saveSettings(); 
                }));
        }

        // --- SKY WATCH (PLANETS) ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("🪐 Sky watch").setHeading();
        new Setting(containerEl)
            .setName('Enable planet watch')
            .setDesc('Identifies visible naked-eye planets for the given night.')
            .addToggle(t => t.setValue(this.plugin.settings.enablePlanets).onChange(async v => { 
                this.plugin.settings.enablePlanets = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enablePlanets) {
            new Setting(containerEl)
                .setName('Planet header')
                .addText(t => t.setValue(this.plugin.settings.planetHeader).onChange(async v => { 
                    this.plugin.settings.planetHeader = v; 
                    await this.plugin.saveSettings(); 
                }));
        }

        // --- CELESTIAL EVENTS ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("✨ Celestial events").setHeading();
        
        new Setting(containerEl)
            .setName('Enable celestial events')
            .setDesc('Master toggle for meteor showers and major celestial events.')
            .addToggle(t => t.setValue(this.plugin.settings.enableCelestialEvents).onChange(async v => { 
                this.plugin.settings.enableCelestialEvents = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enableCelestialEvents) {
            new Setting(containerEl)
                .setName('Celestial header')
                .addText(t => t.setValue(this.plugin.settings.celestialHeader).onChange(async v => { 
                    this.plugin.settings.celestialHeader = v; 
                    await this.plugin.saveSettings(); 
                }));

            new Setting(containerEl)
                .setName('Enable basic events')
                .setDesc('Conjunctions (☌), Oppositions (☍), and Moon Nodes (☊/☋).')
                .addToggle(t => t.setValue(this.plugin.settings.enableBasicEvents).onChange(async v => { 
                    this.plugin.settings.enableBasicEvents = v; 
                    await this.plugin.saveSettings(); 
                }));

            new Setting(containerEl)
                .setName('Enable meteor showers')
                .setDesc('Major meteor shower peak alerts.')
                .addToggle(t => t.setValue(this.plugin.settings.enableMeteorShowers).onChange(async v => { 
                    this.plugin.settings.enableMeteorShowers = v; 
                    await this.plugin.saveSettings(); 
                }));

            new Setting(containerEl)
                .setName('Enable advanced astronomy')
                .setDesc('Lunar Perigee/Apogee and extreme Moon declination (Runs High/Low).')
                .addToggle(t => t.setValue(this.plugin.settings.enableAdvancedAstronomy).onChange(async v => { 
                    this.plugin.settings.enableAdvancedAstronomy = v; 
                    await this.plugin.saveSettings(); 
                }));
        }

        // --- SEASONS ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("📅 Seasons").setHeading();
        
        new Setting(containerEl)
            .setName('Enable seasons')
            .setDesc('Flags equinoxes and solstices.')
            .addToggle(t => t.setValue(this.plugin.settings.enableSeasons).onChange(async v => { 
                this.plugin.settings.enableSeasons = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enableSeasons) {
            new Setting(containerEl)
                .setName('Seasons header')
                .addText(t => t.setValue(this.plugin.settings.seasonsHeader || '## Seasons').onChange(async v => { 
                    this.plugin.settings.seasonsHeader = v; 
                    await this.plugin.saveSettings(); 
                }));

            new Setting(containerEl)
                .setName('Enable cross-quarter days')
                .setDesc('Includes Almanac mid-season markers like Samhain (Nov 1), Imbolc, Beltane, and Lammas.')
                .addToggle(t => t.setValue(this.plugin.settings.enableCrossQuarterDays).onChange(async v => { 
                    this.plugin.settings.enableCrossQuarterDays = v; 
                    await this.plugin.saveSettings(); 
                }));

            new Setting(containerEl)
                .setName('Enable meteorological seasons')
                .setDesc('Includes markers for the start of meteorological seasons (1st of the month).')
                .addToggle(t => t.setValue(this.plugin.settings.enableMeteorologicalSeasons).onChange(async v => { 
                    this.plugin.settings.enableMeteorologicalSeasons = v; 
                    await this.plugin.saveSettings(); 
                }));
        }

        // --- ALMANAC LORE ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("📜 Almanac lore").setHeading();

        new Setting(containerEl)
            .setName('Enable almanac lore')
            .setDesc('Traditional weather proverbs and monthly lore.')
            .addToggle(t => t.setValue(this.plugin.settings.enableAlmanac).onChange(async v => { 
                this.plugin.settings.enableAlmanac = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enableAlmanac) {
            new Setting(containerEl)
                .setName('Almanac header')
                .addText(t => t.setValue(this.plugin.settings.almanacHeader).onChange(async v => { 
                    this.plugin.settings.almanacHeader = v; 
                    await this.plugin.saveSettings(); 
                }));
        }

        // --- ON THIS DAY ---
        containerEl.createEl('hr');
        new Setting(containerEl).setName("📖 On this day").setHeading();

        new Setting(containerEl)
            .setName('Enable on this day')
            .setDesc('Historical events from Wikipedia for this date.')
            .addToggle(t => t.setValue(this.plugin.settings.enableHistory).onChange(async v => { 
                this.plugin.settings.enableHistory = v; 
                await this.plugin.saveSettings(); 
                this.display();
            }));

        if (this.plugin.settings.enableHistory) {
            new Setting(containerEl)
                .setName('Max history events')
                .addDropdown(d => { 
                    for(let i=1;i<=10;i++) d.addOption(i.toString(), i.toString()); 
                    d.setValue(String(this.plugin.settings.historyLimit)).onChange(async v => {
                        this.plugin.settings.historyLimit = parseInt(v);
                        await this.plugin.saveSettings();
                    });
                });

            new Setting(containerEl)
                .setName('History header')
                .addText(t => t.setValue(this.plugin.settings.historyHeader).onChange(async v => { 
                    this.plugin.settings.historyHeader = v; 
                    await this.plugin.saveSettings(); 
                }));
        }
    }
}