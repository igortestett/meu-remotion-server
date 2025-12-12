import express from "express";
import {
  deploySite,
  getOrCreateBucket,
  renderMediaOnLambda,
  getRenderProgress,
} from "@remotion/lambda";
import path from "path";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Controlador Remotion Lambda OK!"));

/**
 * Resolve o Serve URL:
 * - Se REMOTION_SERVE_URL existir: reutiliza (recomendado para produção)
 * - Se não existir: faz deploy do site e retorna o serveUrl
 */
const resolveServeUrl = async ({ region }) => {
  const fromEnv = process.env.REMOTION_SERVE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const entry = "./src/index.ts";
  const entryPoint = path.join(process.cwd(), entry);

  const { bucketName } = await getOrCreateBucket({ region });

  const siteName = process.env.REMOTION_SITE_NAME || "meu-gerador-video-prod";

  const { serveUrl } = await deploySite({
    bucketName,
    entryPoint,
    region,
    siteName,
  });

  console.log("Serve URL gerado (salve no Easypanel como REMOTION_SERVE_URL):", serveUrl);
  return serveUrl;
};

// Rota de Renderização (assíncrona)
app.post("/render", async (req, res) => {
  try {
    // 1. Recebe os dados do corpo (incluindo imagens, audioUrl e agora legendasSrt)
    const inputProps = req.body || {};

    // DEBUG: Verifica o que chegou
    console.log("=== NOVA REQUISICÃO DE RENDER ===");
    console.log(`Audio URL: ${inputProps.audioUrl ? "Sim" : "Não"}`);
    console.log(`Imagens: ${inputProps.imagens?.length || 0}`);
    console.log(`Legendas (SRT): ${inputProps.legendasSrt ? "Sim (Presente)" : "Não"}`);

    const region = process.env.REMOTION_AWS_REGION;
    if (!region) {
      throw new Error("Faltou configurar REMOTION_AWS_REGION (ex: us-east-2).");
    }

    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
      throw new Error("Faltou configurar REMOTION_LAMBDA_FUNCTION_NAME.");
    }

    console.log("1) Resolvendo serveUrl (reutilizável)...");
    const serveUrl = await resolveServeUrl({ region });

    console.log("2) Calculando duração...");
    let duracao = 300; // default 10s @ 30fps (caso não venham imagens)
    
    // Cálculo baseado nas imagens (prioridade)
    if (inputProps.imagens && Array.isArray(inputProps.imagens) && inputProps.imagens.length > 0) {
      const seg = inputProps.imagens.reduce(
        (acc, img) => acc + (img.duracaoEmSegundos || 5),
        0
      );
      duracao = Math.ceil(seg * 30); // 30fps fixo
    } else {
        console.warn("AVISO: Nenhuma imagem fornecida, usando duração padrão de 10s (300 frames).");
    }

    console.log(
      `3) Disparando render. region=${region} function=${functionName} frames=${duracao}`
    );

    const { renderId, bucketName: outputBucket } = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: inputProps.modeloId || "VideoLongo",
      
      // AQUI ESTÁ O SEGREDO:
      // Passamos o inputProps inteiro. O Remotion vai receber { audioUrl, imagens, legendasSrt }
      inputProps: inputProps,
      
      codec: "h264",
      concurrency: Number(process.env.REMOTION_CONCURRENCY || 100),
      timeoutInSeconds: 900,
      retries: 1,

      // Força a duração calculada aqui no servidor
      defaultProps: {
        durationInFrames: duracao,
      },
    });

    res.json({
      status: "rendering",
      renderId,
      region,
      bucketName: outputBucket,
      checkUrl: `/status/${renderId}`,
      serveUrlUsed: serveUrl, 
    });
  } catch (err) {
    console.error("ERRO CRÍTICO NO RENDER:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Rota de Status (polling)
app.get("/status/:renderId", async (req, res) => {
  try {
    const { renderId } = req.params;

    const region = process.env.REMOTION_AWS_REGION;
    if (!region) {
      throw new Error("Faltou configurar REMOTION_AWS_REGION.");
    }

    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
      throw new Error("Faltou configurar REMOTION_LAMBDA_FUNCTION_NAME.");
    }

    const { bucketName } = await getOrCreateBucket({ region });

    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName,
      region,
    });

    if (progress.done) {
      return res.json({
        status: "done",
        url: progress.outputFile,
        custo: progress.costs,
      });
    }

    if (progress.fatalErrorEncountered) {
      return res.status(500).json({
        status: "error",
        error: progress.errors,
      });
    }

    res.json({
      status: "processing",
      progress: Math.round(progress.overallProgress * 100) + "%",
      chunks: progress.chunks,
    });
  } catch (err) {
    console.error("Erro ao checar status:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Servidor Lambda rodando na porta 3000"));
