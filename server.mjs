import express from "express";
import cors from "cors";
import dns from "dns";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
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

dns.setDefaultResultOrder("ipv4first");

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
    
    const google = await fetch("https://www.google.com", { method: "HEAD" });
    
    const awsUrl = `https://s3.${process.env.REMOTION_AWS_REGION}.amazonaws.com`;
    const aws = await fetch(awsUrl, { method: "HEAD" });

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

app.get("/test-invoke", async (req, res) => {
  const region = process.env.REMOTION_AWS_REGION;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME?.trim();

  try {
    const timeoutMs = 15000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const client = new LambdaClient({ region });
    const payload = JSON.stringify({ method: "healthcheck" });
    const command = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "RequestResponse",
      Payload: new TextEncoder().encode(payload),
    });

    const result = await client.send(command, { abortSignal: controller.signal });
    clearTimeout(timeout);

    const decoded = result.Payload ? new TextDecoder().decode(result.Payload) : null;

    res.json({
      status: "ok",
      region,
      functionName,
      statusCode: result.StatusCode,
      functionError: result.FunctionError,
      payload: decoded,
    });
  } catch (err) {
    console.error("❌ Falha no /test-invoke:", err);
    res.status(500).json({
      status: "error",
      region,
      functionName,
      error: err instanceof Error ? err.message : "Erro desconhecido",
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
  musicaUrl: z.string().optional(),
  narracaoUrl: z.string().optional(),
  legendaUrl: z.string().optional(),
  legendasSrt: z.string().optional(),
  concurrency: z.number().min(1).max(1000).optional(),
}).passthrough(); // Permite outras props

// Helper para converter Google Drive View Link -> Direct Download Link
const normalizeDriveUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Se já for um link de exportação/download, retorna
  if (url.includes('export=download') || url.includes('e=download')) return url;

  // 1. Padrão /file/d/ID/view
  // Ex: https://drive.google.com/file/d/10hVj9g8exnuII0TNCb2lytSZYf8chrlH/view?usp=sharing
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    console.log(`🔄 Convertendo URL Drive (File ID): ${url}`);
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  }

  // 2. Padrão id=ID
  // Ex: https://drive.google.com/open?id=10hVj9g8exnuII0TNCb2lytSZYf8chrlH
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1] && url.includes('drive.google.com')) {
    console.log(`🔄 Convertendo URL Drive (ID Param): ${url}`);
    return `https://drive.google.com/uc?export=download&id=${idParamMatch[1]}`;
  }

  return url;
};


// Helper: Calcula hash MD5 de uma string
const md5 = (str) => crypto.createHash('md5').update(str).digest('hex');

// Cache de assets no S3
const cacheAssetOnS3 = async (url, bucketName, region) => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return url;
  
  // Se já for S3 ou Google Drive normalizado, talvez não precise cachear?
  // Mas para garantir velocidade máxima, vamos cachear TUDO que não for do nosso bucket.
  if (url.includes(bucketName)) return url;

  try {
    const s3 = new S3Client({ region });
    const extension = path.extname(url.split('?')[0]) || '.bin';
    // Adiciona sufixo v4 para invalidar cache antigo e garantir Content-Type correto
    const key = `assets-cache/${md5(url)}-v4${extension}`;
    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    // Verifica se já existe (opcional, para economizar requests HEAD podemos pular e tentar upload direto se for barato)
    // Mas para performance, ideal é verificar se já existe.
    // Simplificação: Vamos baixar e subir sempre? Não, cache é pra evitar isso.
    // Melhor estratégia: Tentar HEAD no S3.
    try {
      const headRes = await fetch(s3Url, { method: 'HEAD' });
      if (headRes.ok) {
        console.log(`💎 Asset em cache S3: ${key}`);
        return s3Url;
      }
    } catch (e) {
      // Ignora erro de rede no check, tenta baixar e subir
    }

    console.log(`📥 Baixando asset: ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao baixar asset: ${res.statusText}`);
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const expectedSize = Number(res.headers.get('content-length'));
    if (expectedSize && buffer.length !== expectedSize) {
       console.warn(`⚠️ ALERTA: Tamanho do download difere do Content-Length! Esperado: ${expectedSize}, Recebido: ${buffer.length}`);
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';

    // Força contentType para vídeo se a extensão for mp4
    let finalContentType = contentType;
    if (extension === '.mp4') {
      finalContentType = 'video/mp4'; // Força SEMPRE video/mp4, ignorando o que veio do servidor
    }

    console.log(`📤 Subindo para S3: ${key} (${finalContentType})`);
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: finalContentType,
      ACL: 'public-read' // Importante para o Lambda conseguir ler via URL simples
    }));

    return s3Url;
  } catch (err) {
    console.warn(`⚠️ Falha ao cachear asset ${url}, usando original. Erro: ${err.message}`);
    return url;
  }
};

