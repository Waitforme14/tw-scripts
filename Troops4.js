(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'neon_militar_final_v11';
    var DIALOG_ID = 'dialog_neon_v11';

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
                    homePlusScavenge: 'Total Integrado',
                    atHomeOnly: 'Apenas Local',
                    exportTroops: 'EXPORTAÇÃO DE DADOS',
                    nukeAnalysis: '🔥 ANÁLISE DE NUKES',
                    errorMessages: {
                        premiumRequired: 'Erro. Conta premium necessária!',
                        errorFetching: 'Erro ao carregar URL:',
                        missingSavengeMassScreenElement: 'Erro ao localizar ScavengeMassScreen.',
                        invalidWebhook: 'Webhook do Discord inválido.',
                        troopsReadError: 'Falha na leitura de dados.',
                        invalidWorldConfig: 'Configuração inválida.'
                    },
                    successMessage: 'Transmissão concluída!',
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
            if (!game_data.features.Premium.active) { UI.ErrorMessage(this.UserTranslation.errorMessages.premiumRequired); return; }
            await this.#initWorldConfig();
            await this.#createUI();
        }

        async #initWorldConfig() {
            let worldConfig = localStorage.getItem(this.worldConfigFileName);
            if (worldConfig === null) worldConfig = await this.#getWorldConfig();
            this.worldConfig = typeof worldConfig === 'string' ? $.parseXML(worldConfig) : worldConfig;
            try { this.isScavengingWorld = this.worldConfig.getElementsByTagName('config')[0].getElementsByTagName('game')[0].getElementsByTagName('scavenging')[0].textContent.trim() === '1'; } catch (e) { throw e; }
        }

        async #getWorldConfig() {
            const xml = this.#fetchHtmlPage('/interface.php?func=get_config');
            const xmlString = typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(xml);
            localStorage.setItem(this.worldConfigFileName, xmlString);
            await this.#waitMilliseconds(Date.now(), 200);
            return xmlString;
        }

        async #waitMilliseconds(lastRunTime, ms = 0) { await new Promise(res => { setTimeout(res, Math.max((lastRunTime || 0) + ms - Date.now(), 0)); }); }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;
            $.each(extraParams, function (key, value) { url += `&${key}=${value}`; });
            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
            return url;
        }

        #initTroops() { const troops = {}; this.availableUnits.forEach(unit => { troops[unit] = 0; }); return troops; }

        #fetchHtmlPage(url) {
            let tempData = null;
            $.ajax({ async: false, url: url, type: 'GET', success: data => { tempData = data; }, error: () => { console.error("Erro ao carregar URL"); } });
            return tempData;
        }

        #calculateNukes(villagesData) {
            const nukes = { full: 0, threeQuarters: 0, half: 0, quarter: 0 };
            
            villagesData.forEach(v => {
                let offPop = 0;
                $.each(v.home, (unit, count) => {
                    if (this.offUnits.includes(unit)) offPop += (count * (this.unitPop[unit] || 0));
                });
                $.each(v.scavenging, (unit, count) => {
                    if (this.offUnits.includes(unit)) offPop += (count * (this.unitPop[unit] || 0));
                });

                if (offPop >= 19500) nukes.full++;
                else if (offPop >= 15000) nukes.threeQuarters++;
                else if (offPop >= 10000) nukes.half++;
                else if (offPop >= 5000) nukes.quarter++;
            });
            return nukes;
        }

        async #getTroopsScavengingWorldObj() {
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops(), villagesList: [] };
            let currentPage = 0; let lastRunTime = null;
            do {
                const scavengingObject = await getScavengeMassScreenJson(this, currentPage, lastRunTime);
                if (!scavengingObject) return troopsObj; if (scavengingObject.length === 0) break;
                lastRunTime = Date.now();
                $.each(scavengingObject, (_, villageData) => {
                    const vEntry = { home: {}, scavenging: {} };
                    $.each(villageData.unit_counts_home || {}, (key, value) => { 
                        if (this.availableUnits.includes(key)) {
                            troopsObj.villagesTroops[key] += value;
                            vEntry.home[key] = value;
                        }
                    });
                    $.each(villageData.options || [], (_, option) => { 
                        if (option.scavenging_squad !== null) { 
                            $.each(option.scavenging_squad.unit_counts || {}, (key, value) => { 
                                if (this.availableUnits.includes(key)) {
                                    troopsObj.scavengingTroops[key] += value;
                                    vEntry.scavenging[key] = (vEntry.scavenging[key] || 0) + value;
                                }
                            }); 
                        } 
                    });
                    troopsObj.villagesList.push(vEntry);
                });
                currentPage++;
            } while (true);
            return troopsObj;

            async function getScavengeMassScreenJson(currentObj, cp = 0, lrt = 0) {
                await currentObj.#waitMilliseconds(lrt, 200);
                const html = currentObj.#fetchHtmlPage(currentObj.#generateUrl('place', 'scavenge_mass', { page: cp }));
                if (!html) return false;
                const matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
                if (!matches || matches.length <= 1) return false;
                let json = matches[1]; json = json.substring(json.indexOf('[')); json = json.substring(0, json.length - 2);
                try { return JSON.parse(json); } catch (e) { return false; }
            }
        }

        async #getTroopsNonScavengingWorldObj() {
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops(), villagesList: [] };
            let currentPage = 0; let lastRunTime = Date.now();
            await this.#setMaxLinesPerPage('overview_villages', 'units', 1000);
            await this.#waitMilliseconds(lastRunTime, 200);
            let lastVillageId = null;
            do {
                lastRunTime = Date.now();
                const rawPage = this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', { page: currentPage }));
                if (!rawPage) break;
                const overviewTroopsPage = $.parseHTML(rawPage);
                const troopsTable = $(overviewTroopsPage).find('#units_table tbody');
                if (!troopsTable.length) break;
                const lastVillageIdTemp = $(troopsTable).find('span').eq(0).attr('data-id');
                if (!lastVillageIdTemp || lastVillageId === lastVillageIdTemp) break;
                lastVillageId = lastVillageIdTemp;

                $(troopsTable).each((_, tbodyObj) => {
                    const vEntry = { home: {}, scavenging: {} };
                    const headers = $(overviewTroopsPage).find('#units_table thead th img');
                    headers.each((idx, img) => {
                        const unitMatch = $(img).attr('src').match(/unit_(\w+)/);
                        if (unitMatch) {
                            const unitName = unitMatch[1];
                            if (this.availableUnits.includes(unitName)) {
                                const val = parseInt($(tbodyObj).find('tr').eq(0).find('td').eq(idx+2).text().trim(), 10) || 0;
                                troopsObj.villagesTroops[unitName] += val;
                                vEntry.home[unitName] = val;
                            }
                        }
                    });
                    troopsObj.villagesList.push(vEntry);
                });
                currentPage++; await this.#waitMilliseconds(lastRunTime, 200);
            } while (true);
            return troopsObj;
        }

        async #setMaxLinesPerPage(screen, mode, value) {
            const form = document.createElement("form");
            $.each({ page_size: value, h: game_data.csrf }, (key, val) => { const input = document.createElement('input'); input.name = key; input.value = val; form.appendChild(input); });
            $.ajax({ type: 'POST', url: this.#generateUrl(screen, mode, { action: 'change_page_size', type: 'all' }), data: $(form).serialize(), async: false });
        }

        #getGroupsObj() {
            const html = $.parseHTML(this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', { type: 'static' })));
            let groupsArr = {};
            $(html).find('.vis_item').find('a,strong').each((_, group) => {
                const val = $(group).text().trim();
                groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1);
            });
            return groupsArr;
        }

        #buildTotalTroopsObj(troopsObj) {
            const merged = {};
            this.availableUnits.forEach(unit => { merged[unit] = (troopsObj.villagesTroops[unit] || 0) + (troopsObj.scavengingTroops[unit] || 0); });
            return merged;
        }

        #getCurrentGroupName() {
            const groups = this.#getGroupsObj();
            return (game_data.group_id && groups[game_data.group_id]) || this.UserTranslation.noGroup;
        }

        #getServerTime() { return $('#serverDate').text() + ' ' + $('#serverTime').text(); }
        #formatNumber(value) { return new Intl.NumberFormat('pt-PT').format(Number(value || 0)); }

        #getTroopsBBCode(totalTroops, nukes) {
            let bbCode = `[b]Contagem de Tropas (${this.#getServerTime()})[/b]\n[b]Grupo Atual:[/b] ${this.#getCurrentGroupName()}\n\n`;
            const labels = { spear: 'Lanceiros', sword: 'Espadachins', axe: 'Vikings', spy: 'Batedores', light: 'Cavalaria Leve', heavy: 'Cavalaria Pesada', ram: 'Aríetes', catapult: 'Catapultas', knight: 'Paladinos' };
            for (let [key, value] of Object.entries(totalTroops)) { if(this.availableUnits.includes(key)) bbCode += `[unit]${key}[/unit] [b]${this.#formatNumber(value)}[/b] ${labels[key] || key}\n`; }
            bbCode += `\n[b]Análise de Ataque:[/b]\nFulls: ${nukes.full}\n3/4 Fulls: ${nukes.threeQuarters}\n1/2 Fulls: ${nukes.half}\n1/4 Fulls: ${nukes.quarter}`;
            return bbCode;
        }

        #sendToDiscordEnhanced(total, nukes) {
            const playerName = game_data.player.name;
            const currentGroup = this.#getCurrentGroupName();
            if (typeof webhookURL !== 'string' || !webhookURL.startsWith('https://discord.com/api/webhooks/')) { alert("❌ Webhook inválido!"); return; }

            const embedData = {
                content: `📊 **Relatório de Poder Militar - ${playerName}**`,
                embeds: [
                    {
                        title: "🛡️ TROPAS DEFENSIVAS",
                        color: 3447003,
                        fields: [
                            { 
                                name: "Unidades", 
                                value: `<:lanceiro:1368839513891409972> **Lanças:** ${this.#formatNumber(total.spear)}\n<:espadachim:1368839514746785844> **Espadas:** ${this.#formatNumber(total.sword)}\n<:pesada:1368839517997498398> **Pesada:** ${this.#formatNumber(total.heavy)}\n<:catapulta:1368839516441280573> **Catas:** ${this.#formatNumber(total.catapult)}\n<:paladino:1368332901728391319> **Paladino:** ${this.#formatNumber(total.knight || 0)}`, 
                                inline: true 
                            }
                        ]
                    },
                    {
                        title: "⚔️ TROPAS OFENSIVAS",
                        color: 15158332,
                        fields: [
                            { 
                                name: "Unidades", 
                                value: `<:viking:1368839515661139968> **Vikings:** ${this.#formatNumber(total.axe)}\n<:batedor:1368839512423137404> **Batedores:** ${this.#formatNumber(total.spy)}\n<:leve:1368839513077715016> **Leve:** ${this.#formatNumber(total.light)}\n<:ariete:1368839512033038387> **Aríetes:** ${this.#formatNumber(total.ram)}\n<:catapulta:1368839516441280573> **Catas:** ${this.#formatNumber(total.catapult)}`, 
                                inline: true 
                            },
                            {
                                name: "🔥 Análise de Nukes",
                                value: `**Full Nukes:** ${nukes.full}\n**3/4 Nukes:** ${nukes.threeQuarters}\n**1/2 Nukes:** ${nukes.half}\n**1/4 Nukes:** ${nukes.quarter}`,
                                inline: true
                            }
                        ],
                        footer: { text: `Mundo: ${game_data.world} | Grupo: ${currentGroup} | ${this.#getServerTime()}` }
                    }
                ]
            };

            $('#dd-send-discord').text('Transmitindo...').prop('disabled', true);
            $.ajax({ url: webhookURL, method: 'POST', contentType: 'application/json', data: JSON.stringify(embedData), success: () => { alert("DADOS TRANSMITIDOS!"); $('#dd-send-discord').text('Transmitir Discord').prop('disabled', false); }, error: () => { alert("Erro na transmissão."); $('#dd-send-discord').text('Transmitir Discord').prop('disabled', false); } });
        }

        async #createUI() {
            UI.InfoMessage(this.UserTranslation.loadingMessage);
            const troopsObj = this.isScavengingWorld ? await this.#getTroopsScavengingWorldObj() : await this.#getTroopsNonScavengingWorldObj();
            const total = this.#buildTotalTroopsObj(troopsObj);
            const nukes = this.#calculateNukes(troopsObj.villagesList);
            const t = this.UserTranslation;

            const groupsHtml = (() => {
                let h = ''; $.each(this.#getGroupsObj(), (id, name) => { h += `<option value="${id}" ${String(game_data.group_id) === String(id) ? 'selected' : ''}>${name}</option>`; });
                return `<select id="dd-group-select" onchange="villagesTroopsCounter.changeGroup(this)">${h}</select>`;
            })();

            const renderCard = (unit, val, label) => `
                <div class="neon-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="neon-unit-value">${this.#formatNumber(val)}</div>
                    <div class="neon-unit-name">${label}</div>
                </div>`;

            const html = `
<div id="neon-root">
    <div class="neon-shell">
        <div class="neon-header">
            <div class="neon-title-box">
                <span class="neon-pulse-dot"></span>
                <h3>${t.title}</h3>
                <p>${t.subtitle}</p>
            </div>
            <div class="neon-stamp">[ ${this.#getServerTime()} ]</div>
        </div>
        <div class="neon-topbar">
            <span>${t.player}: <strong style="color:#00ff88;">${game_data.player.name}</strong> | ${t.server}: <strong style="color:#00ff88;">${game_data.world}</strong></span>
            <div class="neon-actions">
                ${groupsHtml}
                <button id="dd-refresh" class="neon-btn">🔄 ${t.refresh}</button>
                <button id="dd-send-discord" class="neon-btn neon-btn-discord">📡 ${t.sendDiscord}</button>
            </div>
        </div>
        <div class="neon-grid">
            <div class="neon-panel">
                <div class="neon-panel-head"><h4>${t.summaryTotal}</h4></div>
                <div class="neon-table-wrap">
                    <table class="neon-table" width="100%">
                        <thead>
                            <tr>
                                <th style="border-top-left-radius: 15px;">ORIGEM</th>
                                ${this.availableUnits.map(v => `<th class="center"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${v}.png"></th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td class="neon-label">${t.home}</td>${this.availableUnits.map(u => `<td>${this.#formatNumber(troopsObj.villagesTroops[u])}</td>`).join('')}</tr>
                            ${this.isScavengingWorld ? `<tr><td class="neon-label">${t.scavenging}</td>${this.availableUnits.map(u => `<td>${this.#formatNumber(troopsObj.scavengingTroops[u])}</td>`).join('')}</tr>` : ''}
                            <tr class="neon-total-row"><td class="neon-label">${t.total}</td>${this.availableUnits.map(u => `<td>${this.#formatNumber(total[u])}</td>`).join('')}</tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="neon-panel-split">
                <div class="neon-section">
                    <div class="neon-panel-head"><h4>${t.defensiveTotal}</h4></div>
                    <div class="neon-unit-grid">
                        ${renderCard('spear', total.spear, 'LANÇAS')} ${renderCard('sword', total.sword, 'ESPADAS')}
                        ${renderCard('heavy', total.heavy, 'PESADA')} ${renderCard('catapult', total.catapult, 'CATAS')}
                        ${total.knight !== undefined ? renderCard('knight', total.knight, 'PALADINO') : ''}
                    </div>
                </div>
                <div class="neon-section">
                    <div class="neon-panel-head"><h4>${t.nukeAnalysis}</h4></div>
                    <div class="nuke-stats-grid">
                         <div class="nuke-stat-item"><span>FULL (>=19.5k):</span> <strong>${nukes.full}</strong></div>
                         <div class="nuke-stat-item"><span>3/4 (15k-19.5k):</span> <strong>${nukes.threeQuarters}</strong></div>
                         <div class="nuke-stat-item"><span>1/2 (10k-15k):</span> <strong>${nukes.half}</strong></div>
                         <div class="nuke-stat-item"><span>1/4 (5k-10k):</span> <strong>${nukes.quarter}</strong></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="neon-footer-box">
            <div class="neon-panel-head"><h4>${t.exportTroops}</h4></div>
            <div class="neon-bbcode-wrap">
                <button id="dd-copy-bbcode" class="neon-btn">📋 ${t.copy}</button>
                <textarea readonly id="dd-bbcode-area">${this.#getTroopsBBCode(total, nukes).trim()}</textarea>
            </div>
            <div class="neon-credits">${t.credits}</div>
        </div>
    </div>
</div>
<style>
.popup_box_content { min-width: 950px !important; background: transparent !important; padding: 0 !important; border: none !important; }
.popup_box_close { background-color: #00ff88 !important; border-radius: 50% !important; margin: 10px !important; }
#neon-root { color: #ccffeb; font-family: 'Segoe UI', sans-serif; background-color: #080808; padding: 10px; border-radius: 25px; }
.neon-shell { border: 2px solid #00ff88; border-radius: 25px; box-shadow: 0 0 20px rgba(0, 255, 136, 0.2); overflow: hidden; background: #0a0a0a; }
.neon-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: #121212; border-bottom: 2px solid #00ff88; }
.neon-title-box h3 { margin: 0; font-size: 20px; color: #00ff88; font-weight: 900; letter-spacing: 1px; }
.neon-title-box p { margin: 0; font-size: 10px; color: #008855; font-weight: bold; text-transform: uppercase; }
.neon-topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 25px; background: #000; border-bottom: 1px solid #1a3a2a; font-size: 12px; }
.neon-btn { height: 30px; padding: 0 15px; border: 1px solid #00ff88; cursor: pointer; font-weight: bold; border-radius: 15px; background: #000; color: #00ff88; font-size: 11px; transition: 0.3s; margin-left: 5px; }
.neon-btn:hover { background: #00ff88; color: #000; box-shadow: 0 0 12px #00ff88; }
.neon-btn-discord { border-color: #00d9ff; color: #00d9ff; }
.neon-grid { display: grid; grid-template-columns: 1fr; gap: 20px; padding: 20px; }
.neon-panel-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.neon-section { background: #121212; border: 1px solid #1a3a2a; padding: 15px; border-radius: 20px; }
.neon-panel-head h4 { margin: 0 0 15px 0; color: #00ff88; font-size: 13px; text-transform: uppercase; border-left: 3px solid #00ff88; padding-left: 10px; }
.neon-table td { padding: 10px; text-align: center; border: 1px solid #1a3a2a; color: #ccffeb; font-size: 12px; }
.neon-unit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.neon-unit-card { background: #1a1a1a; border: 1px solid #222; padding: 10px 5px; text-align: center; border-radius: 15px; }
.nuke-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.nuke-stat-item { background: #001a0d; padding: 10px; border-radius: 10px; border: 1px solid #00ff88; display: flex; justify-content: space-between; align-items: center; }
.nuke-stat-item span { font-size: 10px; color: #008855; font-weight: bold; }
.nuke-stat-item strong { color: #00ff88; font-size: 16px; }
.neon-bbcode-wrap textarea { background: transparent; border: none; color: #00ff88; font-family: monospace; font-size: 11px; height: 60px; flex-grow: 1; resize: none; outline: none; }
</style>`;

            Dialog.show(DIALOG_ID, html, Dialog.close());
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');
            $('#dd-send-discord').on('click', () => this.#sendToDiscordEnhanced(total, nukes));
            $('#dd-refresh').on('click', async () => { Dialog.close(); await this.init(); });
            $('#dd-copy-bbcode').on('click', () => { $('#dd-bbcode-area').select(); document.execCommand('copy'); UI.SuccessMessage(t.bbCopied); });
        }

        async changeGroup(obj) { this.#fetchHtmlPage(this.#generateUrl('overview_villages', null, { group: obj.value })); game_data.group_id = obj.value; await this.#createUI(); }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
