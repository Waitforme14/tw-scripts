(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'militar_neon_final_v1';
    var DIALOG_ID = 'militar_dialog_neon_v1';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                pt_PT: {
                    title: 'SISTEMA MILITAR :: HUD',
                    subtitle: 'Análise de Poder Total [CASA + BUSCA]',
                    home: 'ALDEIAS',
                    scavenging: 'BUSCAS',
                    total: 'SOMA TOTAL',
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
                    credits: 'Script Engine: JDi4s | UI Mod: Gamer Neon Arredondado'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = Array.isArray(game_data.units) ? [...game_data.units] : [];
            this.availableUnits = this.availableUnits.filter(u => !forbidden.includes(u));
            this.worldConfig = null;
            this.isScavengingWorld = false;
        }

        async init() {
            if (!game_data.features.Premium.active) { UI.ErrorMessage("CONTA PREMIUM NECESSÁRIA!"); return; }
            await this.#initWorldConfig();
            await this.#createUI();
        }

        async #initWorldConfig() {
            const xml = $.ajax({ async: false, url: '/interface.php?func=get_config', type: 'GET' }).responseText;
            this.worldConfig = $.parseXML(xml);
            try { this.isScavengingWorld = this.worldConfig.getElementsByTagName('scavenging')[0].textContent === '1'; } catch (e) { throw e; }
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;
            $.each(extraParams, function (key, value) { url += `&${key}=${value}`; });
            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
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
            if (!webhookURL) { alert("CONFIGURA O WEBHOOK!"); return; }
            const payload = {
                content: `📶 **TRANSMISSÃO MILITAR - ${game_data.player.name}** (Mundo: ${game_data.world})`,
                embeds: [
                    {
                        title: "🛡️ NÚCLEO DEFENSIVO",
                        color: 3447003,
                        fields: [{ name: "STATUS", value: `🛡️ **Lanças:** ${this.#formatNumber(total.spear)}\n⚔️ **Espadas:** ${this.#formatNumber(total.sword)}\n🏇 **Pesada:** ${this.#formatNumber(total.heavy)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }]
                    },
                    {
                        title: "⚔️ NÚCLEO OFENSIVO",
                        color: 15158332,
                        fields: [{ name: "STATUS", value: `🪓 **Vikings:** ${this.#formatNumber(total.axe)}\n👁️ **Batedor:** ${this.#formatNumber(total.spy)}\n🐎 **Leve:** ${this.#formatNumber(total.light)}\n🪵 **Aríete:** ${this.#formatNumber(total.ram)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }],
                        footer: { text: `Grupo: ${$('.vis_item strong').text() || 'Todos'} | SINC: ${$('#serverTime').text()}` }
                    }
                ]
            };
            $.post(webhookURL, JSON.stringify(payload)).done(() => alert("DADOS TRANSMITIDOS!"));
        }

        async #createUI() {
            const data = await this.#getTroopsData();
            const total = {};
            this.availableUnits.forEach(u => total[u] = data.villages[u] + data.scavenging[u]);
            const t = this.UserTranslation;

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
                <span class="neon-status-dot"></span>
                <h3>${t.title}</h3>
                <p>${t.subtitle}</p>
            </div>
            <div class="neon-stamp">[ ${$('#serverDate').text()} ${$('#serverTime').text()} ]</div>
        </div>
        <div class="neon-topbar">
            <span>${t.player}: <strong>${game_data.player.name}</strong> | ${t.server}: <strong>${game_data.world}</strong></span>
            <div class="neon-actions">
                <button id="neon-refresh" class="neon-btn">🔄 ${t.refresh}</button>
                <button id="neon-send-discord" class="neon-btn neon-btn-discord">📡 ${t.sendDiscord}</button>
            </div>
        </div>
        <div class="neon-grid">
            <div class="neon-panel neon-panel-large">
                <div class="neon-panel-head"><h4>${t.summaryTotal}</h4></div>
                <div class="neon-table-wrap">
                    <table class="neon-table" width="100%">
                        <thead>
                            <tr>
                                <th>ORIGEM</th>
                                ${this.availableUnits.map(v => `<th class="center"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${v}.png"></th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.isScavengingWorld ? `<tr><td class="neon-label">${t.home}</td>${this.availableUnits.map(u => `<td>${this.#formatNumber(data.villages[u])}</td>`).join('')}</tr>` : ''}
                            ${this.isScavengingWorld ? `<tr><td class="neon-label">${t.scavenging}</td>${this.availableUnits.map(u => `<td>${this.#formatNumber(data.scavenging[u])}</td>`).join('')}</tr>` : ''}
                            <tr class="neon-total-row"><td class="neon-label">${t.total}</td>${this.availableUnits.map(u => `<td>${this.#formatNumber(total[u])}</td>`).join('')}</tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="neon-panel neon-panel-small">
                <div class="neon-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="neon-def-grid">
                    ${renderCard('spear', total.spear, 'LANÇAS')} ${renderCard('sword', total.sword, 'ESPADAS')}
                    ${renderCard('heavy', total.heavy, 'PESADA')} ${renderCard('catapult', total.catapult, 'CATAS')}
                    ${total.knight !== undefined ? renderCard('knight', total.knight, 'PALADINO') : ''}
                </div>
                <div class="neon-panel-head" style="margin-top:20px;"><h4>${t.offensiveTotal}</h4></div>
                <div class="neon-def-grid">
                    ${renderCard('axe', total.axe, 'VIKINGS')} ${renderCard('spy', total.spy, 'BATEDOR')}
                    ${renderCard('light', total.light, 'LEVE')} ${renderCard('ram', total.ram, 'ARÍETE')}
                    ${renderCard('catapult', total.catapult, 'CATAS')}
                </div>
            </div>
        </div>
        <div class="neon-bbcode-wrap">
            <button id="neon-bbcode" class="neon-btn">📋 ${t.copy}</button>
            <textarea id="neon-textarea" readonly></textarea>
        </div>
        <div class="neon-footer">${t.credits}</div>
    </div>
</div>
<style>
/* POPUP RESET */
.popup_box_content { min-width: 950px !important; background: transparent !important; padding: 0 !important; border: none !important; }
.popup_box_close { background-color: #00ff88 !important; border-radius: 50% !important; margin: 10px !important; }

/* NEON GAMER DESIGN */
#neon-root { color: #ccffeb; font-family: 'Segoe UI', sans-serif; background-color: #080808; padding: 10px; border-radius: 20px; }
.neon-shell { border: 2px solid #00ff88; border-radius: 20px; box-shadow: 0 0 25px rgba(0, 255, 136, 0.2); overflow: hidden; background: #0a0a0a; }

.neon-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: #121212; border-bottom: 2px solid #00ff88; }
.neon-title-box h3 { margin: 0; font-size: 20px; color: #00ff88; font-weight: 900; letter-spacing: 1px; }
.neon-title-box p { margin: 0; font-size: 10px; color: #008855; font-weight: bold; }
.neon-status-dot { display: inline-block; width: 8px; height: 8px; background: #00ff88; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 8px #00ff88; }

.neon-topbar { display: flex; justify-content: space-between; align-items: center; padding: 10px 25px; background: #000; border-bottom: 1px solid #1a3a2a; font-size: 12px; }

/* BUTTONS */
.neon-btn { height: 30px; padding: 0 15px; border: 1px solid #00ff88; cursor: pointer; font-weight: bold; border-radius: 15px; background: #000; color: #00ff88; font-size: 11px; transition: 0.3s; }
.neon-btn:hover { background: #00ff88; color: #000; box-shadow: 0 0 12px #00ff88; }
.neon-btn-discord { border-color: #00d9ff; color: #00d9ff; }
.neon-btn-discord:hover { background: #00d9ff; color: #000; box-shadow: 0 0 12px #00d9ff; }

/* GRID & PANELS */
.neon-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; padding: 20px; }
.neon-panel { background: #121212; border: 1px solid #1a3a2a; padding: 15px; border-radius: 18px; }
.neon-panel-head h4 { margin: 0 0 15px 0; color: #00ff88; font-size: 13px; text-transform: uppercase; border-left: 3px solid #00ff88; padding-left: 10px; }

/* TABLE */
.neon-table-wrap { border-radius: 12px; overflow: hidden; border: 1px solid #1a3a2a; }
.neon-table { border-collapse: collapse; background: #000; }
.neon-table th { background: #181818 !important; padding: 10px; color: #00ff88; border: 1px solid #1a3a2a; }
.neon-table td { padding: 10px; text-align: center; border: 1px solid #1a3a2a; }
.neon-label { text-align: left !important; font-weight: bold; color: #008855; padding-left: 15px !important; }
.neon-total-row { background: #001a0d; color: #00ff88; font-weight: bold; }

/* UNIT CARDS */
.neon-def-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.neon-unit-card { background: #1a1a1a; border: 1px solid #222; padding: 10px 5px; text-align: center; border-radius: 15px; transition: 0.3s; }
.neon-unit-card:hover { border-color: #00ff88; background: #002211; transform: translateY(-3px); }
.neon-unit-card img { width: 22px; height: 22px; margin-bottom: 5px; }
.neon-unit-value { font-size: 14px; font-weight: bold; color: #fff; }
.neon-unit-name { font-size: 8px; color: #008855; font-weight: bold; text-transform: uppercase; }

/* BBCODE */
.neon-bbcode-wrap { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 10px; }
.neon-bbcode-wrap textarea { background: #000; border: 1px solid #1a3a2a; color: #ccffeb; font-family: monospace; font-size: 11px; height: 45px; padding: 10px; border-radius: 12px; resize: none; }

.neon-footer { padding: 10px 25px; text-align: right; font-size: 10px; font-weight: bold; color: #004422; border-top: 1px solid #1a3a2a; }
</style>`;

            Dialog.show(DIALOG_ID, html);
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');

            // Gerar BBCode
            let bbCode = `[b]HUD_MILITAR_REPORT [${$('#serverTime').text()}]
[b]OPERADOR:[/b] ${game_data.player.name}
----------------------------------
`;
            const labels = { spear: 'Lanças', sword: 'Espadas', axe: 'Vikings', spy: 'Batedor', light: 'Leve', heavy: 'Pesada', ram: 'Aríete', catapult: 'Catas', knight: 'Paladino' };
            Object.entries(total).forEach(([k, v]) => { if(this.availableUnits.includes(k) && v > 0) bbCode += `[unit]${k}[/unit] [b]${this.#formatNumber(v)}[/b] ${labels[k] || k}\n`; });
            $('#neon-textarea').val(bbCode);

            $('#neon-send-discord').on('click', () => this.#sendToDiscordEnhanced(total));
            $('#neon-refresh').on('click', () => { Dialog.close(); this.init(); });
            $('#neon-bbcode').on('click', () => { $('#neon-textarea').select(); document.execCommand('copy'); UI.SuccessMessage(t.bbCopied); });
        }
    }

    new VillagesTroopsCounter().init();
})();
