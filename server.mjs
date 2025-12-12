import express from "express";
import { bundle } from "@remotion/bundler";
import { 
  deploySite, 
  getOrCreateBucket, 
  renderMediaOnLambda,
  getRenderProgress
} from "@remotion/lambda";
import path from "path";

const app = express();
app.use(express.json());

// Rota de teste
app.get("/", (req, res) => res.send("Controlador Lambda OTIMIZADO (15min timeout) OK!"));

// Rota de Renderização (Assíncrona)
app.post("/render", async (req, res) => {
  try {
    const inputProps = req.body;
    const region = process.env.REMOTION_AWS_REGION || "us-east-2";
    
    // IMPORTANTE: Certifique-se de que esta variável no seu .env ou Easypanel
    // está apontando para a NOVA função que você criou (a que tem 900sec no nome/config)
    // Se deixar a antiga, pode dar erro de mismatch.
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    if (!functionName) {
      throw new Error("Faltou configurar a variável REMOTION_LAMBDA_FUNCTION_NAME");
    }

    console.log("1. Empacotando código...");
    const entry = "./src/index.ts";
    // Nota: O bundle pode demorar um pouco, mas é local no servidor
    const bundled = await bundle(path.join(process.cwd(), entry));

    console.log("2. Subindo para AWS S3...");
    const { bucketName } = await getOrCreateBucket({ region });
    
    const { serveUrl } = await deploySite({
      bucketName,
      entryPoint: path.join(process.cwd(), entry),
      region,
      siteName: "meu-gerador-video", 
    });

    console.log("3. Disparando Lambda (Modo Otimizado para Contas Novas)...");
    
    // Cálculo de Duração
    let duracao = 300; // default 10s
    if (inputProps.imagens && Array.isArray(inputProps.imagens)) {
        const seg = inputProps.imagens.reduce((acc, img) => acc + (img.duracaoEmSegundos||5), 0);
        duracao = Math.ceil(seg * 30);
    }

    console.log(`Duração estimada: ${duracao} frames. Usando função: ${functionName}`);

    const { renderId, bucketName: outputBucket } = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: inputProps.modeloId || "VideoLongo",
      inputProps,
      codec: "h264",
      
      // --- CONFIGURAÇÕES CRITICAS PARA EVITAR ERROS ---
      
      framesPerLambda: 100, 

      // 2. Definimos o timeout explicitamente para 15 minutos (900s)
      // Isso evita que o robô morra no meio do processamento longo.
      timeoutInSeconds: 900,

      // 3. Segurança contra falhas de rede
      retries: 1,
      
      // ------------------------------------------------
      
      defaultProps: {
          durationInFrames: duracao
      }
    });

    console.log(`Render iniciado! ID: ${renderId}`);

    // Responde RÁPIDO para o n8n não dar timeout
    res.json({
      status: "rendering",
      renderId,
      region,
      bucketName: outputBucket,
      checkUrl: `/status/${renderId}`
    });

  } catch (err) {
    console.error("ERRO CRÍTICO NO RENDER:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Rota de Status (Polling)
app.get("/status/:renderId", async (req, res) => {
    try {
        const { renderId } = req.params;
        const region = process.env.REMOTION_AWS_REGION || "us-east-2";
        const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
        
        const { bucketName } = await getOrCreateBucket({ region });

        const progress = await getRenderProgress({
            renderId,
            bucketName,
            functionName,
            region
        });
        
        if (progress.done) {
            console.log(`Render ${renderId} finalizado! URL: ${progress.outputFile}`);
            res.json({ 
                status: "done", 
                url: progress.outputFile,
                custo: progress.costs 
            });
        } else {
            // Se der erro fatal no Lambda
            if (progress.fatalErrorEncountered) {
                 console.error(`Erro fatal no render ${renderId}:`, progress.errors);
                 return res.status(500).json({ status: "error", error: progress.errors });
            }

            res.json({ 
                status: "processing", 
                progress: Math.round(progress.overallProgress * 100) + "%",
                chunks: progress.chunks // Opcional: para debug
            });
        }
    } catch (err) {
        console.error("Erro ao checar status:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Servidor Lambda rodando na porta 3000"));
