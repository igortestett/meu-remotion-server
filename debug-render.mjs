import { renderMediaOnLambda } from "@remotion/lambda";
import dotenv from "dotenv";

dotenv.config();

const region = process.env.REMOTION_AWS_REGION;
const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
const serveUrl = process.env.REMOTION_SERVE_URL;

const inputProps = {
  modeloId: "VideoLongo",
  videos: [
    {
      url: "https://auto4-minio.5b1qbq.easypanel.host/nca-toolkit/5e531bc6096983a88591a05dfc4567ad.mp4",
      duracaoEmSegundos: 6
    },
    {
      url: "https://auto4-minio.5b1qbq.easypanel.host/nca-toolkit/49d338be004cb1b8dc25d0d5f1568765.mp4",
      duracaoEmSegundos: 6
    }
  ],
  imagens: [
    {
      url: "https://tempfile.aiquickdraw.com/workers/nano/image_1765842208448_mnyv11_16x9_1024x576.png",
      duracaoEmSegundos: 30
    },
    {
      url: "https://tempfile.aiquickdraw.com/workers/nano/image_1765842214932_2u4s4p_16x9_1024x576.png",
      duracaoEmSegundos: 30
    }
  ],
  narracaoUrl: "https://auto4-minio.5b1qbq.easypanel.host/nca-toolkit/merged_66028.wav",
  volumeNarracao: 1.0
};

console.log("🔧 Configuração:");
console.log(`Region: ${region}`);
console.log(`Function: ${functionName}`);
console.log(`ServeURL: ${serveUrl}`);

async function run() {
  console.log("🚀 Iniciando teste isolado...");
  try {
    const result = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: "VideoLongo",
      inputProps,
      codec: "h264",
      logLevel: "verbose",
    });
    console.log("✅ SUCESSO:", result);
  } catch (e) {
    console.error("❌ ERRO:", e);
  }
}

run();
