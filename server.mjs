import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

// 1. Cria o app
const app = express();
app.use(express.json());

// Rota para testar se está vivo
app.get("/", (req, res) => res.send("Gerador de Vídeo Pronto!"));

// Rota que o n8n vai chamar
app.post("/render", async (req, res) => {
  // Aumenta o timeout para 30 minutos
  req.setTimeout(1800000); 
  res.setTimeout(1800000);

  try {
    const inputProps = req.body;
    console.log("Recebendo pedido:", inputProps.modeloId || "Padrão");
    
    // Caminho de entrada do código Remotion
    const entry = "./src/index.ts";
    
    console.log("Criando bundle...");
    const bundled = await bundle(path.join(process.cwd(), entry));

    console.log("Selecionando composição...");
    
    const composition = await selectComposition({
      serveUrl: bundled,
      id: inputProps.modeloId || "VideoLongo", 
      inputProps,
    });

    console.log(`Duração calculada pelo Metadata: ${composition.durationInFrames} frames`);

    const outputLocation = `/tmp/video-${Date.now()}.mp4`;
    
    console.log(`Iniciando renderização de ${composition.durationInFrames} frames...`);
    
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation,
      inputProps,
      pixelFormat: "yuv420p",
      // concurrency: 1, // Descomente se travar por memória!
      
      // --- LOG DE PROGRESSO (DENTRO do objeto) ---
      onProgress: ({ renderedFrames }) => {
        if (renderedFrames % 100 === 0) {
          const progresso = Math.round((renderedFrames / composition.durationInFrames) * 100);
          console.log(`Progresso: ${progresso}% (${renderedFrames}/${composition.durationInFrames})`);
        }
      },
    }); // <--- O fechamento correto é AQUI, depois do onProgress

    console.log("Renderização concluída:", outputLocation);
    res.download(outputLocation);
    
  } catch (err) {
    console.error("ERRO CRÍTICO:", err);
    if (!res.headersSent) {
        res.status(500).send("Erro na renderização: " + err.message);
    }
  }
});

// 2. Inicia o servidor
const server = app.listen(3000, () => console.log("Servidor rodando na porta 3000 com Timeout de 30min"));
server.setTimeout(1800000);