// Rota de Renderização (assíncrona)
app.post("/render", async (req, res) => {
  try {
    const rawBody = req.body?.inputProps ?? req.body?.props ?? req.body;
    const body = RenderSchema.parse(rawBody);
    const inputProps = body;

    // --- NORMALIZAÇÃO DE URLS (DRIVE FIX E LIMPEZA) ---
    // Remove espaços em branco das URLs e normaliza links do Drive
    const cleanUrl = (u) => {
        if (!u || typeof u !== 'string') return u;
        // Remove espaços, quebras de linha e crases acidentais
        const trimmed = u.replace(/[`\s]/g, '').trim(); 
        return normalizeDriveUrl(trimmed);
    };

    inputProps.audioUrl = cleanUrl(inputProps.audioUrl);
    inputProps.musicaUrl = cleanUrl(inputProps.musicaUrl);
    inputProps.narracaoUrl = cleanUrl(inputProps.narracaoUrl);
    inputProps.legendaUrl = cleanUrl(inputProps.legendaUrl);

    if (Array.isArray(inputProps.videos)) {
      inputProps.videos = inputProps.videos.map(v => {
        if (typeof v === 'string') return { url: cleanUrl(v) };
        if (v && v.url) return { ...v, url: cleanUrl(v.url) };
        return v;
      });
    }

    if (Array.isArray(inputProps.imagens)) {
      inputProps.imagens = inputProps.imagens.map(i => {
        if (typeof i === 'string') return { url: cleanUrl(i) };
        if (i && i.url) return { ...i, url: cleanUrl(i.url) };
        return i;
      });
    }
    // ----------------------------------------

    if (inputProps.legendasSrt && inputProps.legendaUrl) {
      inputProps.legendaUrl = undefined;
    }

    // 1.1 Se vier legendaUrl mas não vier legendasSrt, baixa o SRT aqui no servidor
    if (inputProps.legendaUrl && !inputProps.legendasSrt) {
      console.log(`⬇️ Baixando SRT de: ${inputProps.legendaUrl}`);
      const r = await fetch(inputProps.legendaUrl, { redirect: "follow" });
      if (!r.ok) {
        throw new Error(
          `Falha ao baixar SRT da URL ${inputProps.legendaUrl}: ${r.status} ${r.statusText}`
        );
      }

      const text = await r.text();
      const head = text.slice(0, 400);
      if (!head.includes("-->")) {
        throw new Error(
          `Conteúdo baixado de ${inputProps.legendaUrl} não parece SRT (head: ${JSON.stringify(
            head
          )})`
        );
      }

      inputProps.legendasSrt = text;
      inputProps.legendaUrl = undefined;
    }

    console.log("=== NOVA REQUISIÇÃO DE RENDER ===");
    console.log(`Modelo: ${inputProps.modeloId}`);
    console.log(`Videos: ${inputProps.videos?.length || 0}`);
    console.log(`Imagens: ${inputProps.imagens?.length || 0}`);
    console.log(`Legendas: ${inputProps.legendasSrt ? "EMBUTIDA" : inputProps.legendaUrl ? "URL" : "NENHUMA"}`);
    console.log(`Tamanho SRT: ${inputProps.legendasSrt ? inputProps.legendasSrt.length : 0} chars`);

    const region = process.env.REMOTION_AWS_REGION;
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME?.trim();
    const { bucketName } = await getOrCreateBucket({ region }); // Garante bucket para cache

    // --- PRÉ-CACHE DE ASSETS (CRUCIAL PARA CONCURRENCY) ---
    console.log("🚀 Iniciando pré-cache de assets no S3...");
    
    // Cache de Áudios
    if (inputProps.audioUrl) inputProps.audioUrl = await cacheAssetOnS3(inputProps.audioUrl, bucketName, region);
    if (inputProps.musicaUrl) inputProps.musicaUrl = await cacheAssetOnS3(inputProps.musicaUrl, bucketName, region);
    if (inputProps.narracaoUrl) inputProps.narracaoUrl = await cacheAssetOnS3(inputProps.narracaoUrl, bucketName, region);
    
    // Cache de Vídeos
    if (Array.isArray(inputProps.videos)) {
      inputProps.videos = await Promise.all(inputProps.videos.map(async v => {
        if (typeof v === 'string') return { url: await cacheAssetOnS3(v, bucketName, region) };
        if (v && v.url) return { ...v, url: await cacheAssetOnS3(v.url, bucketName, region) };
        return v;
      }));
    }

    // Cache de Imagens
    if (Array.isArray(inputProps.imagens)) {
      inputProps.imagens = await Promise.all(inputProps.imagens.map(async i => {
        if (typeof i === 'string') return { url: await cacheAssetOnS3(i, bucketName, region) };
        if (i && i.url) return { ...i, url: await cacheAssetOnS3(i.url, bucketName, region) };
        return i;
      }));
    }
    console.log("✅ Pré-cache concluído!");
    // -----------------------------------------------------

    console.log(`🔧 Configuração Lambda:`);
    console.log(`   - Region: ${region}`);
    console.log(`   - Function: ${functionName}`);
    console.log(`   - AWS Key: ${process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 4) + '****' : 'MISSING'}`);

    const serveUrl = await resolveServeUrl({ region });

    console.log("🚀 Disparando render no Lambda...");
    console.log(`   - Serve URL: ${serveUrl}`);
    console.log(`   - Input Props (Size): ${JSON.stringify(inputProps).length} chars`);

    try {
      const timeoutMs = 40000;
      const renderPromise = renderMediaOnLambda({
        region,
        functionName,
        serveUrl,
        composition: inputProps.modeloId,
        inputProps,
        codec: "h264",
        crf: 26, // Otimização de tamanho (padrão 23, maior = menor arquivo/menor qualidade)
        audioBitrate: "128k", // Otimização de áudio
        pixelFormat: "yuv420p", // Garante compatibilidade
        concurrency: inputProps.concurrency || Number(process.env.REMOTION_CONCURRENCY || 100),
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
