# Meu Gerador de Vídeos Remotion

Este projeto é um servidor de renderização de vídeos utilizando [Remotion](https://www.remotion.dev/) e AWS Lambda.

## Funcionalidades

- Renderização de vídeos compostos por clipes e imagens.
- Suporte a áudio de fundo.
- Legendas automáticas via arquivo SRT ou URL.
- Efeito Ken Burns em imagens.
- API REST para controlar renderizações.

## Comandos

**Instalar Dependências**

```console
npm install
```

**Iniciar Servidor Local**

```console
npm start
```

**Pré-visualizar Vídeo (Remotion Studio)**

```console
npm run dev
```

**Deploy da Infraestrutura (AWS Lambda)**

1. Configure suas credenciais no `.env`.
2. Faça o deploy do site (bundle):
   ```console
   npm run deploy:site
   ```
3. Faça o deploy da função Lambda:
   ```console
   npm run deploy:function
   ```

## API

### POST /render

Inicia a renderização de um vídeo.

**Body:**
```json
{
  "modeloId": "VideoLongo",
  "videos": [
    { "url": "https://exemplo.com/video1.mp4" }
  ],
  "imagens": [
    { "url": "https://exemplo.com/imagem1.jpg", "duracaoEmSegundos": 5 }
  ],
  "musicaUrl": "https://exemplo.com/fundo.mp3",
  "volumeMusica": 0.1,
  "narracaoUrl": "https://exemplo.com/voz.mp3",
  "legendaUrl": "https://exemplo.com/legendas.srt"
}
```

### GET /status/:renderId

Verifica o progresso da renderização.
