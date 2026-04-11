(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'neon_militar_final_v10_nukes';
    var DIALOG_ID = 'dialog_neon_v10_nukes';

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

        // --- FUNÇÕES AUXILIARES PARA CÁLCULO DE NUKES ---
        #getUnitPop(unit) {
            const pops = { spear: 1, sword: 1, axe: 1, archer: 1, spy: 2, light: 4, marcher: 5, heavy: 6, ram: 5, catapult: 8, knight: 10, snob: 100, militia: 0 };
            return pops[unit] || 0;
        }

        #isOffensiveUnit(unit) {
            return ['axe', 'light', 'ram', 'catapult', 'marcher'].includes(unit);
        }

        #tallyNukes(nukesObj, offPop) {
            if (offPop >= 19500) nukesObj.full++;
            else if (offPop >= 15000) nukesObj.threeQuarters++;
            else if (offPop >= 10000) nukesObj.half++;
            else if (offPop >= 5000) nukesObj.quarter++;
        }
        // ------------------------------------------------

        async #getTroopsScavengingWorldObj() {
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops(), nukes: { full: 0, threeQuarters: 0, half: 0, quarter: 0 } };
            let currentPage = 0; let lastRunTime = null;
            do {
                const scavengingObject = await getScavengeMassScreenJson(this, currentPage, lastRunTime);
                if (!scavengingObject) return troopsObj; if (scavengingObject.length === 0) break;
                lastRunTime = Date.now();
                $.each(scavengingObject, (_, villageData) => {
                    let villageOffPop = 0; // População ofensiva desta aldeia
                    
                    $.each(villageData.unit_counts_home || {}, (key, value) => { 
                        if (this.availableUnits.includes(key)) {
                            troopsObj.villagesTroops[key] += value;
                            if (this.#isOffensiveUnit(key)) villageOffPop += value * this.#getUnitPop(key);
                        }
                    });
                    
                    $.each(villageData.options || [], (_, option) => { 
                        if (option.scavenging_squad !== null) { 
                            $.each(option.scavenging_squad.unit_counts || {}, (key, value) => { 
                                if (this.availableUnits.includes(key)) {
                                    troopsObj.scavengingTroops[key] += value;
                                    if (this.#isOffensiveUnit(key)) villageOffPop += value * this.#getUnitPop(key);
                                }
                            }); 
                        } 
                    });

                    this.#tallyNukes(troopsObj.nukes, villageOffPop); // Avalia a aldeia
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
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops(), nukes: { full: 0, threeQuarters: 0, half: 0, quarter: 0 } };
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
                
                $.each(troopsTable, (_, tbodyObj) => {
                    let villageOffPop = 0; // População ofensiva desta aldeia
                    const headers = $(overviewTroopsPage).find('#units_table thead th img');
                    
                    headers.each((idx, img) => {
                        const unitMatch = $(img).attr('src').match(/unit_(\w+)/);
                        if (unitMatch) {
                            const unitName = unitMatch[1];
                            if (this.availableUnits.includes(unitName)) {
                                const val = parseInt($(tbodyObj).find('tr').eq(0).find('td').eq(idx+2).text().trim(), 10) || 0;
                                troopsObj.villagesTroops[unitName] += val;
                                if (this.#isOffensiveUnit(unitName)) villageOffPop += val * this.#getUnitPop(unitName);
                            }
                        }
                    });

                    this.#tallyNukes(troopsObj.nukes, villageOffPop); // Avalia a aldeia
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
            
            bbCode += `\n[b]Análise de Ataque:[/b]\n`;
            bbCode += `Fulls (>=19.5k): [b]${nukes.full}[/b]\n`;
            bbCode += `3/4 Fulls: [b]${nukes.threeQuarters}[/b]\n`;
            bbCode += `1/2 Fulls: [b]${nukes.half}[/b]\n`;
            bbCode += `1/4 Fulls: [b]${nukes.quarter}[/b]\n`;

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
                                value: `**Fulls:** ${nukes.full}\n**3/4 Fulls:** ${nukes.threeQuarters}\n**1/2 Fulls:** ${nukes.half}\n**1/4 Fulls:** ${nukes.quarter}`,
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
            const nukes = troopsObj.nukes; // <- Pega os nukes calculados diretamente do objecto
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
                    <div class="neon-panel-head"><h4>${t.offensiveTotal}</h4></div>
                    <div class="neon-unit-grid">
                        ${renderCard('axe', total.axe, 'VIKINGS')} ${renderCard('spy', total.spy, 'BATEDOR')}
                        ${renderCard('light', total.light, 'LEVE')} ${renderCard('ram', total.ram, 'ARÍETE')}
                        ${renderCard('catapult', total.catapult, 'CATAS')}
                    </div>
                    
                    <div class="neon-panel-head" style="margin-top: 20px;"><h4>🔥 ANÁLISE DE NUKES</h4></div>
                    <div class="neon-unit-grid" style="grid-template-columns: repeat(4, 1fr);">
                        <div class="neon-unit-card"><div class="neon-unit-value" style="color: #00d9ff;">${nukes.full}</div><div class="neon-unit-name">FULL</div></div>
                        <div class="neon-unit-card"><div class="neon-unit-value" style="color: #00d9ff;">${nukes.threeQuarters}</div><div class="neon-unit-name">3/4 FULL</div></div>
                        <div class="neon-unit-card"><div class="neon-unit-value" style="color: #00d9ff;">${nukes.half}</div><div class="neon-unit-name">1/2 FULL</div></div>
                        <div class="neon-unit-card"><div class="neon-unit-value" style="color: #00d9ff;">${nukes.quarter}</div><div class="neon-unit-name">1/4 FULL</div></div>
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
.neon-pulse-dot { display: inline-block; width: 8px; height: 8px; background: #00ff88; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 8px #00ff88; animation: neon-pulse-anim 2s infinite; }

.neon-topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 25px; background: #000; border-bottom: 1px solid #1a3a2a; font-size: 12px; }
.neon-actions select { background: #121212; color: #00ff88; border: 1px solid #1a3a2a; border-radius: 10px; padding: 4px; outline: none; }

.neon-btn { height: 30px; padding: 0 15px; border: 1px solid #00ff88; cursor: pointer; font-weight: bold; border-radius: 15px; background: #000; color: #00ff88; font-size: 11px; transition: 0.3s; margin-left: 5px; }
.neon-btn:hover { background: #00ff88; color: #000; box-shadow: 0 0 12px #00ff88; }
.neon-btn-discord { border-color: #00d9ff; color: #00d9ff; }
.neon-btn-discord:hover { background: #00d9ff; color: #000; box-shadow: 0 0 12px #00d9ff; }

.neon-grid { display: grid; grid-template-columns: 1fr; gap: 20px; padding: 20px; }
.neon-panel-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.neon-section { background: #121212; border: 1px solid #1a3a2a; padding: 15px; border-radius: 20px; }

.neon-panel-head h4 { margin: 0 0 15px 0; color: #00ff88; font-size: 13px; text-transform: uppercase; border-left: 3px solid #00ff88; padding-left: 10px; }

.neon-table-wrap { border-radius: 15px; overflow: hidden; border: 1px solid #1a3a2a; background: #000; }
.neon-table { border-collapse: collapse; }
.neon-table th { background: #181818 !important; padding: 10px; color: #00ff88; border: 1px solid #1a3a2a; }
.neon-table td { padding: 10px; text-align: center; border: 1px solid #1a3a2a; color: #ccffeb; font-size: 12px; }
.neon-label { text-align: left !important; font-weight: bold; color: #008855; padding-left: 15px !important; }
.neon-total-row { background: #001a0d; color: #00ff88; font-weight: bold; }

.neon-unit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.neon-unit-card { background: #1a1a1a; border: 1px solid #222; padding: 10px 5px; text-align: center; border-radius: 15px; transition: 0.3s; }
.neon-unit-card:hover { border-color: #00ff88; background: #002211; transform: translateY(-3px); }
.neon-unit-card img { width: 22px; height: 22px; margin-bottom: 5px; }
.neon-unit-value { font-size: 14px; font-weight: bold; color: #fff; text-shadow: 0 0 5px rgba(0,255,136,0.3); }
.neon-unit-name { font-size: 8px; color: #008855; font-weight: bold; text-transform: uppercase; }

.neon-footer-box { padding: 0 20px 20px; }
.neon-bbcode-wrap { display: flex; gap: 10px; align-items: center; background: #000; padding: 10px; border-radius: 15px; border: 1px solid #1a3a2a; }
.neon-bbcode-wrap textarea { background: transparent; border: none; color: #00ff88; font-family: monospace; font-size: 11px; height: 40px; flex-grow: 1; resize: none; outline: none; }

.neon-credits { margin-top: 15px; text-align: right; font-size: 10px; font-weight: bold; color: #004422; text-transform: uppercase; }

@keyframes neon-pulse-anim { 0% { opacity: 1; box-shadow: 0 0 8px #00ff88; } 50% { opacity: 0.4; box-shadow: 0 0 2px #00ff88; } 100% { opacity: 1; box-shadow: 0 0 8px #00ff88; } }
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
