(function () {
    var webhookURL = window.meuWebhookTW;
    var DIALOG_ID = 'militar_neon_gamer';

    // Limpeza de instâncias
    try { Dialog.close(); } catch (e) {}
    
    class MilitarNeonGamer {
        constructor() {
            // Filtro de unidades
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (game_data.units || []).filter(u => !forbidden.includes(u));
        }

        async init() {
            // Carregamento rápido de dados
            const html = await $.get(`/game.php?village=${game_data.village.id}&screen=overview_villages&mode=units`);
            const rows = $($.parseHTML(html)).find('#units_table tbody tr');
            
            const troops = { v: {}, s: {} };
            this.availableUnits.forEach(u => { troops.v[u] = 0; troops.s[u] = 0; });

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

            this.#createUI(troops);
        }

        #format(v) { return new Intl.NumberFormat('pt-PT').format(v || 0); }

        #createUI(troops) {
            const total = {};
            this.availableUnits.forEach(u => total[u] = troops.v[u] + troops.s[u]);

            const renderCard = (u, v, l) => `
                <div class="n-card">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${u}.png">
                    <div class="n-val">${this.#format(v)}</div>
                    <div class="n-name">${l}</div>
                </div>`;

            const html = `
<div id="neon-hud">
    <div class="n-shell">
        <div class="n-header">
            <h3><span class="n-dot"></span> NÚCLEO MILITAR</h3>
            <div class="n-clock">${$('#serverTime').text()}</div>
        </div>
        <div class="n-main">
            <div class="n-panel">
                <div class="n-title">🛡️ SETOR DEFENSIVO</div>
                <div class="n-grid">
                    ${renderCard('spear', total.spear, 'LANÇAS')}
                    ${renderCard('sword', total.sword, 'ESPADAS')}
                    ${renderCard('heavy', total.heavy, 'PESADA')}
                    ${renderCard('catapult', total.catapult, 'CATAS')}
                    ${total.knight !== undefined ? renderCard('knight', total.knight, 'PALADINO') : ''}
                </div>
            </div>
            <div class="n-panel">
                <div class="n-title">⚔️ SETOR OFENSIVO</div>
                <div class="n-grid">
                    ${renderCard('axe', total.axe, 'VIKING')}
                    ${renderCard('spy', total.spy, 'BATEDOR')}
                    ${renderCard('light', total.light, 'LEVE')}
                    ${renderCard('ram', total.ram, 'ARÍETE')}
                    ${renderCard('catapult', total.catapult, 'CATAS')}
                </div>
            </div>
        </div>
        <div class="n-footer">
            <button id="n-disc" class="n-btn n-btn-discord">TRANSMITIR DISCORD</button>
            <button id="n-close" class="n-btn">FECHAR</button>
        </div>
    </div>
</div>
<style>
#neon-hud { color: #e0fff0; font-family: 'Segoe UI', sans-serif; background: #080808; padding: 12px; border-radius: 20px; min-width: 650px; }
.n-shell { border: 2px solid #00ff88; border-radius: 20px; overflow: hidden; box-shadow: 0 0 30px rgba(0, 255, 136, 0.2); }
.n-header { display: flex; justify-content: space-between; padding: 15px 25px; background: #121212; border-bottom: 1px solid #00ff88; align-items: center; }
.n-header h3 { margin: 0; color: #00ff88; font-weight: 900; letter-spacing: 1px; }
.n-dot { display: inline-block; width: 8px; height: 8px; background: #ff0055; border-radius: 50%; margin-right: 10px; box-shadow: 0 0 8px #ff0055; }
.n-main { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; background: #000; }
.n-panel { background: #111; border: 1px solid #333; padding: 15px; border-radius: 18px; }
.n-title { color: #00ff88; font-size: 11px; font-weight: 900; margin-bottom: 15px; text-transform: uppercase; }
.n-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.n-card { background: #1a1a1a; padding: 10px 5px; text-align: center; border-radius: 15px; border: 1px solid #222; }
.n-card img { width: 22px; height: 22px; margin-bottom: 6px; }
.n-val { font-size: 13px; font-weight: bold; color: #fff; }
.n-name { font-size: 8px; color: #00ff88; font-weight: bold; margin-top: 2px; }
.n-footer { padding: 15px 20px; background: #121212; display: flex; gap: 10px; justify-content: center; }
.n-btn { background: #000; border: 1px solid #00ff88; color: #00ff88; padding: 8px 20px; border-radius: 25px; cursor: pointer; font-weight: bold; font-size: 10px; transition: 0.3s; }
.n-btn:hover { background: #00ff88; color: #000; }
.n-btn-discord { border-color: #5865F2; color: #5865F2; }
.n-btn-discord:hover { background: #5865F2; color: #fff; }
</style>`;

            Dialog.show(DIALOG_ID, html);
            $('#n-close').on('click', () => Dialog.close());
            $('#n-disc').on('click', () => {
                const payload = {
                    content: `🚀 **MILITAR HUD - ${game_data.player.name}**`,
                    embeds: [
                        { title: "🛡️ DEFESA", color: 3447003, fields: [{ name: "STATUS", value: `🛡️ **Lanças:** ${total.spear}\n⚔️ **Espadas:** ${total.sword}\n🏇 **Pesada:** ${total.heavy}\n☄️ **Catas:** ${total.catapult}`, inline: true }] },
                        { title: "⚔️ ATAQUE", color: 15548997, fields: [{ name: "STATUS", value: `🪓 **Vikings:** ${total.axe}\n👁️ **Batedor:** ${total.spy}\n🐎 **Leve:** ${total.light}\n🪵 **Aríete:** ${total.ram}`, inline: true }] }
                    ]
                };
                $.post(webhookURL, JSON.stringify(payload)).done(() => UI.SuccessMessage("TRANSMITIDO"));
            });
        }
    }

    new MilitarNeonGamer().init();
})();
