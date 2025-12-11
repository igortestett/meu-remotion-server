import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { VideoLongoProps } from "./types";
import { CenaImagem } from "./CenaImagem";

export const VideoLongo = (props: VideoLongoProps) => {
  const { audioUrl, imagens } = props;

  return (
    <AbsoluteFill>
      {/* 1. Camada de Áudio */}
      {audioUrl && <Audio src={audioUrl} />}

      {/* 2. Camada Visual (Sequência com Transições) */}
      <TransitionSeries>
        {imagens.map((cena, index) => {
          // Converte segundos para frames (assumindo 30fps)
          const duracaoFrames = Math.round(cena.duracaoEmSegundos * 30);
          
          return (
            <>
              <TransitionSeries.Sequence durationInFrames={duracaoFrames}>
                <CenaImagem src={cena.url} />
              </TransitionSeries.Sequence>

              {/* Adiciona transição Fade entre as imagens (menos na última) */}
              {index < imagens.length - 1 && (
                <TransitionSeries.Transition
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: 30 })} // 1 segundo de transição
                />
              )}
            </>
          );
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
