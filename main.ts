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
        
        // 1. Calendars
        for (const group of this.settings.calendarGroups) {
            this.providers.push(new IcsProvider(this.app, group));
        }

        // 2. Astronomy & Context
        this.providers.push(new WeatherProvider(this.settings)); 
        this.providers.push(new MoonProvider(this.settings));
        this.providers.push(new SunProvider(this.settings));
        this.providers.push(new PlanetProvider(this.settings));
        this.providers.push(new SeasonProvider(this.settings));
        this.providers.push(new AlmanacProvider(this.settings));
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
                const result = await provider.getDataForDate(date);
                if (result.items.length > 0) {
                    const newContent = insertOrUpdateSection(currentContent, provider.targetHeader, result.items);
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
        
        // Backward compatibility migration
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

        // Ensure defaults exist for new properties
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
            .setName('Latitude')
            .setDesc('Used by Sun, Moon, Planets, and Weather.')
            .addText(text => text
                .setValue(String(this.plugin.settings.latitude))
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        this.plugin.settings.latitude = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Longitude')
            .setDesc('Used by Sun, Moon, Planets, and Weather.')
            .addText(text => text
                .setValue(String(this.plugin.settings.longitude))
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        this.plugin.settings.longitude = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('24-Hour Time')
            .setDesc('Use 24-hour format (e.g. 14:30) instead of 12-hour (2:30 PM).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.use24HourFormat)
                .onChange(async (value) => {
                    this.plugin.settings.use24HourFormat = value;
                    await this.plugin.saveSettings();
                }));

        // --- WEATHER SECTION ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '🌦️ Weather' });
        
        new Setting(containerEl)
            .setName('Enable Weather')
            .setDesc('Fetch current forecast or historical weather.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableWeather)
                .onChange(async (value) => {
                    this.plugin.settings.enableWeather = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Use Metric Units')
            .setDesc('Enable for Celsius/kmh. Disable for Fahrenheit/mph.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.useMetric)
                .onChange(async (value) => {
                    this.plugin.settings.useMetric = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Weather Header')
            .addText(text => text
                .setPlaceholder('## Weather')
                .setValue(this.plugin.settings.weatherHeader)
                .onChange(async (value) => {
                    this.plugin.settings.weatherHeader = value;
                    await this.plugin.saveSettings();
                }));

        // --- CALENDAR SECTION ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '📅 Calendar Groups' });
        containerEl.createEl('p', { text: 'Create separate groups for different headers (e.g. Work, Personal, Astrology).', cls: 'setting-item-description' });

        this.plugin.settings.calendarGroups.forEach((group, index) => {
            const div = containerEl.createDiv({ cls: 'dayspark-group-box', attr: { style: 'border: 1px solid var(--background-modifier-border); padding: 10px; margin-bottom: 10px; border-radius: 5px;' } });
            
            // Header Row
            const topSettings = new Setting(div)
                .setName(`Group ${index + 1}`)
                .addToggle(toggle => toggle
                    .setValue(group.enabled)
                    .setTooltip('Enable/Disable Group')
                    .onChange(async (val) => {
                        group.enabled = val;
                        await this.plugin.saveSettings();
                    }))
                .addExtraButton(btn => btn
                    .setIcon('trash')
                    .setTooltip('Delete Group')
                    .onClick(async () => {
                        this.plugin.settings.calendarGroups.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); 
                    }));

            topSettings.nameEl.style.fontWeight = 'bold';

            // Group Settings
            new Setting(div)
                .setName('Group Name')
                .addText(text => text
                    .setValue(group.name)
                    .setPlaceholder('e.g. Work')
                    .onChange(async (val) => {
                        group.name = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('Header')
                .setDesc('Section name in your note.')
                .addText(text => text
                    .setValue(group.header)
                    .setPlaceholder('## Agenda')
                    .onChange(async (val) => {
                        group.header = val;
                        await this.plugin.saveSettings();
                    }));
            
            new Setting(div)
                .setName('Show Descriptions')
                .setDesc('Include event details/notes.')
                .addToggle(toggle => toggle
                    .setValue(group.showDescription)
                    .onChange(async (val) => {
                        group.showDescription = val;
                        await this.plugin.saveSettings();
                    }));

            new Setting(div)
                .setName('ICS URLs / Paths')
                .setDesc('One per line.')
                .addTextArea(text => text
                    .setValue(group.urls.join('\n'))
                    .setPlaceholder('https://...')
                    .onChange(async (val) => {
                        group.urls = val.split('\n').filter(u => u.trim().length > 0);
                        await this.plugin.saveSettings();
                    }));
        });

        new Setting(containerEl)
            .addButton(btn => btn
                .setButtonText('+ Add Calendar Group')
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


        // --- MOON SECTION ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '🌑 Moon Phase' });
        
        new Setting(containerEl)
            .setName('Enable Moon Phase')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableMoon)
                .onChange(async (value) => {
                    this.plugin.settings.enableMoon = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Moon Header')
            .addText(text => text
                .setPlaceholder('## Moon Phase')
                .setValue(this.plugin.settings.moonHeader)
                .onChange(async (value) => {
                    this.plugin.settings.moonHeader = value;
                    await this.plugin.saveSettings();
                }));

        // --- SUN SECTION ---
        containerEl.createEl('h3', { text: '☀️ Sun Times' });
        
        new Setting(containerEl)
            .setName('Enable Sun Times')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSun)
                .onChange(async (value) => {
                    this.plugin.settings.enableSun = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Sun Header')
            .addText(text => text
                .setPlaceholder('## Daily Context')
                .setValue(this.plugin.settings.sunHeader)
                .onChange(async (value) => {
                    this.plugin.settings.sunHeader = value;
                    await this.plugin.saveSettings();
                }));
        
        // --- PLANETS SECTION ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '🪐 Sky Watch (Planets)' });
        
        new Setting(containerEl)
            .setName('Enable Planet Watch')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enablePlanets)
                .onChange(async (value) => {
                    this.plugin.settings.enablePlanets = value;
                    await this.plugin.saveSettings();
                }));
        
        new Setting(containerEl)
            .setName('Planet Header')
            .addText(text => text
                .setPlaceholder('## Sky Watch')
                .setValue(this.plugin.settings.planetHeader)
                .onChange(async (value) => {
                    this.plugin.settings.planetHeader = value;
                    await this.plugin.saveSettings();
                }));

        // --- SEASONS & ALMANAC SECTION ---
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '📜 Seasons & Lore' });
        
        new Setting(containerEl)
            .setName('Enable Seasons')
            .setDesc('Shows Equinoxes and Solstices.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableSeasons)
                .onChange(async (value) => {
                    this.plugin.settings.enableSeasons = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable Almanac Lore')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAlmanac)
                .onChange(async (value) => {
                    this.plugin.settings.enableAlmanac = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Almanac Header')
            .addText(text => text
                .setPlaceholder('## Almanac')
                .setValue(this.plugin.settings.almanacHeader)
                .onChange(async (value) => {
                    this.plugin.settings.almanacHeader = value;
                    await this.plugin.saveSettings();
                }));
    }
}