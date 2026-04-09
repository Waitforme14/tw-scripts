(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'defesa_disponivel_v3';
    var DIALOG_ID = 'defesa_disponivel_dialog_v3';

    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                pt_PT: {
                    title: 'Contador de Tropas (Ofensiva e Defensiva)',
                    subtitle: 'Relatório Militar Detalhado',
                    home: 'Em casa',
                    scavenging: 'Em busca',
                    total: 'Total',
                    defensiveTotal: '🛡️ PODER DEFENSIVO',
                    offensiveTotal: '⚔️ PODER OFENSIVO',
                    group: 'Grupo',
                    player: 'Jogador',
                    server: 'Mundo',
                    refresh: 'Atualizar',
                    sendDiscord: 'Enviar para Discord',
                    noGroup: 'Todos',
                    copy: 'Copiar',
                    bbCopied: 'BBCode copiado!',
                    summaryTotal: 'Resumo de Unidades',
                    credits: 'Script Engine: JDi4s | Mod Visual: Waitforme'
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
        }

        async init() {
            if (!game_data.features.Premium.active) { UI.ErrorMessage("Conta Premium necessária!"); return; }
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
            return url;
        }

        #fetchHtmlPage(url) {
            let tempData = null;
            $.ajax({ async: false, url: url, type: 'GET', success: data => { tempData = data; } });
            return tempData;
        }

        async #getTroopsScavengingWorldObj() {
            const troopsObj = { villagesTroops: {}, scavengingTroops: {} };
            this.availableUnits.forEach(u => { troopsObj.villagesTroops[u] = 0; troopsObj.scavengingTroops[u] = 0; });
            let currentPage = 0; let lastRunTime = null;
            do {
                await this.#waitMilliseconds(lastRunTime, 200);
                const html = this.#fetchHtmlPage(this.#generateUrl('place', 'scavenge_mass', { page: currentPage }));
                if (!html) break;
                const matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
                if (!matches) break;
                let json = JSON.parse(matches[1].substring(matches[1].indexOf('['), matches[1].length - 2));
                if (json.length === 0) break;
                lastRunTime = Date.now();
                $.each(json, (_, vData) => {
                    $.each(vData.unit_counts_home || {}, (k, v) => { if (this.availableUnits.includes(k)) troopsObj.villagesTroops[k] += v; });
                    $.each(vData.options || [], (_, opt) => { if (opt.scavenging_squad) $.each(opt.scavenging_squad.unit_counts || {}, (k, v) => { if (this.availableUnits.includes(k)) troopsObj.scavengingTroops[k] += v; }); });
                });
                currentPage++;
            } while (true);
            return troopsObj;
        }

        async #getTroopsNonScavengingWorldObj() {
            const troopsObj = { villagesTroops: {}, scavengingTroops: {} };
            this.availableUnits.forEach(u => { troopsObj.villagesTroops[u] = 0; troopsObj.scavengingTroops[u] = 0; });
            let currentPage = 0;
            await this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', { action: 'change_page_size', page_size: 1000, h: game_data.csrf }));
            do {
                const rawPage = this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', { page: currentPage }));
                const overviewTroopsPage = $.parseHTML(rawPage);
                const rows = $(overviewTroopsPage).find('#units_table tbody tr');
                if (!rows.length) break;
                const headers = $(overviewTroopsPage).find('#units_table thead th img');
                rows.each((_, row) => {
                    if ($(row).find('td').length < 5) return;
                    headers.each((idx, img) => {
                        const unitName = $(img).attr('src').match(/unit_(\w+)/)[1];
                        if (this.availableUnits.includes(unitName)) {
                            const val = parseInt($(row).find('td').eq(idx+2).text().trim(), 10) || 0;
                            troopsObj.villagesTroops[unitName] += val;
                        }
                    });
                });
                currentPage++;
            } while (currentPage < 1); // Simplificado para teste
            return troopsObj;
        }

        #formatNumber(value) { return new Intl.NumberFormat('pt-PT').format(Number(value || 0)); }

        // --- FUNÇÃO DE ENVIO TOTALMENTE REESCRITA COM DUAS ZONAS ---
        #triggerDiscordReport(total) {
            if (!webhookURL) { alert("Configura o Webhook na barra!"); return; }

            const msgData = {
                content: `🚀 **RELATÓRIO MILITAR ATUALIZADO**\n**Jogador:** ${game_data.player.name} | **Mundo:** ${game_data.world}`,
                embeds: [
                    {
                        title: "🛡️ TROPAS DEFENSIVAS",
                        color: 2123412, // Azul Escuro
                        fields: [
                            { name: "Lanceiros", value: `🛡️ ${this.#formatNumber(total.spear)}`, inline: true },
                            { name: "Espadachins", value: `⚔️ ${this.#formatNumber(total.sword)}`, inline: true },
                            { name: "C. Pesada", value: `🏇 ${this.#formatNumber(total.heavy)}`, inline: true },
                            { name: "Catapultas", value: `☄️ ${this.#formatNumber(total.catapult)}`, inline: true },
                            { name: "Paladino", value: `👑 ${this.#formatNumber(total.knight || 0)}`, inline: true }
                        ]
                    },
                    {
                        title: "⚔️ TROPAS OFENSIVAS",
                        color: 13711669, // Vermelho Escuro
                        fields: [
                            { name: "Vikings", value: `🪓 ${this.#formatNumber(total.axe)}`, inline: true },
                            { name: "Batedores", value: `👁️ ${this.#formatNumber(total.spy)}`, inline: true },
                            { name: "C. Leve", value: `🐎 ${this.#formatNumber(total.light)}`, inline: true },
                            { name: "Aríetes", value: `🪵 ${this.#formatNumber(total.ram)}`, inline: true },
                            { name: "Catapultas", value: `☄️ ${this.#formatNumber(total.catapult)}`, inline: true },
                            { name: "Paladino", value: `👑 ${this.#formatNumber(total.knight || 0)}`, inline: true }
                        ],
                        footer: { text: `Data: ${$('#serverDate').text()} ${$('#serverTime').text()}` }
                    }
                ]
            };

            $('#btn-send-discord-v3').text('⏳ Enviando...').prop('disabled', true);
            $.ajax({
                url: webhookURL,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(msgData),
                success: () => { alert("Sucesso! Relatório enviado em 2 zonas."); $('#btn-send-discord-v3').text('Enviar para Discord').prop('disabled', false); },
                error: () => { alert("Erro ao enviar."); $('#btn-send-discord-v3').text('Enviar para Discord').prop('disabled', false); }
            });
        }

        async #createUI() {
            const troopsObj = this.isScavengingWorld ? await this.#getTroopsScavengingWorldObj() : await this.#getTroopsNonScavengingWorldObj();
            const total = {};
            this.availableUnits.forEach(u => { total[u] = (troopsObj.villagesTroops[u] || 0) + (troopsObj.scavengingTroops[u] || 0); });

            const t = this.UserTranslation;
            const groupsArr = {};
            const groupHtmlRaw = this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', { type: 'static' }));
            $($.parseHTML(groupHtmlRaw)).find('.vis_item a, .vis_item strong').each((_, g) => {
                const name = $(g).text().trim();
                groupsArr[$(g).attr('data-group-id')] = name.substring(1, name.length - 1);
            });

            const renderCard = (unit, val, label) => `
                <div class="dd-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="dd-unit-value">${this.#formatNumber(val)}</div>
                    <div class="dd-unit-name">${label}</div>
                </div>`;

            const html = `
<div id="dd-root-v3">
    <div class="dd-shell">
        <div class="dd-header"><h3>${t.title}</h3></div>
        <div class="dd-topbar">
            <strong>${game_data.player.name} | ${game_data.world}</strong>
            <div class="dd-actions">
                <button id="btn-refresh-v3" class="dd-btn">🔄 ${t.refresh}</button>
                <button id="btn-send-discord-v3" class="dd-btn" style="background:#5865F2;color:#fff;">📤 ${t.sendDiscord}</button>
            </div>
        </div>
        <div class="dd-grid">
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('spear', total.spear, 'Lanças')} ${renderCard('sword', total.sword, 'Espadas')}
                    ${renderCard('heavy', total.heavy, 'Pesada')} ${renderCard('catapult', total.catapult, 'Catas')}
                    ${this.availableUnits.includes('knight') ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
            </div>
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.offensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('axe', total.axe, 'Vikings')} ${renderCard('spy', total.spy, 'Batedor')}
                    ${renderCard('light', total.light, 'Leve')} ${renderCard('ram', total.ram, 'Aríete')}
                    ${renderCard('catapult', total.catapult, 'Catas')} ${this.availableUnits.includes('knight') ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
            </div>
        </div>
        <div class="dd-footer">${t.credits}</div>
    </div>
</div>
<style>
#dd-root-v3 { color: #302010; font-family: Verdana; padding: 10px; min-width: 800px; background: #f4e4bc url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/background/content.jpg'); border: 2px solid #805020; border-radius: 4px; }
.dd-header { background: #c1a264 url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/screen/tableheader_bg3.png'); border-bottom: 2px solid #805020; padding: 10px; text-align: center; }
.dd-topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #e3d5b3; border-bottom: 1px solid #805020; }
.dd-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 15px; padding: 15px; }
.dd-panel { background: #fff5da; border: 1px solid #805020; padding: 10px; border-radius: 4px; }
.dd-panel-head { border-bottom: 1px solid #d0b888; margin-bottom: 10px; font-weight: bold; }
.dd-def-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.dd-unit-card { background: #e3d5b3; border: 1px solid #805020; padding: 5px; text-align: center; border-radius: 3px; }
.dd-unit-value { font-size: 13px; font-weight: bold; }
.dd-unit-name { font-size: 9px; text-transform: uppercase; font-weight: bold; }
.dd-btn { cursor: pointer; padding: 5px 10px; border: 1px solid #805020; font-weight: bold; border-radius: 3px; }
.dd-footer { text-align: right; font-size: 10px; margin-top: 10px; font-weight: bold; }
</style>`;

            Dialog.show(DIALOG_ID, html);
            $('#btn-send-discord-v3').on('click', () => this.#triggerDiscordReport(total));
            $('#btn-refresh-v3').on('click', () => { Dialog.close(); this.init(); });
        }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
