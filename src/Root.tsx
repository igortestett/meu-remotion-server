import React from 'react';
import { Composition, CalculateMetadataFunction } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils"; // <--- Importante para ler duração de vídeo

// Imports dos exemplos padrão (mantidos)
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";

// Imports do seu projeto
import { VideoLongo } from './VideoLongo/Composition';
import { VideoLongoProps, VideoLongoSchema } from './types'; // Importe o Schema e Type atualizados

// --- FUNÇÃO INTELIGENTE DE CÁLCULO DE DURAÇÃO ---
const calculateMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({ props }) => {
  const fps = 30;

  // Garante arrays vazios caso venha undefined
  const listaVideos = props.videos || [];
  const listaImagens = props.imagens || [];

  // 1. Processa VÍDEOS: Se não tiver duração, descobre baixando o metadata
  const videosProcessados = await Promise.all(
    listaVideos.map(async (video) => {
      // Se já tem duração, usa ela
      if (video.duracaoEmSegundos) {
        return video;
      }
      // Se não tem, tenta descobrir
      try {
        const metadata = await getVideoMetadata(video.url);
        return {
          ...video,
          duracaoEmSegundos: metadata.durationInSeconds
        };
      } catch (err) {
        console.error(`Erro ao ler metadata do vídeo ${video.url}`, err);
        // Fallback: 5 segundos se falhar
        return { ...video, duracaoEmSegundos: 5 };
      }
    })
  );

  // 2. Calcula tempos totais
  const tempoVideos = videosProcessados.reduce((acc, v) => acc + (v.duracaoEmSegundos || 0), 0);
  const tempoImagens = listaImagens.reduce((acc, img) => acc + img.duracaoEmSegundos, 0);

  // 3. Define total de frames
  const totalDurationInFrames = Math.ceil((tempoVideos + tempoImagens) * fps);

  return {
    // Garante no mínimo 1 segundo (30 frames) para não quebrar o render
    durationInFrames: totalDurationInFrames > 0 ? totalDurationInFrames : 30,
    fps,
    props: {
      ...props,
      // Passa a lista atualizada (com durações preenchidas) para o componente
      videos: videosProcessados as any, 
      imagens: listaImagens
    }
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      <Composition
        id="OnlyLogo"
        component={Logo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        schema={myCompSchema2}
        defaultProps={{
          logoColor1: "#91dAE2" as const,
          logoColor2: "#86A8E7" as const,
        }}
      /> 

      {/* --- SEU VIDEO LONGO E DINÂMICO --- */}
      <Composition
        id="VideoLongo"
        component={VideoLongo}
        schema={VideoLongoSchema} // Conecta o Zod Schema para validação
        calculateMetadata={calculateMetadata} // Usa a função inteligente criada acima
        fps={30}
        width={1080} // Ajustei para 1080x1920 (Vertical/Shorts) ou use 1920x1080 se for paisagem
        height={1920}
        // Props padrão para quando você abrir o preview local
        defaultProps={{
          audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          // Exemplo misto: 1 vídeo (sem duração, para testar o calculo) + 1 imagem
          videos: [
             // Pode deixar vazio ou colocar url de teste
             // { url: "LINK_DE_UM_MP4_PUBLICO" } 
          ],
          imagens: [
            { url: "https://picsum.photos/seed/1/1080/1920", duracaoEmSegundos: 5 },
          ]
        }}
      />
    </>
  );
};
