import { Plugin, Notice, TFile, Setting, PluginSettingTab, App, ButtonComponent } from 'obsidian';
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

        this.addRibbonIcon('sparkles', 'DaySpark: Add to Today', async () => {
            await this.activateMagic();
        });

        this.addCommand({
            id: 'dayspark-add',
            name: 'Add Context to Current Note',
            callback: () => this.activateMagic()
        });

        this.addSettingTab(new DaySparkSettingTab(this.app, this));
    }

    refreshProviders() {
        this.providers = [];
        
        // 0. Location
        this.providers.push(new LocationProvider(this.settings));

        // 1. Calendars
        for (const group of this.settings.calendarGroups) {
            this.providers.push(new IcsProvider(this.app, group));
        }

        // 2. Context
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
        const loadedData = await this.loadData();
        // Backward compatibility
        if (loadedData && loadedData.icsUrls && !loadedData.calendarGroups) {
            loadedData.calendarGroups = [{
                id: 'migrated',
                name: 'Main Calendar',
                enabled: true,
                header: loadedData.icsHeader || '## Agenda',
                urls: loadedData.icsUrls,
                showDescription: true
            }];
        }
        if (loadedData && loadedData.calendarGroups) {
             loadedData.calendarGroups.forEach((group: any) => {
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
        containerEl.createEl('h2', { text: 'DaySpark Settings' });

        // --- GENERAL SETTINGS ---
        containerEl.createEl('h3', { text: '🌍 General Settings' });

        new Setting(containerEl)
            .setName('Overwrite Sections')
            .setDesc('If enabled, DaySpark will update existing sections instead of appending.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.replaceContext)
                .onChange(async (val) => {
                    this.plugin.settings.replaceContext = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Latitude')
            .addText(text => text
                .setValue(String(this.plugin.settings.latitude))
                .onChange(async (val) => {
                    this.plugin.settings.latitude = parseFloat(val);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Longitude')
            .addText(text => text
                .setValue(String(this.plugin.settings.longitude))
                .onChange(async (val) => {
                    this.plugin.settings.longitude = parseFloat(val);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('24-Hour Time')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use24HourFormat)
                .onChange(async (val) => {
                    this.plugin.settings.use24HourFormat = val;
                    await this.plugin.saveSettings();
                }));

        // --- WEATHER ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '🌦️ Weather' });
        
        new Setting(containerEl)
            .setName('Enable Weather')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableWeather)
                .onChange(async (val) => {
                    this.plugin.settings.enableWeather = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use Metric Units')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useMetric)
                .onChange(async (val) => {
                    this.plugin.settings.useMetric = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Weather Header')
            .addText(text => text
                .setValue(this.plugin.settings.weatherHeader)
                .onChange(async (val) => {
                    this.plugin.settings.weatherHeader = val;
                    await this.plugin.saveSettings();
                }));

        // --- CALENDAR ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '📅 Calendar Groups' });
        
        this.plugin.settings.calendarGroups.forEach((group, index) => {
            const div = containerEl.createDiv({ cls: 'dayspark-group-box', attr: { style: 'border: 1px solid var(--background-modifier-border); padding: 10px; margin-bottom: 10px; border-radius: 5px;' } });
            
            const topSettings = new Setting(div)
                .setName(`Group ${index + 1}`)
                .addToggle(toggle => toggle
                    .setValue(group.enabled)
                    .onChange(async (val) => {
                        group.enabled = val;
                        await this.plugin.saveSettings();
                    }))
                .addExtraButton(btn => btn
                    .setIcon('trash')
                    .onClick(async () => {
                        this.plugin.settings.calendarGroups.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); 
                    }));
            topSettings.nameEl.style.fontWeight = 'bold';

            new Setting(div)
                .setName('Group Name')
                .addText(text => text
                    .setValue(group.name)
                    .onChange(async (val) => {
                        group.name = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('Header')
                .addText(text => text
                    .setValue(group.header)
                    .onChange(async (val) => {
                        group.header = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('Show Descriptions')
                .addToggle(toggle => toggle
                    .setValue(group.showDescription)
                    .onChange(async (val) => {
                        group.showDescription = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('ICS URLs')
                .addTextArea(text => text
                    .setValue(group.urls.join('\n'))
                    .onChange(async (val) => {
                        group.urls = val.split('\n').filter(u => u.trim().length > 0);
                        await this.plugin.saveSettings();
                    }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ Add Group')
                .setCta()
                .onClick(async () => {
                    this.plugin.settings.calendarGroups.push({
                        id: Date.now().toString(),
                        name: 'New Group',
                        enabled: true,
                        header: '## New Section',
                        urls: [],
                        showDescription: true
                    });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // --- MOON ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '🌑 Moon Phase' });
        
        new Setting(containerEl)
            .setName('Enable Moon Phase')
            .addToggle(t => t
                .setValue(this.plugin.settings.enableMoon)
                .onChange(async v => {
                    this.plugin.settings.enableMoon = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Moon Header')
            .addText(t => t
                .setValue(this.plugin.settings.moonHeader)
                .onChange(async v => {
                    this.plugin.settings.moonHeader = v;
                    await this.plugin.saveSettings();
                }));

        // --- SUN ---
        containerEl.createEl('h3', { text: '☀️ Sun Times' });
        
        new Setting(containerEl)
            .setName('Enable Sun Times')
            .addToggle(t => t
                .setValue(this.plugin.settings.enableSun)
                .onChange(async v => {
                    this.plugin.settings.enableSun = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sun Header')
            .addText(t => t
                .setValue(this.plugin.settings.sunHeader)
                .onChange(async v => {
                    this.plugin.settings.sunHeader = v;
                    await this.plugin.saveSettings();
                }));

        // --- PLANETS ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '🪐 Sky Watch' });
        
        new Setting(containerEl)
            .setName('Enable Planet Watch')
            .addToggle(t => t
                .setValue(this.plugin.settings.enablePlanets)
                .onChange(async v => {
                    this.plugin.settings.enablePlanets = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Planet Header')
            .addText(t => t
                .setValue(this.plugin.settings.planetHeader)
                .onChange(async v => {
                    this.plugin.settings.planetHeader = v;
                    await this.plugin.saveSettings();
                }));

        // --- CELESTIAL EVENTS ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '✨ Celestial Events' });
        
        new Setting(containerEl)
            .setName('Enable Celestial Events')
            .setDesc('Master Toggle. Enables Basic: Conjunctions (0°), Oppositions (180°), Nodes (☊/☋), Meteors.')
            .addToggle(t => t
                .setValue(this.plugin.settings.enableCelestialEvents)
                .onChange(async v => {
                    this.plugin.settings.enableCelestialEvents = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Celestial Header')
            .addText(t => t
                .setValue(this.plugin.settings.celestialHeader)
                .onChange(async v => {
                    this.plugin.settings.celestialHeader = v;
                    await this.plugin.saveSettings();
                }));

        // SUB-TOGGLES
        new Setting(containerEl)
            .setName('Show Retrogrades')
            .setDesc('Planetary Stations (stat.)')
            .addToggle(t => t
                .setValue(this.plugin.settings.showRetrogrades)
                .onChange(async v => {
                    this.plugin.settings.showRetrogrades = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Advanced Astronomy')
            .setDesc('Perigee/Apogee, Runs High/Low, Equator Crossings')
            .addToggle(t => t
                .setValue(this.plugin.settings.showAdvancedAstronomy)
                .onChange(async v => {
                    this.plugin.settings.showAdvancedAstronomy = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Astrology Aspects')
            .setDesc('Trine (△), Square (□), Sextile (⚹)')
            .addToggle(t => t
                .setValue(this.plugin.settings.showAstrology)
                .onChange(async v => {
                    this.plugin.settings.showAstrology = v;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Show Deep Astrology')
            .setDesc('Chiron, Pluto, Nodes + Minor Aspects (Quintiles, Semi-Squares)')
            .addToggle(t => t
                .setValue(this.plugin.settings.showDeepAstrology)
                .onChange(async v => {
                    this.plugin.settings.showDeepAstrology = v;
                    await this.plugin.saveSettings();
                }));

        // --- SEASONS & ALMANAC & HISTORY ---
        containerEl.createEl('hr'); containerEl.createEl('h3', { text: '📜 Seasons, Lore & History' });
        new Setting(containerEl).setName('Enable Seasons').addToggle(t => t.setValue(this.plugin.settings.enableSeasons).onChange(async v => { this.plugin.settings.enableSeasons = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName('Enable Almanac Lore').addToggle(t => t.setValue(this.plugin.settings.enableAlmanac).onChange(async v => { this.plugin.settings.enableAlmanac = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName('Almanac Header').addText(t => t.setValue(this.plugin.settings.almanacHeader).onChange(async v => { this.plugin.settings.almanacHeader = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName('Enable On This Day').addToggle(t => t.setValue(this.plugin.settings.enableHistory).onChange(async v => { this.plugin.settings.enableHistory = v; await this.plugin.saveSettings(); }));
        new Setting(containerEl).setName('Max History Events').addDropdown(d => { for(let i=1;i<=10;i++)d.addOption(i.toString(),i.toString()); d.setValue(String(this.plugin.settings.historyLimit)).onChange(async v=>{this.plugin.settings.historyLimit=parseInt(v);await this.plugin.saveSettings();})});
        new Setting(containerEl).setName('History Header').addText(t => t.setValue(this.plugin.settings.historyHeader).onChange(async v => { this.plugin.settings.historyHeader = v; await this.plugin.saveSettings(); }));
    }
}