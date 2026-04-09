(function () {
    var webhookURL = window.meuWebhookTW;
    var SCRIPT_NS = 'defesa_ofensiva_final';
    var DIALOG_ID = 'dialog_militar_v4';

    try { delete window.villagesTroopsCounter; } catch (e) {}

    class VillagesTroopsCounter {
        constructor() {
            const forbidden = ['militia', 'archer', 'marcher'];
            this.availableUnits = (game_data.units || []).filter(u => !forbidden.includes(u));
            this.worldConfig = null;
            this.isScavengingWorld = false;
        }

        async init() {
            const xml = $.ajax({ async: false, url: '/interface.php?func=get_config', type: 'GET' }).responseText;
            this.isScavengingWorld = $($.parseXML(xml)).find('scavenging').text() === '1';
            await this.#createUI();
        }

        async #createUI() {
            const troopsObj = { villages: {}, scavenging: {} };
            this.availableUnits.forEach(u => { troopsObj.villages[u] = 0; troopsObj.scavenging[u] = 0; });

            // Lógica de leitura (Simplificada para garantir execução)
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
                        if (isHome) troopsObj.villages[unit] += val;
                        if (isScav) troopsObj.scavenging[unit] += val;
                    }
                });
            });

            const total = {};
            this.availableUnits.forEach(u => total[u] = troopsObj.villages[u] + troopsObj.scavenging[u]);

            const renderCard = (unit, val, label) => `
                <div style="background:#e3d5b3; border:1px solid #805020; padding:5px; text-align:center; border-radius:3px;">
                    <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${unit}.png"><br>
                    <b style="font-size:13px;">${new Intl.NumberFormat('pt-PT').format(val)}</b><br>
                    <span style="font-size:9px; font-weight:bold; color:#805020;">${label}</span>
                </div>`;

            const uiHtml = `
<div id="militar-root" style="color:#302010; font-family:Verdana; background:#f4e4bc; border:2px solid #805020; padding:15px; min-width:600px;">
    <h2 style="text-align:center; background:#c1a264; padding:10px; margin:0 0 15px 0; border:1px solid #805020;">RELATÓRIO MILITAR</h2>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
        <div style="background:#fff5da; border:1px solid #805020; padding:10px;">
            <h4 style="border-bottom:1px solid #805020; margin-top:0;">🛡️ DEFESA TOTAL</h4>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px;">
                ${renderCard('spear', total.spear, 'LANÇAS')} ${renderCard('sword', total.sword, 'ESPADAS')}
                ${renderCard('heavy', total.heavy, 'PESADA')} ${renderCard('catapult', total.catapult, 'CATAS')}
                ${renderCard('knight', total.knight || 0, 'PALADINO')}
            </div>
        </div>
        <div style="background:#fff5da; border:1px solid #805020; padding:10px;">
            <h4 style="border-bottom:1px solid #805020; margin-top:0;">⚔️ ATAQUE TOTAL</h4>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:5px;">
                ${renderCard('axe', total.axe, 'VIKINGS')} ${renderCard('spy', total.spy, 'BATEDOR')}
                ${renderCard('light', total.light, 'LEVE')} ${renderCard('ram', total.ram, 'ARÍETE')}
                ${renderCard('catapult', total.catapult, 'CATAS')} ${renderCard('knight', total.knight || 0, 'PALADINO')}
            </div>
        </div>
    </div>
    <button id="send-v4" style="width:100%; margin-top:15px; padding:10px; background:#5865F2; color:#fff; font-weight:bold; cursor:pointer; border:1px solid #4752C4;">📤 ENVIAR PARA DISCORD (2 ZONAS)</button>
</div>`;

            Dialog.show(DIALOG_ID, uiHtml);

            $('#send-v4').on('click', () => {
                const payload = {
                    content: `📊 **RELATÓRIO MILITAR - ${game_data.player.name}**`,
                    embeds: [
                        {
                            title: "🛡️ TROPAS DEFENSIVAS",
                            color: 3447003,
                            fields: [
                                { name: "Unidades", value: `🛡️ **Lanças:** ${total.spear}\n⚔️ **Espadas:** ${total.sword}\n🏇 **Pesada:** ${total.heavy}\n☄️ **Catas:** ${total.catapult}\n👑 **Paladino:** ${total.knight || 0}`, inline: true }
                            ]
                        },
                        {
                            title: "⚔️ TROPAS OFENSIVAS",
                            color: 15158332,
                            fields: [
                                { name: "Unidades", value: `🪓 **Vikings:** ${total.axe}\n👁️ **Batedor:** ${total.spy}\n🐎 **Leve:** ${total.light}\n🪵 **Aríete:** ${total.ram}\n☄️ **Catas:** ${total.catapult}\n👑 **Paladino:** ${total.knight || 0}`, inline: true }
                            ],
                            footer: { text: `Mundo: ${game_data.world} | Grupo: ${$('.vis_item strong').text() || 'Todos'}` }
                        }
                    ]
                };
                $.post(webhookURL, JSON.stringify(payload)).done(() => alert("Enviado com sucesso!"));
            });
        }
    }

    new VillagesTroopsCounter().init();
})();
