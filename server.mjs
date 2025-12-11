import express from "express";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";

const app = express();
app.use(express.json());

// Rota para testar se está vivo
app.get("/", (req, res) => res.send("Gerador de Vídeo Pronto!"));

// Rota que o n8n vai chamar
app.post("/render", async (req, res) => {
  try {
    const inputProps = req.body;
    console.log("Recebendo pedido:", inputProps.modeloId || "Padrão");
    
    // O template HelloWorld usa "src/index.ts" como entrada
    const entry = "./src/index.ts";
    
    console.log("Criando bundle...");
    const bundled = await bundle(path.join(process.cwd(), entry));

    // --- CÁLCULO DE DURAÇÃO DINÂMICA ---
    let duracaoFrameOverride = undefined;

    // Se tiver lista de imagens com duração, soma tudo
    if (inputProps.imagens && Array.isArray(inputProps.imagens)) {
      const segundosTotais = inputProps.imagens.reduce((total, img) => {
        return total + (img.duracaoEmSegundos || 5); // Default 5s se vier sem
      }, 0);
      
      duracaoFrameOverride = Math.ceil(segundosTotais * 30); // 30 FPS
      console.log(`Duração calculada dinamicamente: ${segundosTotais}s (${duracaoFrameOverride} frames)`);
    }

    console.log("Selecionando composição...");
    const composition = await selectComposition({
      serveUrl: bundled,
      // Se o n8n não mandar ID, usa VideoLongo (ou HelloWorld se preferir)
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
      // Garante que a duração calculada seja respeitada na renderização
      frameRange: [0, composition.durationInFrames - 1], 
    });

    console.log("Renderização concluída:", outputLocation);
    res.download(outputLocation);
    
  } catch (err) {
    console.error("ERRO CRÍTICO:", err);
    res.status(500).send("Erro na renderização: " + err.message);
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
