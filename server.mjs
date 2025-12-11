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

    // --- CÁLCULO DE DURAÇÃO DINÂMICA ---
    let duracaoFrameOverride = undefined;

    if (inputProps.imagens && Array.isArray(inputProps.imagens)) {
      const segundosTotais = inputProps.imagens.reduce((total, img) => {
        return total + (img.duracaoEmSegundos || 5);
      }, 0);
      
      // Calcula frames (30 fps)
      duracaoFrameOverride = Math.ceil(segundosTotais * 30);
      console.log(`Duração calculada: ${segundosTotais}s (${duracaoFrameOverride} frames)`);
    }

    console.log("Selecionando composição...");
    const composition = await selectComposition({
      serveUrl: bundled,
      id: inputProps.modeloId || "VideoLongo", 
      inputProps,

      console.log(`Duration from metadata: ${composition.durationInFrames}`);
    
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation,
      inputProps,
      // Aqui forçamos o intervalo exato que queremos
      frameRange: [0, durationFinal - 1], 
      concurrency: 1, // Economiza RAM
      pixelFormat: "yuv420p",
    });

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
server.setTimeout(1800000); // 30 minutos
