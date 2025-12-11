import express from "express";
import { bundle } from "@remotion/bundler";
import { 
  deploySite, 
  getOrCreateBucket, 
  renderMediaOnLambda,
  getRenderProgress
} from "@remotion/lambda/client";
import path from "path";

const app = express();
app.use(express.json());

// Rota de teste
app.get("/", (req, res) => res.send("Controlador Lambda OK!"));

// Rota de Renderização (Assíncrona)
app.post("/render", async (req, res) => {
  try {
    const inputProps = req.body;
    const region = process.env.REMOTION_AWS_REGION || "us-east-1";
    const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;

    if (!functionName) {
      throw new Error("Faltou configurar a variável REMOTION_LAMBDA_FUNCTION_NAME");
    }

    console.log("1. Empacotando código...");
    const entry = "./src/index.ts";
    const bundled = await bundle(path.join(process.cwd(), entry));

    console.log("2. Subindo para AWS S3...");
    const { bucketName } = await getOrCreateBucket({ region });
    
    const { serveUrl } = await deploySite({
      bucketName,
      entryPoint: path.join(process.cwd(), entry),
      region,
      siteName: "meu-gerador-video", 
    });

    console.log("3. Disparando Lambda...");
    
    // Cálculo de Duração (igual fazíamos antes)
    let duracao = 300; // default 10s
    if (inputProps.imagens && Array.isArray(inputProps.imagens)) {
        const seg = inputProps.imagens.reduce((acc, img) => acc + (img.duracaoEmSegundos||5), 0);
        duracao = Math.ceil(seg * 30);
    }

    const { renderId, bucketName: outputBucket } = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: inputProps.modeloId || "VideoLongo",
      inputProps,
      codec: "h264",
      framesPerLambda: 200, // Cada robô faz 6 segundos de vídeo
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Rota de Status (Polling)
app.get("/status/:renderId", async (req, res) => {
    try {
        const { renderId } = req.params;
        const region = process.env.REMOTION_AWS_REGION || "us-east-1";
        const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
        
        // Descobre qual bucket o Remotion usou (padrão)
        const { bucketName } = await getOrCreateBucket({ region });

        const progress = await getRenderProgress({
            renderId,
            bucketName,
            functionName,
            region
        });
        
        if (progress.done) {
            res.json({ 
                status: "done", 
                url: progress.outputFile,
                custo: progress.costs 
            });
        } else {
            // Se der erro fatal no Lambda
            if (progress.fatalErrorEncountered) {
                 return res.status(500).json({ status: "error", error: progress.errors });
            }

            res.json({ 
                status: "processing", 
                progress: Math.round(progress.overallProgress * 100) + "%"
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log("Servidor Lambda rodando na porta 3000"));
