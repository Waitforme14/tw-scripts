(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'neon_militar_final_v12';
    var DIALOG_ID = 'dialog_neon_v12';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                pt_PT: {
                    title: 'SISTEMA MILITAR :: HUD',
                    subtitle: 'Análise de Poder [CASA + BUSCA]2',
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
            this.availableUnits = (Array.isArray(game_data.units) ? [...game_data.units] : []).filter(u => !forbidden.includes(u));
            this.worldConfig = null;
            this.isScavengingWorld = false;
            this.worldConfigFileName = `worldConfigFile_${game_data.world}`;
            
            // Definição exata de população (conforme configuração padrão do TW)
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
            this.isScavengingWorld = this.worldConfig.getElementsByTagName('scavenging')[0]?.textContent === '1';
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
            $.each(extraParams, (k, v) => { url += `&${k}=${v}`; });
            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
            return url;
        }

        #calculateNukes(villagesList) {
            const nukes = { full: 0, threeQuarters: 0, half: 0, quarter: 0 };
            
            villagesList.forEach(v => {
                let offPop = 0;
                // Soma exata de Ataque: Casa + Busca
                this.offUnits.forEach(unit => {
                    const countHome = v.home[unit] || 0;
                    const countScav = v.scavenging[unit] || 0;
                    offPop += (countHome + countScav) * (this.unitPop[unit] || 0);
                });

                // Classificação rigorosa por intervalos
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
                        $.each(v.unit_counts_home, (unit, count) => {
                            if (this.availableUnits.includes(unit)) {
                                data.villagesTroops[unit] += count;
                                vEntry.home[unit] = count;
                            }
                        });
                        v.options.forEach(opt => {
                            if (opt.scavenging_squad) {
                                $.each(opt.scavenging_squad.unit_counts, (unit, count) => {
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
                // Lógica simplificada para mundos sem busca (apenas Overview)
                const rawPage = this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', { mode: 'units', page: 0 }));
                const troopsTable = $($.parseHTML(rawPage)).find('#units_table tbody tr');
                // ... (Lógica de processamento de tabela similar à anterior)
            }
            return data;
        }

        #formatNumber(v) { return new Intl.NumberFormat('pt-PT').format(v || 0); }

        #sendToDiscord(total, nukes) {
            const currentGroup = (game_data.group_id === 0) ? "Todos" : $('.vis_item strong').text().trim().slice(1, -1) || "Todos";
            const embedData = {
                content: `📊 **Relatório Militar - ${game_data.player.name}**`,
                embeds: [{
                    title: "⚔️ ANÁLISE DE ATAQUE",
                    color: 15158332,
                    fields: [
                        { name: "Resumo", value: `**Fulls (>=19.5k):** ${nukes.full}\n**3/4 Fulls:** ${nukes.threeQuarters}\n**1/2 Fulls:** ${nukes.half}\n**1/4 Fulls:** ${nukes.quarter}`, inline: false },
                        { name: "Tropas Totais", value: `🪓 Vikings: ${this.#formatNumber(total.axe)}\n🐎 Leve: ${this.#formatNumber(total.light)}\n🐏 Aríetes: ${this.#formatNumber(total.ram)}`, inline: true }
                    ],
                    footer: { text: `Mundo: ${game_data.world} | Grupo: ${currentGroup}` }
                }]
            };
            $.ajax({ url: webhookURL, method: 'POST', contentType: 'application/json', data: JSON.stringify(embedData), success: () => alert("Enviado!") });
        }

        async #createUI() {
            UI.InfoMessage(this.UserTranslation.loadingMessage);
            const data = await this.#getTroopsData();
            const total = {};
            this.availableUnits.forEach(u => total[u] = data.villagesTroops[u] + data.scavengingTroops[u]);
            const nukes = this.#calculateNukes(data.villagesList);
            const t = this.UserTranslation;

            const html = `
            <div id="neon-root" style="color: #ccffeb; font-family: 'Segoe UI', sans-serif; background-color: #080808; padding: 15px; border-radius: 20px; border: 2px solid #00ff88;">
                <h3 style="color:#00ff88; margin-top:0;">${t.title}</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="background: #121212; padding: 15px; border-radius: 15px; border: 1px solid #1a3a2a;">
                        <h4 style="color:#00ff88; border-bottom: 1px solid #00ff88; padding-bottom: 5px;">${t.nukeAnalysis}</h4>
                        <p>🚀 **Fulls:** ${nukes.full}</p>
                        <p>🏹 **3/4 Fulls:** ${nukes.threeQuarters}</p>
                        <p>🗡️ **1/2 Fulls:** ${nukes.half}</p>
                        <p>🛡️ **1/4 Fulls:** ${nukes.quarter}</p>
                    </div>
                    <div style="background: #121212; padding: 15px; border-radius: 15px; border: 1px solid #1a3a2a;">
                        <h4 style="color:#00ff88; border-bottom: 1px solid #00ff88; padding-bottom: 5px;">TOTAL ATAQUE</h4>
                        <p>Vikings: ${this.#formatNumber(total.axe)}</p>
                        <p>Leve: ${this.#formatNumber(total.light)}</p>
                        <p>Aríetes: ${this.#formatNumber(total.ram)}</p>
                    </div>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button id="btn-discord" style="background: #00ff88; color: #000; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold;">ENVIAR DISCORD</button>
                </div>
            </div>`;

            Dialog.show(DIALOG_ID, html);
            $('#btn-discord').on('click', () => this.#sendToDiscord(total, nukes));
        }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
