(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'neon_militar_final_v5';
    var DIALOG_ID = 'dialog_neon_v5';

    // Limpeza radical de instâncias anteriores
    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    
    class MilitarNeonGamer {
        constructor() {
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (game_data.units || []).filter(u => !forbidden.includes(u));
            this.isScavengingWorld = false;
        }

        async init() {
            const xml = $.ajax({ async: false, url: '/interface.php?func=get_config', type: 'GET' }).responseText;
            this.isScavengingWorld = $($.parseXML(xml)).find('scavenging').text() === '1';
            await this.#createUI();
        }

        #formatNumber(v) { return new Intl.NumberFormat('pt-PT').format(v || 0); }

        async #getTroopsData() {
            const troops = { v: {}, s: {} };
            this.availableUnits.forEach(u => { troops.v[u] = 0; troops.s[u] = 0; });
            const html = $.ajax({ async: false, url: `/game.php?village=${game_data.village.id}&screen=overview_villages&mode=units`, type: 'GET' }).responseText;
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
                        if (isHome) troops.v[unit] += val;
                        if (isScav) troops.s[unit] += val;
                    }
                });
            });
            return troops;
        }

        #sendToDiscord(total) {
            const payload = {
                content: `🚀 **MILITAR HUD ATUALIZADO - ${game_data.player.name}**`,
                embeds: [
                    {
                        title: "🛡️ SETOR DEFENSIVO",
                        color: 5763719, // Verde Esmeralda
                        fields: [{ name: "STATUS", value: `🛡️ **Lanças:** ${this.#formatNumber(total.spear)}\n⚔️ **Espadas:** ${this.#formatNumber(total.sword)}\n🏇 **Pesada:** ${this.#formatNumber(total.heavy)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }]
                    },
                    {
                        title: "⚔️ SETOR OFENSIVO",
                        color: 15548997, // Vermelho Neon
                        fields: [{ name: "STATUS", value: `🪓 **Vikings:** ${this.#formatNumber(total.axe)}\n👁️ **Batedor:** ${this.#formatNumber(total.spy)}\n🐎 **Leve:** ${this.#formatNumber(total.light)}\n🪵 **Aríete:** ${this.#formatNumber(total.ram)}\n☄️ **Catas:** ${this.#formatNumber(total.catapult)}\n👑 **Paladino:** ${this.#formatNumber(total.knight || 0)}`, inline: true }],
                        footer: { text: `Mundo: ${game_data.world} | ${$('#serverTime').text()}` }
                    }
                ]
            };
            $.post(webhookURL, JSON.stringify(payload)).done(() => UI.SuccessMessage("TRANSMISSÃO CONCLUÍDA"));
        }

        async #createUI() {
            const data = await this.#getTroopsData();
            const total = {};
            this.availableUnits.forEach(u => total[u] = data.v[u] + data.s[u]);

            const renderCard = (u, v, l) => `
                <div class="n-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${u}.png">
                    <div class="n-val">${this.#formatNumber(v)}</div>
                    <div class="n-name">${l}</div>
                </div>`;

            const html = `
<div id="neon-hud">
    <div class="n-shell">
        <div class="n-header">
            <h3><span class="blink">●</span> NÚCLEO MILITAR :: HUD</h3>
            <div class="n-clock">[ ${$('#serverTime').text()} ]</div>
        </div>
        <div class="n-topbar">
            <span>OPERADOR: <strong style="color:#00ff88;">${game_data.player.name}</strong></span>
            <div class="n-actions">
                <button id="n-ref" class="n-btn">ATUALIZAR</button>
                <button id="n-disc" class="n-btn n-btn-discord">TRANSMITIR</button>
            </div>
        </div>
        <div class="n-main">
            <div class="n-panel">
                <div class="n-title">🛡️ PODER DEFENSIVO</div>
                <div class="n-grid">
                    ${renderCard('spear', total.spear, 'LANÇAS')} ${renderCard('sword', total.sword, 'ESPADA')}
                    ${renderCard('heavy', total.heavy, 'PESADA')} ${renderCard('catapult', total.catapult, 'CATAS')}
                    ${renderCard('knight', total.knight, 'PALADINO')}
                </div>
            </div>
            <div class="n-panel">
                <div class="n-title">⚔️ PODER OFENSIVO</div>
                <div class="n-grid">
                    ${renderCard('axe', total.axe, 'VIKING')} ${renderCard('spy', total.spy, 'BATEDOR')}
                    ${renderCard('light', total.light, 'LEVE')} ${renderCard('ram', total.ram, 'ARÍETE')}
                    ${renderCard('catapult', total.catapult, 'CATAS')}
                </div>
            </div>
        </div>
    </div>
</div>
<style>
#popup_box_neon { background: transparent !important; border: none !important; }
#neon-hud { color: #e0fff0; font-family: 'Segoe UI', sans-serif; background: #080808; padding: 12px; border-radius: 18px; min-width: 750px; }
.n-shell { border: 2px solid #00ff88; border-radius: 18px; overflow: hidden; box-shadow: 0 0 25px rgba(0, 255, 136, 0.3); }
.n-header { display: flex; justify-content: space-between; padding: 15px 20px; background: #121212; border-bottom: 2px solid #00ff88; align-items: center; }
.n-header h3 { margin: 0; color: #00ff88; letter-spacing: 2px; font-weight: 900; }
.n-topbar { display: flex; justify-content: space-between; padding: 10px 20px; background: #000; border-bottom: 1px solid #006644; font-size: 11px; }
.n-main { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; }
.n-panel { background: #111; border: 1px solid #006644; padding: 15px; border-radius: 15px; }
.n-title { color: #00ff88; font-size: 12px; font-weight: 900; margin-bottom: 15px; border-left: 3px solid #00ff88; padding-left: 10px; }
.n-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.n-card { background: #1a1a1a; border: 1px solid #333; padding: 10px 5px; text-align: center; border-radius: 12px; transition: 0.3s; }
.n-card:hover { border-color: #00ff88; background: #002211; transform: translateY(-3px); }
.n-card img { width: 24px; height: 24px; margin-bottom: 5px; }
.n-val { font-size: 14px; font-weight: bold; color: #fff; }
.n-name { font-size: 9px; color: #00ff88; opacity: 0.7; font-weight: bold; }
.n-btn { background: #000; border: 1px solid #00ff88; color: #00ff88; padding: 6px 15px; border-radius: 20px; cursor: pointer; font-weight: bold; font-size: 10px; transition: 0.2s; }
.n-btn:hover { background: #00ff88; color: #000; box-shadow: 0 0 10px #00ff88; }
.n-btn-discord { border-color: #5865F2; color: #5865F2; }
.n-btn-discord:hover { background: #5865F2; color: #fff; box-shadow: 0 0 10px #5865F2; }
.blink { animation: blink-animation 1s steps(5, start) infinite; color: #ff0055; margin-right: 5px; }
@keyframes blink-animation { to { visibility: hidden; } }
</style>`;

            Dialog.show("neon", html);
            $('#n-ref').on('click', () => { Dialog.close(); this.init(); });
            $('#n-disc').on('click', () => this.#sendToDiscord(total));
        }
    }

    new MilitarNeonGamer().init();
})();
