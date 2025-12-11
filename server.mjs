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
    
    // O template HelloWorld usa "src/index.ts" como entrada
    const entry = "./src/index.ts";
    
    console.log("Criando bundle...");
    const bundled = await bundle(path.join(process.cwd(), entry));

    console.log("Selecionando composição...");
    const composition = await selectComposition({
      serveUrl: bundled,
      id: inputProps.modeloId || "HelloWorld", // ID padrão do template
      inputProps,
    });

    const outputLocation = `/tmp/video-${Date.now()}.mp4`;
    
    console.log("Renderizando...");
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation,
      inputProps,
    });

    const inputProps = req.body;

// CÁLCULO MÁGICO DE DURAÇÃO
// Se for o template VideoLongo, calcula frames totais baseados nas imagens
let duracaoTotal = 150; // default
if (inputProps.imagens) {
  const segundos = inputProps.imagens.reduce((total, img) => total + img.duracaoEmSegundos, 0);
  duracaoTotal = Math.ceil(segundos * 30); // 30 fps
}

// Agora passamos a durationInFrames forçada para o selectComposition
const composition = await selectComposition({
  serveUrl: bundled,
  id: inputProps.modeloId || "VideoLongo",
  inputProps,
  defaultProps: {
    durationInFrames: duracaoTotal // <--- O servidor força a duração correta aqui!
  }
});

    res.download(outputLocation);
    
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro na renderização: " + err.message);
  }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
