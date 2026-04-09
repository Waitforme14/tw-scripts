(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'defesa_disponivel_vFinal';
    var DIALOG_ID = 'defesa_disponivel_dialog_final';

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
                    credits: 'Script Engine: JDi4s | Visual: Tribal Wars Classic'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            // Bloqueio de arqueiros
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (Array.isArray(game_data.units) ? [...game_data.units] : []).filter(u => !forbidden.includes(u));
            this.isScavengingWorld = false;
        }

        async init() {
            const xml = $.ajax({ async: false, url: '/interface.php?func=get_config', type: 'GET' }).responseText;
            this.isScavengingWorld = $($.parseXML(xml)).find('scavenging').text() === '1';
            await this.#createUI();
        }

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

        #formatNumber(value) { return new Intl.NumberFormat('pt-PT').format(Number(value || 0)); }

        async #getTroopsData() {
            const troopsObj = { villages: {}, scavenging: {} };
            this.availableUnits.forEach(u => { troopsObj.villages[u] = 0; troopsObj.scavenging[u] = 0; });

            const html = $.ajax({ async: false, url: this.#generateUrl('overview_villages', 'units'), type: 'GET' }).responseText;
            const rows = $($.parseHTML(html)).find('#units_table tbody tr');
            
            rows.each((_, row) => {
                const text = $(row).text().toLowerCase();
                const isHome = text.includes('próprias');
                const isScav = text.includes('buscas');
                if (!isHome && !isScav) return;

                $(row).find('td:gt(1)').each((idx, td) => {
                    const unit = game_data.units[idx];
                    if (this.availableUnits.includes(unit)) {
                        const val = parseInt($(td).text().trim().replace(/\./g, ''), 10) || 0;
                        if (isHome) troopsObj.villages[unit] += val;
                        if (isScav) troopsObj.scavenging[unit] += val;
                    }
                });
            });
            return troopsObj;
        }

        #sendToDiscordEnhanced(total) {
            if (!webhookURL) { alert("Configura o Webhook!"); return; }
            const payload = {
                content: `📊 **RELATÓRIO MILITAR - ${game_data.player.name}**`,
                embeds: [
                    {
                        title: "🛡️ TROPAS DEFENSIVAS",
                        color: 3447003,
                        fields: [{ name: "Unidades", value: `🛡️ **Lanças:** ${this.#formatNumber(total.spear)}\n⚔️ **Espadas:** ${this.#formatNumber(total.sword)}\n🏇 **Pesada:** ${this.#formatNumber(total.heavy)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }]
                    },
                    {
                        title: "⚔️ TROPAS OFENSIVAS",
                        color: 15158332,
                        fields: [{ name: "Unidades", value: `🪓 **Vikings:** ${this.#formatNumber(total.axe)}\n👁️ **Batedor:** ${this.#formatNumber(total.spy)}\n🐎 **Leve:** ${this.#formatNumber(total.light)}\n🪵 **Aríete:** ${this.#formatNumber(total.ram)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }],
                        footer: { text: `Mundo: ${game_data.world} | Atualizado: ${$('#serverTime').text()}` }
                    }
                ]
            };
            $.post(webhookURL, JSON.stringify(payload)).done(() => alert("Enviado com sucesso em 2 zonas!"));
        }

        async #createUI() {
            const data = await this.#getTroopsData();
            const total = {};
            this.availableUnits.forEach(u => total[u] = data.villages[u] + data.scavenging[u]);
            const t = this.UserTranslation;

            const renderCard = (unit, val, label) => `
                <div class="dd-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="dd-unit-value">${this.#formatNumber(val)}</div>
                    <div class="dd-unit-name">${label}</div>
                </div>`;

            const html = `
<div id="dd-root">
    <div class="dd-shell">
        <div class="dd-header">
            <div><div class="dd-kicker">Tribal Wars</div><h3>${t.title}</h3></div>
            <div class="dd-stamp">${$('#serverDate').text()} ${$('#serverTime').text()}</div>
        </div>
        <div class="dd-topbar">
            <strong>${game_data.player.name} | ${game_data.world}</strong>
            <div class="dd-actions">
                <button id="dd-refresh" class="dd-btn">🔄 ${t.refresh}</button>
                <button id="dd-send-discord" class="dd-btn" style="background:#5865F2;color:#fff;">📤 ${t.sendDiscord}</button>
            </div>
        </div>
        <div class="dd-grid">
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('spear', total.spear, 'Lanças')} ${renderCard('sword', total.sword, 'Espadas')}
                    ${renderCard('heavy', total.heavy, 'Pesada')} ${renderCard('catapult', total.catapult, 'Catas')}
                    ${total.knight !== undefined ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
            </div>
            <div class="dd-panel">
                <div class="dd-panel-head"><h4>${t.offensiveTotal}</h4></div>
                <div class="dd-def-grid">
                    ${renderCard('axe', total.axe, 'Vikings')} ${renderCard('spy', total.spy, 'Batedor')}
                    ${renderCard('light', total.light, 'Leve')} ${renderCard('ram', total.ram, 'Aríete')}
                    ${renderCard('catapult', total.catapult, 'Catas')} ${total.knight !== undefined ? renderCard('knight', total.knight, 'Paladino') : ''}
                </div>
            </div>
        </div>
        <div class="dd-footer">${t.credits}</div>
    </div>
</div>
<style>
#dd-root { color: #302010; font-family: Verdana, sans-serif; font-size: 12px; }
.dd-shell { background: #f4e4bc url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/background/content.jpg'); border: 2px solid #805020; border-radius: 4px; overflow: hidden; }
.dd-header { display: flex; justify-content: space-between; padding: 15px; background: #c1a264 url('https://dspt.innogamescdn.com/asset/2a2f957f/graphic/screen/tableheader_bg3.png') repeat-x; border-bottom: 2px solid #805020; }
.dd-topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #e3d5b3; border-bottom: 1px solid #805020; }
.dd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 15px; }
.dd-panel { background: #fff5da; border: 1px solid #805020; padding: 12px; border-radius: 4px; }
.dd-panel-head { border-bottom: 1px solid #d0b888; margin-bottom: 10px; padding-bottom: 5px; }
.dd-panel-head h4 { margin: 0; color: #805020; font-size: 14px; }
.dd-def-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.dd-unit-card { background: #e3d5b3; border: 1px solid #805020; padding: 8px 4px; text-align: center; border-radius: 3px; }
.dd-unit-card img { width: 18px; height: 18px; margin-bottom: 4px; }
.dd-unit-value { font-size: 13px; font-weight: bold; }
.dd-unit-name { font-size: 9px; color: #805020; font-weight: bold; }
.dd-btn { height: 30px; padding: 0 12px; border: 1px solid #805020; cursor: pointer; font-weight: bold; background: #e3d5b3; }
.dd-footer { padding: 10px; text-align: right; font-size: 10px; font-weight: bold; color: #805020; }
</style>`;

            Dialog.show(DIALOG_ID, html);
            $('#dd-send-discord').on('click', () => this.#sendToDiscordEnhanced(total));
            $('#dd-refresh').on('click', () => { Dialog.close(); this.init(); });
        }
    }

    new VillagesTroopsCounter().init();
})();
