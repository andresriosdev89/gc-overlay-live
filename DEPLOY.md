# Deploy do GC Overlay

## Rodar em qualquer computador

```bash
npm install
npm start
```

Links locais:

- Painel: `http://127.0.0.1:5173/control.html?v=11`
- Overlay: `http://127.0.0.1:5173/overlay.html?v=11`

## Colocar publico

Use um servico que rode Node com disco persistente, como Render, Railway, Fly.io ou uma VPS.

Variaveis importantes:

- `PORT`: porta informada pelo provedor.
- `HOST`: use `0.0.0.0` em deploy publico.
- `ADMIN_KEY`: senha do painel. Se preencher, abra o painel com `?key=SUA_CHAVE`.
- `DATA_DIR`: pasta de dados persistentes. Padrao: `./data`.
- `MAX_UPLOAD_MB`: limite de upload. Padrao: `250`.

## Links quando estiver publico

Troque `https://seu-dominio.com` pelo dominio do deploy:

- Painel protegido: `https://seu-dominio.com/control.html?v=11&key=SUA_CHAVE`
- Overlay publico: `https://seu-dominio.com/overlay.html?v=11`
- Reset protegido: `https://seu-dominio.com/cache-reset.html?key=SUA_CHAVE`

## Render

Este projeto ja inclui `render.yaml`.

1. Suba a pasta para um repositorio GitHub.
2. No Render, escolha New > Blueprint.
3. Selecione o repositorio.
4. Depois do deploy, copie o valor de `ADMIN_KEY`.
5. Use o link do painel com `?key=...` e o link do overlay no OBS/vMix.

## Docker

```bash
docker build -t gc-overlay-live .
docker run --rm -p 5173:5173 -e ADMIN_KEY=minha-chave -v "$PWD/data:/app/data" gc-overlay-live
```
