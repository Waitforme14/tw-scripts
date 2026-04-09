(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'militar_matrix_v1';
    var DIALOG_ID = 'militar_dialog_matrix';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                pt_PT: {
                    title: '> NUCLEO_MILITAR::CONTADOR_TROPAS',
                    subtitle: 'Análise de Poder Total [CASA + BUSCA]',
                    home: 'EM_CASA',
                    scavenging: 'EM_BUSCA',
                    total: 'TOTAL_SISTEMA',
                    defensiveTotal: '//_PODER_DEFENSIVO',
                    offensiveTotal: '//_PODER_OFENSIVO',
                    group: 'GRUPO',
                    player: 'OPERADOR',
                    server: 'MUNDO',
                    refresh: 'ATUALIZAR',
                    sendDiscord: 'TRANSMITIR_DISCORD',
                    noGroup: 'TODOS',
                    copy: 'COPIAR_BB',
                    bbCopied: 'BBCode copiado!',
                    summaryTotal: 'RESUMO_UNIDADES',
                    credits: 'Waitforme | UI Mod: Matrix Neon'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.pt_PT;
            // Bloqueio de arqueiros e milícia
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
                        color: 65280, // Verde Neon para o Discord
                        fields: [{ name: "STATUS", value: `🛡️ **Lanças:** ${this.#formatNumber(total.spear)}\n⚔️ **Espadas:** ${this.#formatNumber(total.sword)}\n🏇 **Pesada:** ${this.#formatNumber(total.heavy)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }]
                    },
                    {
                        title: "⚔️ NÚCLEO OFENSIVO",
                        color: 16711680, // Vermelho para o Discord (contraste)
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
                <div class="matrix-unit-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png">
                    <div class="matrix-unit-value">${this.#formatNumber(val)}</div>
                    <div class="matrix-unit-name">> ${label}</div>
                </div>`;

            const html = `
<div id="matrix-root">
    <div class="matrix-shell">
        <div class="matrix-header">
            <h3>${t.title}</h3>
            <div class="matrix-stamp">[${$('#serverDate').text()} ${$('#serverTime').text()}]</div>
        </div>
        <div class="matrix-topbar">
            <span>${t.player}: <strong>${game_data.player.name}</strong> | ${t.server}: <strong>${game_data.world}</strong></span>
            <div class="matrix-actions">
                <button id="matrix-refresh" class="matrix-btn">_ ${t.refresh}</button>
                <button id="matrix-send-discord" class="matrix-btn matrix-btn-discord">_ ${t.sendDiscord}</button>
            </div>
        </div>
        <div class="matrix-grid">
            <div class="matrix-panel matrix-panel-large">
                <div class="matrix-panel-head"><h4>> ${t.summaryTotal}</h4></div>
                <div class="matrix-table-wrap"><table class="matrix-table modern" width="100%"><thead>
                    <tr><th></th>${this.availableUnits.map(v => `<th class="center"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${v}.png"></th>`).join('')}</tr>
                </thead><tbody>
                    ${this.isScavengingWorld ? `<tr><td class="matrix-label">${t.home}</td>${this.availableUnits.map(u => `<td class="center">${this.#formatNumber(data.villages[u])}</td>`).join('')}</tr>` : ''}
                    ${this.isScavengingWorld ? `<tr><td class="matrix-label">${t.scavenging}</td>${this.availableUnits.map(u => `<td class="center">${this.#formatNumber(data.scavenging[u])}</td>`).join('')}</tr>` : ''}
                    <tr><td class="matrix-label matrix-total">${t.total}</td>${this.availableUnits.map(u => `<td class="center matrix-total">${this.#formatNumber(total[u])}</td>`).join('')}</tr>
                </tbody></table></div>
            </div>
            <div class="matrix-panel matrix-panel-small">
                <div class="matrix-panel-head"><h4>${t.defensiveTotal}</h4></div>
                <div class="matrix-def-grid">
                    ${renderCard('spear', total.spear, 'LANÇAS')} ${renderCard('sword', total.sword, 'ESPADAS')}
                    ${renderCard('heavy', total.heavy, 'PESADA')} ${renderCard('catapult', total.catapult, 'CATAS')}
                    ${renderCard('knight', total.knight || 0, 'PALADINO')}
                </div>
                <div class="matrix-panel-head" style="margin-top:15px;"><h4>${t.offensiveTotal}</h4></div>
                <div class="matrix-def-grid">
                    ${renderCard('axe', total.axe, 'VIKINGS')} ${renderCard('spy', total.spy, 'BATEDOR')}
                    ${renderCard('light', total.light, 'LEVE')} ${renderCard('ram', total.ram, 'ARÍETE')}
                    ${renderCard('catapult', total.catapult, 'CATAS')} ${renderCard('knight', total.knight || 0, 'PALADINO')}
                </div>
            </div>
        </div>
        <div class="matrix-bbcode-wrap"><button id="matrix-bbcode" class="matrix-btn">_ COPIAR_BBCODE</button><textarea id="matrix-textarea" readonly></textarea></div>
        <div class="matrix-footer">${t.credits}</div>
    </div>
</div>
<style>
/* Reset Global do Popup */
.popup_box_content { min-width: 900px !important; background: transparent !important; padding: 0 !important; border: none !important; }
.popup_box_close { background-color: #00ff00 !important; border-radius: 0 !important; }

/* Visual Matrix Neon */
#matrix-root { color: #00ff00; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; background-color: #0a0a0a; }
.matrix-shell { border: 2px solid #00ff00; border-radius: 0; box-shadow: 0 0 15px rgba(0, 255, 0, 0.6); overflow: hidden; }
.matrix-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: #161616; border-bottom: 2px solid #00ff00; }
.matrix-header h3 { margin: 0; font-size: 18px; color: #00ff00; font-weight: bold; text-transform: uppercase; text-shadow: 0 0 5px #00ff00; }
.matrix-stamp { color: #008800; font-size: 11px; }
.matrix-topbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; background: #000; border-bottom: 1px solid #00ff00; color: #00aa00; }
.matrix-pill strong { color: #00ff00; text-shadow: 0 0 3px #00ff00; }

/* Botões Neon */
.matrix-btn { height: 28px; padding: 0 12px; border: 1px solid #00ff00; cursor: pointer; font-weight: bold; background: #000; color: #00ff00; font-family: inherit; font-size: 11px; text-transform: uppercase; transition: all 0.2s; }
.matrix-btn:hover { background: #003300; box-shadow: 0 0 10px #00ff00; }
.matrix-btn-discord { border-color: #5865F2; color: #5865F2; }
.matrix-btn-discord:hover { background: #1a1d3a; box-shadow: 0 0 10px #5865F2; }

/* Grelha e Painéis */
.matrix-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 15px; padding: 15px; }
.matrix-panel { background: #111; border: 1px solid #00aa00; padding: 10px; }
.matrix-panel:hover { border-color: #00ff00; box-shadow: 0 0 8px rgba(0, 255, 0, 0.3); }
.matrix-panel-head { border-bottom: 1px solid #00ff00; margin-bottom: 10px; padding-bottom: 3px; }
.matrix-panel-head h4 { margin: 0; color: #00ff00; font-size: 13px; text-transform: uppercase; text-shadow: 0 0 3px #00ff00; }

/* Tabela Matrix */
.matrix-table { border-collapse: collapse; background: #000; border: 1px solid #008800; }
.matrix-table th { background: #161616 !important; border: 1px solid #008800; padding: 5px; color: #00ff00; }
.matrix-table td { border: 1px solid #004400; padding: 6px; text-align: center; color: #00cc00; }
.matrix-label { text-align: left !important; color: #00aa00; font-weight: bold; }
.matrix-total { color: #00ff00 !important; font-weight: bold; background: #001100; text-shadow: 0 0 3px #00ff00; }

/* Cartas Matrix */
.matrix-def-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.matrix-unit-card { background: #000; border: 1px solid #00aa00; padding: 5px 2px; text-align: center; transition: all 0.2s; }
.matrix-unit-card:hover { border-color: #00ff00; box-shadow: 0 0 5px #00ff00; background: #001100; }
.matrix-unit-card img { width: 16px; height: 16px; margin-bottom: 3px; filter: sepia(100%) saturate(300%) hue-rotate(80deg); /* Efeito verde nas imagens */ }
.matrix-unit-value { font-size: 13px; font-weight: bold; color: #00ff00; text-shadow: 0 0 3px #00ff00; }
.matrix-unit-name { font-size: 9px; color: #00aa00; font-weight: bold; text-transform: uppercase; }

/* BBCode */
.matrix-bbcode-wrap { padding: 0 15px 15px; display: flex; flex-direction: column; gap: 5px; }
.matrix-bbcode-wrap textarea { background: #000; border: 1px solid #008800; color: #00cc00; font-family: inherit; font-size: 11px; height: 40px; padding: 5px; resize: none; }
.matrix-bbcode-wrap textarea:focus { border-color: #00ff00; outline: none; }

.matrix-footer { padding: 8px 15px; text-align: right; font-size: 10px; font-weight: bold; color: #006600; border-top: 1px solid #004400; background: #161616; }
</style>`;

            Dialog.show(DIALOG_ID, html);
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');

            // Gerar BBCode Filtrado
            let bbCode = `[b]SISTEMA::RELATÓRIO_MILITAR [${$('#serverTime').text()}]
[b]OPERADOR:[/b] ${game_data.player.name}
[b]MUNDO:[/b] ${game_data.world}
----------------------------------
`;
            const labels = { spear: 'Lanças', sword: 'Espadas', axe: 'Vikings', spy: 'Batedor', light: 'Leve', heavy: 'Pesada', ram: 'Aríete', catapult: 'Catas', knight: 'Paladino', snob: 'Nobres' };
            Object.entries(total).forEach(([k, v]) => { if(this.availableUnits.includes(k) && v > 0) bbCode += `[unit]${k}[/unit] [b]${this.#formatNumber(v)}[/b] ${labels[k] || k}\n`; });
            $('#matrix-textarea').val(bbCode);

            // Eventos
            $('#matrix-send-discord').on('click', () => this.#sendToDiscordEnhanced(total));
            $('#matrix-refresh').on('click', () => { Dialog.close(); this.init(); });
            $('#matrix-bbcode').on('click', () => { $('#matrix-textarea').select(); document.execCommand('copy'); UI.SuccessMessage("BBCODE COPIADO!"); });
        }
    }

    new VillagesTroopsCounter().init();
})();
