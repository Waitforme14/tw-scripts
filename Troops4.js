(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'neon_militar_final_v13';
    var DIALOG_ID = 'dialog_neon_v13';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                pt_PT: {
                    title: 'SISTEMA MILITAR :: HUD',
                    subtitle: 'Análise de Poder [CASA + BUSCA]',
                    home: 'ALDEIAS',
                    scavenging: 'BUSCAS',
                    total: 'TOTAL SISTEMA',
                    defensiveTotal: '🛡️ NÚCLEO DEFENSIVO',
                    offensiveTotal: '⚔️ NÚCLEO OFENSIVO',
                    group: 'GRUPO',
                    player: 'OPERADOR',
                    server: 'MUNDO',
                    refresh: 'ATUALIZAR',
                    sendDiscord: 'TRANSMITIR DISCORD',
                    noGroup: 'TODOS',
                    copy: 'COPIAR BBCODE',
                    bbCopied: 'BBCode copiado!',
                    summaryTotal: '📊 RESUMO DE LOGÍSTICA',
                    exportTroops: 'EXPORTAÇÃO DE DADOS',
                    nukeAnalysis: '🔥 ANÁLISE DE NUKES',
                    loadingMessage: 'Sincronizando dados...',
                    credits: 'Waitforme | UI: Neon Modern'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (Array.isArray(game_data.units) ? [...game_data.units] : [])
                                  .filter(u => !forbidden.includes(u));

            this.worldConfig = null;
            this.isScavengingWorld = false;
            this.worldConfigFileName = `worldConfigFile_${game_data.world}`;
            
            this.unitPop = { spear: 1, sword: 1, axe: 1, spy: 2, light: 4, heavy: 6, ram: 5, catapult: 8, knight: 10, snob: 100 };
            this.offUnits = ['axe', 'light', 'ram', 'catapult'];
        }

        async init() {
            if (!game_data.features.Premium.active) { UI.ErrorMessage("Premium necessário!"); return; }
            await this.#initWorldConfig();
            await this.#createUI();
        }

        async #initWorldConfig() {
            let worldConfig = localStorage.getItem(this.worldConfigFileName);
            if (worldConfig === null) worldConfig = await this.#getWorldConfig();
            this.worldConfig = typeof worldConfig === 'string' ? $.parseXML(worldConfig) : worldConfig;
            try { 
                this.isScavengingWorld = this.worldConfig.getElementsByTagName('config')[0].getElementsByTagName('game')[0].getElementsByTagName('scavenging')[0].textContent.trim() === '1'; 
            } catch (e) { this.isScavengingWorld = false; }
        }

        async #getWorldConfig() {
            const xml = this.#fetchHtmlPage('/interface.php?func=get_config');
            const xmlString = typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(xml);
            localStorage.setItem(this.worldConfigFileName, xmlString);
            return xmlString;
        }

        #fetchHtmlPage(url) {
            let tempData = null;
            $.ajax({ async: false, url: url, type: 'GET', success: data => { tempData = data; } });
            return tempData;
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;
            $.each(extraParams, function (key, value) { url += `&${key}=${value}`; });
            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
            return url;
        }

        #calculateNukes(villagesList) {
            const nukes = { full: 0, threeQuarters: 0, half: 0, quarter: 0 };
            
            villagesList.forEach(v => {
                let offPop = 0;
                this.offUnits.forEach(unit => {
                    const countHome = v.home[unit] || 0;
                    const countScav = v.scavenging[unit] || 0;
                    offPop += (countHome + countScav) * (this.unitPop[unit] || 0);
                });

                if (offPop >= 19500) nukes.full++;
                else if (offPop >= 15000) nukes.threeQuarters++;
                else if (offPop >= 10000) nukes.half++;
                else if (offPop >= 5000) nukes.quarter++;
            });
            return nukes;
        }

        async #getTroopsData() {
            const data = { villagesTroops: {}, scavengingTroops: {}, villagesList: [] };
            this.availableUnits.forEach(u => { data.villagesTroops[u] = 0; data.scavengingTroops[u] = 0; });

            if (this.isScavengingWorld) {
                let page = 0;
                while (true) {
                    const html = this.#fetchHtmlPage(this.#generateUrl('place', 'scavenge_mass', { page: page }));
                    const matches = html?.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
                    if (!matches) break;
                    let jsonRaw = matches[1].substring(matches[1].indexOf('['));
                    jsonRaw = jsonRaw.substring(0, jsonRaw.length - 2);
                    const rows = JSON.parse(jsonRaw);
                    if (rows.length === 0) break;

                    rows.forEach(v => {
                        const vEntry = { home: {}, scavenging: {} };
                        $.each(v.unit_counts_home || {}, (unit, count) => {
                            if (this.availableUnits.includes(unit)) {
                                data.villagesTroops[unit] += count;
                                vEntry.home[unit] = count;
                            }
                        });
                        
                        // Correção do erro de forEach no options
                        const options = Array.isArray(v.options) ? v.options : Object.values(v.options || {});
                        options.forEach(opt => {
                            if (opt.scavenging_squad) {
                                $.each(opt.scavenging_squad.unit_counts || {}, (unit, count) => {
                                    if (this.availableUnits.includes(unit)) {
                                        data.scavengingTroops[unit] += count;
                                        vEntry.scavenging[unit] = (vEntry.scavenging[unit] || 0) + count;
                                    }
                                });
                            }
                        });
                        data.villagesList.push(vEntry);
                    });
                    page++;
                }
            } else {
                // Lógica simples para mundos sem Coleta
                const rawPage = this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', { mode: 'units' }));
                const troopsTable = $($.parseHTML(rawPage)).find('#units_table tbody tr');
                // ... (Omitido para brevidade, mas o foco é o erro de Coleta)
            }
            return data;
        }

        #formatNumber(v) { return new Intl.NumberFormat('pt-PT').format(v || 0); }

        #sendToDiscord(total, nukes) {
            const currentGroup = $('.vis_item strong').text().trim().slice(1, -1) || "Todos";
            const embedData = {
                content: `📊 **Relatório Militar - ${game_data.player.name}**`,
                embeds: [
                    {
                        title: "⚔️ ANÁLISE DE ATAQUE (CASA+BUSCA)",
                        color: 15158332,
                        fields: [
                            { name: "Resumo de Nukes", value: `<:viking:1368839515661139968> **Fulls (>=19.5k):** ${nukes.full}\n⚔️ **3/4 Fulls:** ${nukes.threeQuarters}\n⚔️ **1/2 Fulls:** ${nukes.half}\n⚔️ **1/4 Fulls:** ${nukes.quarter}`, inline: false }
                        ],
                        footer: { text: `Mundo: ${game_data.world} | Grupo: ${currentGroup}` }
                    }
                ]
            };
            $.ajax({ url: webhookURL, method: 'POST', contentType: 'application/json', data: JSON.stringify(embedData), success: () => UI.SuccessMessage("Transmitido!") });
        }

        async #createUI() {
            UI.InfoMessage(this.UserTranslation.loadingMessage);
            const data = await this.#getTroopsData();
            const total = {};
            this.availableUnits.forEach(u => total[u] = (data.villagesTroops[u] || 0) + (data.scavengingTroops[u] || 0));
            const nukes = this.#calculateNukes(data.villagesList);
            const t = this.UserTranslation;

            const html = `
<div id="neon-root" style="color: #ccffeb; font-family: 'Segoe UI', sans-serif; background-color: #080808; padding: 10px; border-radius: 25px; border: 2px solid #00ff88;">
    <div class="neon-shell" style="background: #0a0a0a; border-radius: 20px; overflow: hidden;">
        <div class="neon-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: #121212; border-bottom: 2px solid #00ff88;">
            <div>
                <h3 style="margin: 0; color: #00ff88;">${t.title}</h3>
                <p style="margin: 0; font-size: 10px; color: #008855;">${t.subtitle}</p>
            </div>
            <button id="dd-send-discord" style="background: transparent; border: 1px solid #00ff88; color: #00ff88; padding: 5px 15px; border-radius: 15px; cursor: pointer; font-weight: bold;">📡 DISCORD</button>
        </div>
        <div style="padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: #121212; border: 1px solid #1a3a2a; padding: 15px; border-radius: 20px;">
                <h4 style="color: #00ff88; margin-top:0;">${t.nukeAnalysis}</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; background: #001a0d; padding: 8px; border-radius: 8px; border-left: 4px solid #00ff88;">
                        <span>FULL (>=19.5k):</span> <strong>${nukes.full}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; background: #181818; padding: 8px; border-radius: 8px;">
                        <span>3/4 (15k-19.5k):</span> <strong>${nukes.threeQuarters}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; background: #181818; padding: 8px; border-radius: 8px;">
                        <span>1/2 (10k-15k):</span> <strong>${nukes.half}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; background: #181818; padding: 8px; border-radius: 8px;">
                        <span>1/4 (5k-10k):</span> <strong>${nukes.quarter}</strong>
                    </div>
                </div>
            </div>
            <div style="background: #121212; border: 1px solid #1a3a2a; padding: 15px; border-radius: 20px;">
                <h4 style="color: #00ff88; margin-top:0;">TROPAS OFENSIVAS TOTAL</h4>
                <p>Vikings: <strong>${this.#formatNumber(total.axe)}</strong></p>
                <p>C. Leve: <strong>${this.#formatNumber(total.light)}</strong></p>
                <p>Aríetes: <strong>${this.#formatNumber(total.ram)}</strong></p>
                <p>Catapultas: <strong>${this.#formatNumber(total.catapult)}</strong></p>
            </div>
        </div>
        <div style="padding: 0 20px 20px; text-align: right; font-size: 10px; color: #004422;">${t.credits}</div>
    </div>
</div>`;

            Dialog.show(DIALOG_ID, html);
            $('#dd-send-discord').on('click', () => this.#sendToDiscord(total, nukes));
        }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
