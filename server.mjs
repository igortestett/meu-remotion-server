import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

// 1. PRIMEIRO cria o app
const app = express();
app.use(express.json());

// Rota para testar se está vivo
app.get("/", (req, res) => res.send("Gerador de Vídeo Pronto!"));

// Rota que o n8n vai chamar
app.post("/render", async (req, res) => {
  // Aumenta o timeout DESTA requisição específica para 30 minutos
  req.setTimeout(1800000); 
  res.setTimeout(1800000);

  try {
    const inputProps = req.body;
    console.log("Recebendo pedido:", inputProps.modeloId || "Padrão");
    
    // O template HelloWorld usa "src/index.ts" como entrada
    const entry = "./src/index.ts";
    
    console.log("Criando bundle...");
    const bundled = await bundle(path.join(process.cwd(), entry));

    // --- CÁLCULO DE DURAÇÃO DINÂMICA ---
    let duracaoFrameOverride = undefined;

    if (inputProps.imagens && Array.isArray(inputProps.imagens)) {
      const segundosTotais = inputProps.imagens.reduce((total, img) => {
        return total + (img.duracaoEmSegundos || 5);
      }, 0);
      
      duracaoFrameOverride = Math.ceil(segundosTotais * 30);
      console.log(`Duração calculada: ${segundosTotais}s`);
    }

    console.log("Selecionando composição...");
    const composition = await selectComposition({
      serveUrl: bundled,
      id: inputProps.modeloId || "VideoLongo", 
      inputProps,
      defaultProps: duracaoFrameOverride ? {
        durationInFrames: duracaoFrameOverride
      } : undefined
    });

    const outputLocation = `/tmp/video-${Date.now()}.mp4`;
    
    console.log(`Renderizando ${composition.durationInFrames} frames...`);
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation,
      inputProps,
      frameRange: [0, composition.durationInFrames - 1], 
      // Otimização para vídeos longos (menos memória)
      concurrency: 1, 
      pixelFormat: "yuv420p",
    });

    console.log("Renderização concluída:", outputLocation);
    res.download(outputLocation);
    
  } catch (err) {
    console.error("ERRO CRÍTICO:", err);
    // Se já enviou cabeçalho, não tenta enviar erro de novo
    if (!res.headersSent) {
        res.status(500).send("Erro na renderização: " + err.message);
    }
  }
});

// 2. POR ÚLTIMO inicia o servidor e define o timeout global
const server = app.listen(3000, () => console.log("Servidor rodando na porta 3000 com Timeout de 30min"));
server.setTimeout(1800000); // 30 minutos
