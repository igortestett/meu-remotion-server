import { AbsoluteFill, Audio } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { VideoLongoProps } from "./types";
import { CenaImagem } from "./CenaImagem";
import { CalculateMetadataFunction } from "remotion";

// --- NOVA FUNÇÃO MÁGICA ---
export const calculateVideoLongoMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({
  props,
}) => {
  const fps = 30; // Garanta que bate com o Root
  
  // Se tiver imagens, soma a duração delas
  if (props.imagens && props.imagens.length > 0) {
    const segundos = props.imagens.reduce((total, img) => total + (img.duracaoEmSegundos || 5), 0);
    const totalFrames = Math.ceil(segundos * fps);
    
    return {
      durationInFrames: totalFrames,
      props, // Retorna as props inalteradas
    };
  }

  // Se não tiver imagens, usa 150 frames (5s) padrão
  return {
    durationInFrames: 150,
  };
};

export const VideoLongo = (props: VideoLongoProps) => {
  const { audioUrl, imagens } = props;

  // Se não tiver imagens (fallback), não quebra
  if (!imagens || imagens.length === 0) return null;

  return (
    <AbsoluteFill>
      {audioUrl && <Audio src={audioUrl} />}

      <TransitionSeries>
        {imagens.map((cena, index) => {
          const duracaoFrames = Math.round((cena.duracaoEmSegundos || 5) * 30);
          
          return (
            <React.Fragment key={index}>
              <TransitionSeries.Sequence durationInFrames={duracaoFrames}>
                <CenaImagem src={cena.url} />
              </TransitionSeries.Sequence>

              {index < imagens.length - 1 && (
                <TransitionSeries.Transition
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: 30 })}
                />
              )}
            </React.Fragment>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};

// Importante: React.Fragment precisa do import React se não estiver global.
import React from 'react'; 
