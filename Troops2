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
                    title: 'Contador de Tropas (Casa e Buscas)',
                    subtitle: 'Análise de Poder Militar',
                    home: 'Em casa',
                    scavenging: 'Em busca',
                    total: 'Total',
                    defensiveTotal: 'Poder Defensivo Total',
                    offensiveTotal: 'Poder Ofensivo Total',
                    group: 'Grupo atual',
                    player: 'Jogador',
                    server: 'Servidor',
                    refresh: 'Atualizar',
                    sendDiscord: 'Enviar para Discord',
                    noGroup: 'Todos',
                    copy: 'Copiar',
                    bbCopied: 'BBCode copiado!',
                    summaryTotal: 'Resumo de Unidades',
                    homePlusScavenge: 'Casa + Busca',
                    atHomeOnly: 'Em casa',
                    exportTroops: 'Exportar Contagem (BBCode)',
                    errorMessages: {
                        premiumRequired: 'Erro. É necessário possuir conta premium!',
                        errorFetching: 'Erro ao carregar URL:',
                        missingSavengeMassScreenElement: 'Erro ao localizar ScavengeMassScreen.',
                        invalidWebhook: 'Webhook do Discord inválido ou não definido.',
                        troopsReadError: 'Não foi possível ler os dados das tropas.',
                        invalidWorldConfig: 'Configuração do mundo inválida.'
                    },
                    successMessage: 'Carregado com sucesso!',
                    loadingMessage: 'A ler tropas...',
                    loadingWorldConfigMessage: 'A carregar configurações...',
                    credits: 'Script Engine: JDi4s | Classic UI Mod'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            this.availableUnits = Array.isArray(game_data.units) ? [...game_data.units] : [];
            const militiaIndex = this.availableUnits.indexOf('militia');
            if (militiaIndex !== -1) this.availableUnits.splice(militiaIndex, 1);
            this.worldConfig = null;
            this.isScavengingWorld = false;
            this.worldConfigFileName = `worldConfigFile_${game_data.world}`;
        }

        async init() {
            if (!game_data.features.Premium.active) {
                UI.ErrorMessage(this.UserTranslation.errorMessages.premiumRequired);
                return;
            }
            await this.#initWorldConfig();
            await this.#createUI();
        }

        async #initWorldConfig() {
            let worldConfig = localStorage.getItem(this.worldConfigFileName);
            if (worldConfig === null) {
                UI.InfoMessage(this.UserTranslation.loadingWorldConfigMessage);
                worldConfig = await this.#getWorldConfig();
            }
            this.worldConfig = typeof worldConfig === 'string' ? $.parseXML(worldConfig) : worldConfig;
            try {
                this.isScavengingWorld = this.worldConfig.getElementsByTagName('config')[0].getElementsByTagName('game')[0].getElementsByTagName('scavenging')[0].textContent.trim() === '1';
            } catch (e) {
                UI.ErrorMessage(this.UserTranslation.errorMessages.invalidWorldConfig);
                throw e;
            }
        }

        async #getWorldConfig() {
            const xml = this.#fetchHtmlPage('/interface.php?func=get_config');
            const xmlString = typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(xml);
            localStorage.setItem(this.worldConfigFileName, xmlString);
            await this.#waitMilliseconds(Date.now(), 200);
            return xmlString;
        }

        async #waitMilliseconds(lastRunTime, milliseconds = 0) {
            await new Promise(res => { setTimeout(res, Math.max((lastRunTime || 0) + milliseconds - Date.now(), 0)); });
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;
            $.each(extraParams, function (key, value) { url += `&${key}=${value}`; });
            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
            return url;
        }

        #initTroops() {
            const troops = {};
            this.availableUnits.forEach(unit => { troops[unit] = 0; });
            return troops;
        }

        #fetchHtmlPage(url) {
            let tempData = null;
            $.ajax({ async: false, url: url, type: 'GET', success: data => { tempData = data; }, error: () => { UI.ErrorMessage(`${this.UserTranslation.errorMessages.errorFetching} ${url}`); } });
            return tempData;
        }

        async #getTroopsScavengingWorldObj() {
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops() };
            let currentPage = 0;
            let lastRunTime = null;
            do {
                const scavengingObject = await getScavengeMassScreenJson(this, currentPage, lastRunTime);
                if (!scavengingObject) return troopsObj;
                if (scavengingObject.length === 0) break;
                lastRunTime = Date.now();
                $.each(scavengingObject, ( _, villageData) => {
                    $.each(villageData.unit_counts_home || {}, (key, value) => {
                        if (key !== 'militia' && typeof troopsObj.villagesTroops[key] !== 'undefined') troopsObj.villagesTroops[key] += value;
                    });
                    $.each(villageData.options || [], ( _, option) => {
                        if (option.scavenging_squad !== null) {
                            $.each(option.scavenging_squad.unit_counts || {}, (key, value) => {
                                if (key !== 'militia' && typeof troopsObj.scavengingTroops[key] !== 'undefined') troopsObj.scavengingTroops[key] += value;
                            });
                        }
                    });
                });
                currentPage++;
            } while (true);
            return troopsObj;

            async function getScavengeMassScreenJson(currentObj, currentPage = 0, lastRunTime = 0) {
                await currentObj.#waitMilliseconds(lastRunTime, 200);
                const html = currentObj.#fetchHtmlPage(currentObj.#generateUrl('place', 'scavenge_mass', { page: currentPage }));
                if (!html) return false;
                const matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
                if (!matches || matches.length <= 1) return false;
                let json = matches[1];
                json = json.substring(json.indexOf('['));
                json = json.substring(0, json.length - 2);
                try { return JSON.parse(json); } catch (e) { return false; }
            }
        }

        async #getTroopsNonScavengingWorldObj() {
            const troopsObj = { villagesTroops: this.#initTroops(), scavengingTroops: this.#initTroops() };
            let currentPage = 0;
            let lastRunTime = Date.now();
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
                if (!lastVillageIdTemp || (lastVillageId !== null && lastVillageId === lastVillageIdTemp)) break;
                lastVillageId = lastVillageIdTemp;
                $.each(troopsTable, ( _, tbodyObj) => {
                    const villageTroopsLine = $(tbodyObj).find('tr').eq(0).find('td:gt(1)');
                    let c = 0;
                    $.each(this.availableUnits, ( _, value) => {
                        troopsObj.villagesTroops[value] += parseInt(villageTroopsLine.eq(c).text().trim(), 10) || 0;
                        c++;
                    });
                });
                currentPage++;
                await this.#waitMilliseconds(lastRunTime, 200);
            } while (true);
            return troopsObj;
        }

        async #setMaxLinesPerPage(screen, mode, value) {
            const form = document.createElement("form");
            $.each({ page_size: value, h: game_data.csrf }, (key, val) => {
                const input = document.createElement('input'); input.name = key; input.value = val; form.appendChild(input);
            });
            $.ajax({ type: 'POST', url: this.#generateUrl(screen, mode, { action: 'change_page_size', type: 'all' }), data: $(form).serialize(), async: false });
        }

        #getGroupsObj() {
            const html = $.parseHTML(this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', { type: 'static' })));
            let groups = $(html).find('.vis_item').find('a,strong');
            const groupsArr = {};
            $.each(groups, ( _, group) => {
                const val = $(group).text().trim();
                groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1);
            });
            return groupsArr;
        }

        #formatNumber(value) { return new Intl.NumberFormat('pt-PT').format(Number(value || 0)); }

        async #createUI() {
            UI.InfoMessage(this.UserTranslation.loadingMessage);
            const troopsObj = this.isScavengingWorld ? await this.#getTroopsScavengingWorldObj() : await this.#getTroopsNonScavengingWorldObj();
            const total = {};
            $.each(troopsObj.villagesTroops, (k, v) => { total[k] = v + (troopsObj.scavengingTroops[k] || 0); });

            const t = this.UserTranslation;
            const groupsHtml = (() => {
                let h = ''; $.each(this.#getGroupsObj(), (id, name) => { h += `<option value="${id}" ${String(game_data.group_id) === String(id) ? 'selected' : ''}>${name}</option>`; });
                return `<select id="dd-group-select" onchange="villagesTroopsCounter.changeGroup(this)">${h}</select>`;
            })();

            const renderCard = (unit, val, labels) => `
                <div class="dd-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="dd-unit-value">${this.#formatNumber(val)}</div>
                    <div class="dd-unit-name">${labels[unit] || unit}</div>
                </div>`;

            const defLabels = { spear: 'Lanças', sword: 'Espadas', archer: 'Arqueiros', spy: 'Batedores', heavy: 'Pesadas', catapult: 'Catas', knight: 'Paladino' };
            const offLabels = { axe: 'Vikings', spy: 'Batedores', light: 'Leves', marcher: 'Montados', ram: 'Aríetes', catapult: 'Catas', knight: 'Paladino' };

            const html = `
<div id="dd-root">
    <div class="dd-shell">
        <div class="dd-header">
            <div>
                <div class="dd-kicker">Tribal Wars</div>
                <h3>${t.title}</h3>
            </div>
            <div class="dd-stamp">${this.#getServerTime()}</div>
        </div>

        <div class="dd-topbar">
            <div class="dd-meta">
                <div class="dd-pill"><span>${t.group}:</span> <strong>${(game_data.group_id && this.#getGroupsObj()[game_data.group_id]) || t.noGroup}</strong></div>
                <div class="dd-pill"><span>${t.player}:</span> <strong>${game_data.player.name}</strong></div>
            </div>
            <div class="dd-actions">
                ${groupsHtml}
                <button id="dd-refresh" class="dd-btn dd-btn-secondary">${t.refresh}</button>
                <button id="dd-send-discord" class="dd-btn dd-btn-primary">${t.sendDiscord}</button>
            </div>
        </div>

        <div class="dd-grid">
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('spear', total.spear, defLabels)}
                    ${renderCard('sword', total.sword, defLabels)}
                    ${game_data.units.includes('archer') ? renderCard('archer', total.archer, defLabels) : ''}
                    ${renderCard('spy', total.spy, defLabels)}
                    ${renderCard('heavy', total.heavy, defLabels)}
                    ${renderCard('catapult', total.catapult, defLabels)}
                    ${game_data.units.includes('knight') ? renderCard('knight', total.knight, defLabels) : ''}
                </div>
            </div>
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.offensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('axe', total.axe, offLabels)}
                    ${renderCard('spy', total.spy, offLabels)}
                    ${renderCard('light', total.light, offLabels)}
                    ${game_data.units.includes('marcher') ? renderCard('marcher', total.marcher, offLabels) : ''}
                    ${renderCard('ram', total.ram, offLabels)}
                    ${renderCard('catapult', total.catapult, offLabels)}
                    ${game_data.units.includes('knight') ? renderCard('knight', total.knight, offLabels) : ''}
                </div>
            </div>
        </div>

        <div class="dd-panel-bb">
            <div class="dd-panel-head"><h4>${t.exportTroops}</h4><button id="dd-copy-bbcode" class="dd-btn dd-btn-secondary">${t.copy}</button></div>
            <textarea readonly id="dd-bbcode-area">${this.#getTroopsBBCode(total)}</textarea>
        </div>
        <div class="dd-footer">${t.credits}</div>
    </div>
</div>
<style>
.popup_box_content { min-width: 980px; background: transparent !important; padding: 0 !important; }
#dd-root { color: #302010; font-family: Verdana, sans-serif; font-size: 12px; }
#dd-root .dd-shell { background: #f4e4bc url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/background/content.jpg'); border: 2px solid #805020; border-radius: 4px; }
#dd-root .dd-header { display: flex; justify-content: space-between; padding: 15px 20px; background: url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/screen/tableheader_bg3.png') repeat-x; border-bottom: 2px solid #805020; }
#dd-root h3 { margin: 0; font-size: 20px; font-weight: bold; }
#dd-root .dd-stamp { background: #fff5da; border: 1px solid #805020; padding: 6px; font-weight: bold; }
#dd-root .dd-topbar { display: flex; justify-content: space-between; padding: 10px 20px; background: #e3d5b3; border-bottom: 1px solid #805020; }
#dd-root .dd-pill { background: #fff; border: 1px solid #805020; padding: 5px 8px; margin-right: 5px; display: inline-block; }
#dd-root .dd-btn { height: 30px; border: 1px solid #805020; cursor: pointer; font-weight: bold; padding: 0 10px; }
#dd-root .dd-btn-primary { background: #5865F2; color: #fff; }
#dd-root .dd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 15px 20px; }
#dd-root .dd-panel { background: #fff5da; border: 1px solid #805020; padding: 12px; }
#dd-root .dd-panel-head { border-bottom: 1px solid #805020; margin-bottom: 10px; padding-bottom: 5px; }
#dd-root .dd-def-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
#dd-root .dd-unit-card { background: #e3d5b3; border: 1px solid #805020; padding: 5px; text-align: center; }
#dd-root .dd-unit-value { font-weight: bold; font-size: 13px; }
#dd-root .dd-unit-name { font-size: 9px; color: #805020; font-weight: bold; }
#dd-root .dd-panel-bb { margin: 0 20px 15px; padding: 10px; background: #fff5da; border: 1px solid #805020; }
#dd-root textarea { width: 100%; height: 60px; border: 1px solid #805020; font-size: 11px; }
#dd-root .dd-footer { text-align: right; padding: 0 20px 10px; font-size: 10px; font-weight: bold; color: #805020; }
</style>`;

            Dialog.show(DIALOG_ID, html, Dialog.close());
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');
            $('#dd-send-discord').on('click', () => this.#sendToDiscord(total));
            $('#dd-refresh').on('click', () => { Dialog.close(); this.init(); });
            $('#dd-copy-bbcode').on('click', () => { $('#dd-bbcode-area').select(); document.execCommand('copy'); UI.SuccessMessage(t.bbCopied); });
        }

        #getServerTime() { return $('#serverDate').text() + ' ' + $('#serverTime').text(); }
        
        #getTroopsBBCode(total) {
            let bb = `[b]Contagem (${this.#getServerTime()})[/b]\n`;
            $.each(total, (u, v) => { bb += `[unit]${u}[/unit] [b]${this.#formatNumber(v)}[/b]\n`; });
            return bb;
        }

        #sendToDiscord(total) {
            if (!webhookURL || !webhookURL.startsWith('https://discord')) { alert("Erro: Webhook inválido!"); return; }
            const data = {
                content: `**Tropas de ${game_data.player.name}**\nData: ${this.#getServerTime()}`,
                embeds: [{
                    title: "⚔️ Resumo de Combate",
                    color: 15158332,
                    fields: [
                        { name: "🛡️ Defesa", value: `Lanc: ${total.spear}\nEsp: ${total.sword}\nPesada: ${total.heavy}`, inline: true },
                        { name: "⚔️ Ataque", value: `Bárbaros: ${total.axe}\nLeve: ${total.light}\nAríetes: ${total.ram}`, inline: true }
                    ]
                }]
            };
            $.ajax({ url: webhookURL, method: 'POST', contentType: 'application/json', data: JSON.stringify(data), success: () => alert("Enviado!"), error: () => alert("Erro!") });
        }

        async changeGroup(obj) {
            await $.get(this.#generateUrl('overview_villages', null, { group: obj.value }));
            game_data.group_id = obj.value;
            this.init();
        }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
