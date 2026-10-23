# GC Overlay para live

Overlay editavel para usar como Browser Source no OBS, vMix ou sistema parecido.

Para atualizacao em tempo real entre painel e overlay, use `npm start`.

## Links

- Painel de controle: `http://127.0.0.1:5173/control.html?v=13`
- Overlay da live: `http://127.0.0.1:5173/overlay.html?v=13`
- Reset de cache: `http://127.0.0.1:5173/cache-reset.html`

## Como usar

1. Abra o painel de controle.
2. Edite a manchete, subtitulo, chamada central e texto do post. O ultimo conteudo salvo no servidor volta ao abrir o painel.
3. Escolha um dos seis modelos de tarja, ajuste suas cores e textos, o tamanho da logo, a proporcao e as janelas visiveis. Cada modelo lembra suas ultimas cores.
4. Suba as imagens, PNGs ou videos nos campos do painel. A janela central aceita video 16:9; a janela post aceita video 9:16.
5. No OBS/vMix, adicione uma Browser Source usando o link do overlay.
6. Cole o link da live do YouTube e defina a meta de likes para acompanhar likes, inscritos e chat no painel.
7. Clique em uma mensagem da lista para destaca-la sobre a transmissao. Use **Retirar destaque** para esconder a mensagem sem alterar a manchete do GC.

O painel mostra se cada alteracao foi salva no servidor. Se o envio de uma midia falhar, o arquivo anterior permanece no overlay. O chat incorporado depende de a live estar ativa e do suporte do YouTube ao dispositivo; o painel inclui um link para abrir o chat separadamente.

Os contadores de likes e inscritos e a selecao de mensagens do chat exigem a variavel `YOUTUBE_API_KEY` no servidor. Sem ela, o painel mostra o motivo da indisponibilidade. A selecao funciona apenas enquanto a live estiver ativa e com chat publico habilitado. O numero publico de inscritos pode ser arredondado pelo YouTube.

Para publicar na internet, veja `DEPLOY.md`.
