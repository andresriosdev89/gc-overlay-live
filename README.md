# GC Overlay para live

Overlay editavel para usar como Browser Source no OBS, vMix ou sistema parecido.

Para atualizacao em tempo real entre painel e overlay, use `npm start`.

## Links

- Painel de controle: `http://127.0.0.1:5173/control.html?v=11`
- Overlay da live: `http://127.0.0.1:5173/overlay.html?v=11`
- Reset de cache: `http://127.0.0.1:5173/cache-reset.html`

## Como usar

1. Abra o painel de controle.
2. Edite a manchete, subtitulo, chamada central e texto do post.
3. Ajuste cores, tamanhos de texto, proporcao e janelas visiveis.
4. Suba as imagens, PNGs ou videos nos campos do painel. A janela central aceita video 16:9; a janela post aceita video 9:16.
5. No OBS/vMix, adicione uma Browser Source usando o link do overlay.

O overlay atualiza sozinho quando o painel fica aberto no mesmo navegador.

Para publicar na internet, veja `DEPLOY.md`.
