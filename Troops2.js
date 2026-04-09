(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'defesa_disponivel_bot_compat';
    var DIALOG_ID = 'defesa_disponivel_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                pt_PT: {
                    title: 'Contador de tropas em casa e em buscas',
                    subtitle: 'Resumo de Poder Militar',
                    home: 'Em casa',
                    scavenging: 'Em busca',
                    total: 'Total',
                    defensiveTotal: 'Tropa Defensiva Total',
                    offensiveTotal: 'Tropa Ofensiva Total',
                    group: 'Grupo atual',
                    player: 'Jogador',
                    server: 'Servidor',
                    refresh: 'Atualizar',
                    sendDiscord: 'Enviar para Discord',
                    noGroup: 'Todos',
                    copy: 'Copiar',
                    bbCopied: 'BBCode copiado!',
                    summaryTotal: 'Resumo Total',
                    homePlusScavenge: 'Casa + Busca',
                    atHomeOnly: 'Em casa',
                    exportTroops: 'Exportar Contagem de Tropas',
                    errorMessages: {
                        premiumRequired: 'Erro. Conta premium necessária!',
                        errorFetching: 'Erro ao carregar URL:',
                        missingSavengeMassScreenElement: 'Erro ao localizar ScavengeMassScreen.',
                        invalidWebhook: 'Webhook do Discord inválido ou não definido.',
                        troopsReadError: 'Não foi possível ler os dados das tropas.',
                        invalidWorldConfig: 'Configuração do mundo inválida.'
                    },
                    successMessage: 'Carregado com sucesso!',
                    loadingMessage: 'A carregar...',
                    loadingWorldConfigMessage: 'A carregar configurações do mundo...',
                    credits: 'Script Engine: JDi4s | Classic UI Mod'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            
            // Filtro para não processar arqueiros nem milícia
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = Array.isArray(game_data.units) ? [...game_data.units] : [];
            this.availableUnits = this.availableUnits.filter(u => !forbidden.includes(u));

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

        async #getTroopsScavengingWorldObj() {
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops() };
            let currentPage = 0; let lastRunTime = null;
            do {
                const scavengingObject = await getScavengeMassScreenJson(this, currentPage, lastRunTime);
                if (!scavengingObject) return troopsObj; if (scavengingObject.length === 0) break;
                lastRunTime = Date.now();
                $.each(scavengingObject, (_, villageData) => {
                    $.each(villageData.unit_counts_home || {}, (key, value) => { if (this.availableUnits.includes(key)) troopsObj.villagesTroops[key] += value; });
                    $.each(villageData.options || [], (_, option) => { if (option.scavenging_squad !== null) { $.each(option.scavenging_squad.unit_counts || {}, (key, value) => { if (this.availableUnits.includes(key)) troopsObj.scavengingTroops[key] += value; }); } });
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
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops() };
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
                    const villageTroopsLine = $(tbodyObj).find('tr').eq(0).find('td:gt(1)');
                    let c = 0;
                    // Mapeamento correto ignorando colunas arqueiros se existirem no servidor
                    $(overviewTroopsPage).find('#units_table thead th img').each((idx, img) => {
                        const unitName = $(img).attr('src').match(/unit_(\w+)/)[1];
                        if (this.availableUnits.includes(unitName)) {
                            const val = parseInt($(tbodyObj).find('tr').eq(0).find('td').eq(idx + 2).text().trim(), 10) || 0;
                            troopsObj.villagesTroops[unitName] += val;
                        }
                    });
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
            let groups = $(html).find('.vis_item').find('a,strong');
            const groupsArr = {};
            $.each(groups, (_, group) => { const val = $(group).text().trim(); groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1); });
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

        #getTroopsBBCode(totalTroops) {
            let bbCode = `[b]Contagem de Tropas (${this.#getServerTime()})[/b]\n[b]Grupo Atual:[/b] ${this.#getCurrentGroupName()}\n\n`;
            const labels = { spear: 'Lanceiros', sword: 'Espadachins', axe: 'Vikings', spy: 'Batedores', light: 'Cavalaria Leve', heavy: 'Cavalaria Pesada', ram: 'Aríetes', catapult: 'Catapultas', knight: 'Paladinos', snob: 'Nobres' };
            for (let [key, value] of Object.entries(totalTroops)) { bbCode += `[unit]${key}[/unit] [b]${this.#formatNumber(value)}[/b] ${labels[key] || key}\n`; }
            return bbCode;
        }

        #sendToDiscordEnhanced(total) {
            const playerName = game_data.player.name;
            const currentGroup = this.#getCurrentGroupName();
            if (typeof webhookURL !== 'string' || !webhookURL.startsWith('https://discord.com/api/webhooks/')) { alert("❌ Webhook inválido!"); return; }

            const embedData = {
                content: `📊 **Relatório de Poder Militar - ${playerName}**`,
                embeds: [
                    {
                        title: `Mundo: ${game_data.world} | Grupo: ${currentGroup}`,
                        color: 15844367,
                        fields: [
                            { 
                                name: "🛡️ PODER DEFENSIVO", 
                                value: `<:lanceiro:1368839513891409972> **Lanças:** ${this.#formatNumber(total.spear)}\n<:espadachim:1368839514746785844> **Espadas:** ${this.#formatNumber(total.sword)}\n<:pesada:1368839517997498398> **Pesada:** ${this.#formatNumber(total.heavy)}\n<:catapulta:1368839516441280573> **Catas:** ${this.#formatNumber(total.catapult)}\n<:paladino:1368332901728391319> **Paladino:** ${this.#formatNumber(total.knight || 0)}`, 
                                inline: true 
                            },
                            { 
                                name: "⚔️ PODER OFENSIVO", 
                                value: `<:viking:1368839515661139968> **Vikings:** ${this.#formatNumber(total.axe)}\n<:batedor:1368839512423137404> **Batedores:** ${this.#formatNumber(total.spy)}\n<:leve:1368839513077715016> **Leve:** ${this.#formatNumber(total.light)}\n<:ariete:1368839512033038387> **Aríetes:** ${this.#formatNumber(total.ram)}\n<:catapulta:1368839516441280573> **Catas:** ${this.#formatNumber(total.catapult)}\n<:paladino:1368332901728391319> **Paladino:** ${this.#formatNumber(total.knight || 0)}`, 
                                inline: true 
                            }
                        ],
                        footer: { text: `Tribal Wars | Atualizado em: ${this.#getServerTime()}` }
                    }
                ]
            };

            $('#dd-send-discord').text('A enviar...').prop('disabled', true);
            $.ajax({
                url: webhookURL,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(embedData),
                success: () => { alert("Poder Militar enviado!"); $('#dd-send-discord').text('Enviar para Discord').prop('disabled', false); },
                error: () => { alert("Erro ao enviar."); $('#dd-send-discord').text('Enviar para Discord').prop('disabled', false); }
            });
        }

        async #createUI() {
            UI.InfoMessage(this.UserTranslation.loadingMessage);
            const troopsObj = this.isScavengingWorld ? await this.#getTroopsScavengingWorldObj() : await this.#getTroopsNonScavengingWorldObj();
            const total = this.#buildTotalTroopsObj(troopsObj);
            const t = this.UserTranslation;

            const groupsHtml = (() => {
                let h = ''; $.each(this.#getGroupsObj(), (id, name) => { h += `<option value="${id}" ${String(game_data.group_id) === String(id) ? 'selected' : ''}>${name}</option>`; });
                return `<select id="dd-group-select" onchange="villagesTroopsCounter.changeGroup(this)">${h}</select>`;
            })();

            const troopsHeader = (() => {
                let h = `<tr><th class="center"></th>`;
                this.availableUnits.forEach(v => { h += `<th class="center" width="35"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${v}.png"></th>`; });
                return h + `</tr>`;
            })();

            const getTroopsLine = (label, data) => {
                let h = `<tr><td style="font-weight:bold; padding:4px;">${label}</td>`;
                this.availableUnits.forEach(unit => { h += `<td class="center">${this.#formatNumber(data[unit] || 0)}</td>`; });
                return h + `</tr>`;
            };

            const renderCard = (unit, val, label) => `
                <div class="dd-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="dd-unit-value">${this.#formatNumber(val)}</div>
                    <div class="dd-unit-name">${label}</div>
                </div>`;

            const html = `
<div id="dd-root">
    <div class="dd-shell">
        <div class="dd-header"><div><div class="dd-kicker">Tribal Wars</div><h3>${t.title}</h3><div class="dd-sub">${t.subtitle}</div></div><div class="dd-stamp">${this.#getServerTime()}</div></div>
        <div class="dd-topbar">
            <div class="dd-meta">
                <div class="dd-pill"><span>${t.group}:</span> <strong>${this.#getCurrentGroupName()}</strong></div>
                <div class="dd-pill"><span>${t.player}:</span> <strong>${game_data.player.name}</strong></div>
            </div>
            <div class="dd-actions">${groupsHtml}<button id="dd-refresh" class="dd-btn dd-btn-secondary">${t.refresh}</button><button id="dd-send-discord" class="dd-btn dd-btn-primary">${t.sendDiscord}</button></div>
        </div>
        <div class="dd-grid">
            <div class="dd-panel dd-panel-large">
                <div class="dd-panel-head"><h4>${t.summaryTotal}</h4><span class="dd-panel-note">${this.isScavengingWorld ? t.homePlusScavenge : t.atHomeOnly}</span></div>
                <div class="dd-table-wrap"><table class="vis overview_table dd-table-modern" width="100%"><thead>${troopsHeader}</thead><tbody>
                    ${this.isScavengingWorld ? getTroopsLine(t.home, troopsObj.villagesTroops) : ''}
                    ${this.isScavengingWorld ? getTroopsLine(t.scavenging, troopsObj.scavengingTroops) : ''}
                    ${getTroopsLine(t.total, total)}
                </tbody></table></div>
            </div>
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('spear', total.spear, 'Lanceiros')} ${renderCard('sword', total.sword, 'Espadas')}
                    ${renderCard('heavy', total.heavy, 'Pesadas')}
                    ${renderCard('catapult', total.catapult, 'Catas')} ${this.availableUnits.includes('knight') ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
                <div class="dd-panel-head" style="margin-top:15px;"><h4>${t.offensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('axe', total.axe, 'Vikings')} ${renderCard('spy', total.spy, 'Batedores')}
                    ${renderCard('light', total.light, 'Leves')} 
                    ${renderCard('ram', total.ram, 'Aríetes')} ${renderCard('catapult', total.catapult, 'Catas')}
                    ${this.availableUnits.includes('knight') ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
            </div>
        </div>
        <div class="dd-panel-bb"><div class="dd-panel-head"><h4>${t.exportTroops}</h4><button id="dd-copy-bbcode" class="dd-btn dd-btn-secondary">${t.copy}</button></div><textarea readonly id="dd-bbcode-area">${this.#getTroopsBBCode(total).trim()}</textarea></div>
        <div class="dd-footer">${t.credits}</div>
    </div>
</div>
<style>
.popup_box_content { min-width: 980px; background: transparent !important; padding: 0 !important; }
#dd-root { color: #302010; font-family: Verdana, sans-serif; font-size: 12px; }
#dd-root .dd-shell { background: #f4e4bc url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/background/content.jpg'); border: 2px solid #805020; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.4); overflow: hidden; }
#dd-root .dd-header { display: flex; justify-content: space-between; padding: 15px 20px; background: #c1a264 url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/screen/tableheader_bg3.png') repeat-x; border-bottom: 2px solid #805020; }
#dd-root h3 { margin: 0; font-size: 22px; font-weight: bold; }
#dd-root .dd-sub { margin-top: 4px; color: #503010; font-size: 12px; font-style: italic; }
#dd-root .dd-stamp { background: #fff5da; border: 1px solid #805020; color: #302010; padding: 6px 10px; border-radius: 3px; font-weight: 700; font-size: 11px; }
#dd-root .dd-topbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #e3d5b3; border-bottom: 1px solid #805020; }
#dd-root .dd-pill { background: #fff; border: 1px solid #805020; border-radius: 3px; padding: 6px 10px; color: #302010; display: inline-flex; gap: 6px; margin-right: 5px; }
#dd-root .dd-pill-label { color: #805020; font-weight: bold; font-size: 10px; text-transform: uppercase; }
#dd-root .dd-actions select { height: 32px; border-radius: 3px; border: 1px solid #805020; background: #fff; padding: 0 8px; min-width: 180px; }
#dd-root .dd-btn { height: 32px; padding: 0 12px; border: 1px solid #805020; cursor: pointer; font-weight: 700; font-size: 12px; }
#dd-root .dd-btn-primary { background: #5865F2; color: #fff; border-color: #4752C4; }
#dd-root .dd-grid { display: grid; grid-template-columns: 1.4fr .9fr; gap: 16px; padding: 16px 20px; }
#dd-root .dd-panel { background: #fff5da; border: 1px solid #805020; padding: 14px; border-radius: 4px; }
#dd-root .dd-panel-head { display: flex; justify-content: space-between; border-bottom: 1px solid #d0b888; padding-bottom: 6px; margin-bottom: 10px; }
#dd-root .dd-table-modern { border-collapse: collapse; width: 100%; border: 1px solid #805020; }
#dd-root .dd-table-modern th { background: #c1a264 url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/screen/tableheader_bg3.png') repeat-x !important; border: 1px solid #805020; padding: 4px; }
#dd-root .dd-table-modern td { background: #fff !important; border: 1px solid #e3d5b3; padding: 6px 4px; text-align: center; }
#dd-root .dd-def-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
#dd-root .dd-unit-card { background: #e3d5b3; border: 1px solid #805020; padding: 8px 4px; text-align: center; border-radius: 3px; }
#dd-root .dd-unit-card img { width: 18px; height: 18px; margin-bottom: 4px; }
#dd-root .dd-unit-value { font-size: 14px; font-weight: 800; }
#dd-root .dd-unit-name { font-size: 10px; color: #805020; font-weight: bold; }
#dd-root .dd-panel-bb { margin: 0 20px 16px; border: 1px solid #805020; padding: 10px; background: #fff5da; }
#dd-root textarea { width: 100%; height: 80px; border: 1px solid #805020; padding: 10px; font-family: Consolas, monospace; font-size: 11px; }
#dd-root .dd-footer { padding: 0 20px 16px; font-size: 10px; font-weight: bold; text-align: right; color: #805020; }
</style>`;

            Dialog.show(DIALOG_ID, html, Dialog.close());
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');
            $('#dd-send-discord').on('click', () => this.#sendToDiscordEnhanced(total));
            $('#dd-refresh').on('click', async () => { Dialog.close(); await this.init(); });
            $('#dd-copy-bbcode').on('click', () => { $('#dd-bbcode-area').select(); document.execCommand('copy'); UI.SuccessMessage(t.bbCopied); });
        }

        async changeGroup(obj) { this.#fetchHtmlPage(this.#generateUrl('overview_villages', null, { group: obj.value })); game_data.group_id = obj.value; await this.#createUI(); }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
