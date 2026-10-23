# GC Overlay para live

Overlay editavel para usar como Browser Source no OBS, vMix ou sistema parecido.

Para atualizacao em tempo real entre painel e overlay, use `npm start`.

## Links

- Painel de controle: `http://127.0.0.1:5173/control.html?v=19`
- Overlay da live: `http://127.0.0.1:5173/overlay.html?v=19`
- Reset de cache: `http://127.0.0.1:5173/cache-reset.html`

## Como usar

1. Abra o painel de controle.
2. Edite a manchete e o subtitulo. O ultimo conteudo salvo no servidor volta ao abrir o painel.
3. Escolha um dos cinco modelos proprios de tarja e ajuste cores, opacidade e textos. Cada modelo lembra suas ultimas cores.
4. Suba sua logo em PNG, JPG ou WebP, se quiser. Arraste-a na previa ou ajuste posicao horizontal, vertical e tamanho; isso nao redimensiona os textos da tarja. A meta de likes tambem pode ser arrastada livremente na previa ou ajustada em posicao e tamanho, sem mover a tarja.
5. No OBS/vMix, adicione uma Browser Source usando o link do overlay. O fundo da pagina e transparente: somente a tarja, a barra de likes e uma mensagem do chat destacada aparecem na transmissao.
6. Cole o link da live do YouTube, defina a meta inicial e o incremento. O painel acompanha likes, inscritos e chat; a barra OWTV no overlay avanca para a proxima meta automaticamente e celebra quando ela e atingida.
7. Clique em uma mensagem da lista para destaca-la numa faixa integrada acima da tarja. Use **Retirar destaque** para esconder a mensagem sem alterar a manchete do GC.
8. Use **Inscritos no overlay** para mostrar ou ocultar o contador do canal da live. Arraste-o na previa ou ajuste seu tamanho e posicao sem alterar a meta de likes.

O painel mostra se cada alteracao foi salva no servidor. Se o envio da logo falhar, a imagem anterior permanece no overlay. O chat incorporado depende de a live estar ativa e do suporte do YouTube ao dispositivo; o painel inclui um link para abrir o chat separadamente.

Os contadores de likes e inscritos e a selecao de mensagens do chat exigem a variavel `YOUTUBE_API_KEY` no servidor. Sem ela, o painel mostra o motivo da indisponibilidade. A chave nunca e enviada ao navegador; os contadores do OBS consultam apenas a live configurada no servidor. A selecao funciona apenas enquanto a live estiver ativa e com chat publico habilitado. O numero publico de inscritos pode ser arredondado pelo YouTube.

Para publicar na internet, veja `DEPLOY.md`.
