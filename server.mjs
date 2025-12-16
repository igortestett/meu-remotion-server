import express from "express";
import cors from "cors";
import {
  deploySite,
  getOrCreateBucket,
  renderMediaOnLambda,
  getRenderProgress,
  getFunctions,
} from "@remotion/lambda";
import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Validação de variáveis de ambiente críticas
const checkEnv = () => {
  const required = ["REMOTION_AWS_REGION", "REMOTION_LAMBDA_FUNCTION_NAME"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Faltando variáveis de ambiente: ${missing.join(", ")}`);
    process.exit(1);
  }
};

checkEnv();

app.get("/", (req, res) => res.send("Controlador Remotion Lambda OK!"));

app.get("/test-connection", async (req, res) => {
  try {
    console.log("📡 Testando conectividade externa...");
    const start = Date.now();
    
    // Teste 1: Google (Conectividade Geral)
    const google = await fetch("https://www.google.com", { method: "HEAD" });
    
    // Teste 2: AWS S3 (Conectividade AWS)
    const awsUrl = `https://s3.${process.env.REMOTION_AWS_REGION}.amazonaws.com`;
    const aws = await fetch(awsUrl, { method: "HEAD" });

    // Teste 3: SDK Remotion (Credenciais e Permissões)
    let sdkStatus = "Não testado";
    try {
      const fns = await getFunctions({ region: process.env.REMOTION_AWS_REGION });
      sdkStatus = `OK (Encontradas ${fns.length} funções)`;
    } catch (sdkErr) {
      sdkStatus = `FALHA (${sdkErr.message})`;
    }

    res.json({
      status: "ok",
      internet: google.ok ? "OK" : "FALHA",
      aws: aws.ok || aws.status === 403 || aws.status === 405 ? "OK (Acessível)" : `FALHA (${aws.status})`,
      sdk: sdkStatus,
      latency: `${Date.now() - start}ms`
    });
  } catch (err) {
    console.error("❌ Erro de conexão:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Servidor sem acesso à internet ou bloqueado por Firewall.",
      details: err.message 
    });
  }
});

const resolveServeUrl = async ({ region }) => {
  const fromEnv = process.env.REMOTION_SERVE_URL;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  console.log("⚠️ REMOTION_SERVE_URL não definido. Fazendo deploy do site...");
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

  console.log(`✅ Serve URL gerado: ${serveUrl}`);
  console.log("💡 Salve no seu .env ou painel como REMOTION_SERVE_URL para evitar deploys desnecessários.");
  
  return serveUrl;
};

// Schema de validação básica para entrada
const RenderSchema = z.object({
  modeloId: z.string().default("VideoLongo"),
  videos: z.array(z.any()).optional(),
  imagens: z.array(z.any()).optional(),
  audioUrl: z.string().optional(),
  legendaUrl: z.string().optional(),
  legendasSrt: z.string().optional(),
}).passthrough(); // Permite outras props

// Rota de Renderização (assíncrona)
app.post("/render", async (req, res) => {
  try {
    const body = RenderSchema.parse(req.body);
    const inputProps = body;

    // 1.1 Se vier legendaUrl mas não vier legendasSrt, baixa o SRT aqui no servidor
    if (inputProps.legendaUrl && !inputProps.legendasSrt) {
      console.log(`⬇️ Baixando SRT de: ${inputProps.legendaUrl}`);
      const r = await fetch(inputProps.legendaUrl);
      if (!r.ok) {
        throw new Error(
          `Falha ao baixar SRT da URL ${inputProps.legendaUrl}: ${r.status} ${r.statusText}`
        );
      }
      inputProps.legendasSrt = await r.text();
    }

    console.log("=== NOVA REQUISIÇÃO DE RENDER ===");
    console.log(`Modelo: ${inputProps.modeloId}`);
    console.log(`Videos: ${inputProps.videos?.length || 0}`);
    console.log(`Imagens: ${inputProps.imagens?.length || 0}`);

    const region = process.env.REMOTION_AWS_REGION;
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME?.trim();

    console.log(`🔧 Configuração Lambda:`);
    console.log(`   - Region: ${region}`);
    console.log(`   - Function: ${functionName}`);
    console.log(`   - AWS Key: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 4) + '****' : 'MISSING'}`);

    const serveUrl = await resolveServeUrl({ region });

    console.log("🚀 Disparando render no Lambda...");
    console.log(`   - Serve URL: ${serveUrl}`);
    console.log(`   - Input Props (Size): ${JSON.stringify(inputProps).length} chars`);

    try {
      // Wrapper com timeout aumentado para redes lentas
      const timeoutMs = 40000; // 40 segundos
      const renderPromise = renderMediaOnLambda({
        region,
        functionName,
        serveUrl,
        composition: inputProps.modeloId,
        inputProps,
        codec: "h264",
        concurrency: Number(process.env.REMOTION_CONCURRENCY || 50),
        timeoutInSeconds: 900,
        retries: 1,
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms ao tentar conectar com a AWS Lambda. Verifique credenciais e firewall.`)), timeoutMs)
      );

      const { renderId, bucketName: outputBucket } = await Promise.race([renderPromise, timeoutPromise]);

      console.log(`✅ Render iniciado! ID: ${renderId}`);

      res.json({
        status: "rendering",
        renderId,
        region,
        bucketName: outputBucket,
        checkUrl: `/status/${renderId}`,
        serveUrlUsed: serveUrl,
      });
    } catch (lambdaError) {
      console.error("❌ Erro específico ao invocar Lambda:", lambdaError);
      throw lambdaError; // Re-lança para o catch global tratar
    }
  } catch (err) {
    console.error("❌ ERRO CRÍTICO NO RENDER:", err);
    res.status(500).json({ 
      error: err instanceof Error ? err.message : "Erro desconhecido", 
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  }
});

// Rota de Status (polling)
app.get("/status/:renderId", async (req, res) => {
  try {
    const { renderId } = req.params;
    const region = process.env.REMOTION_AWS_REGION;
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;

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
    console.error("❌ Erro ao checar status:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Servidor Lambda rodando na porta ${PORT}`)
);
