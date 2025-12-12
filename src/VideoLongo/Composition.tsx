import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { parseSrt } from "@remotion/captions"; // <--- NOVO IMPORT
import { CalculateMetadataFunction } from "remotion";

import { VideoLongoProps } from "./types";
import { CenaImagem } from "./CenaImagem";

// --- NOVA FUNÇÃO MÁGICA (Mantida igual, apenas garantindo que props passem) ---
export const calculateVideoLongoMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({
  props,
}) => {
  const fps = 30;
  
  if (props.imagens && props.imagens.length > 0) {
    const segundos = props.imagens.reduce((total, img) => total + (img.duracaoEmSegundos || 5), 0);
    const totalFrames = Math.ceil(segundos * fps);
    
    return {
      durationInFrames: totalFrames,
      props, 
    };
  }

  return {
    durationInFrames: 150,
  };
};

export const VideoLongo = (props: VideoLongoProps) => {
  // Adicione 'legendasSrt' na desestruturação
  const { audioUrl, imagens, legendasSrt } = props; 
  
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- LÓGICA DAS LEGENDAS ---
  // Usamos useMemo para não fazer o parse do SRT a cada frame (performance)
  const currentCaption = useMemo(() => {
    if (!legendasSrt) return null;

    const { captions } = parseSrt({
      input: legendasSrt,
      fps,
    });

    return captions.find((caption) => {
      const startFrame = (caption.startMs / 1000) * fps;
      const endFrame = (caption.endMs / 1000) * fps;
      return frame >= startFrame && frame <= endFrame;
    });
  }, [frame, fps, legendasSrt]);
  // ---------------------------

  if (!imagens || imagens.length === 0) return null;

  return (
    <AbsoluteFill>
      {audioUrl && <Audio src={audioUrl} />}

      {/* Camada das Imagens (Fundo) */}
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

      {/* Camada das Legendas (Frente) */}
      {currentCaption && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 }}>
          <div
            style={{
              textAlign: 'center',
              fontSize: 50,
              color: 'white',
              fontFamily: 'sans-serif',
              fontWeight: 'bold',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)', // Sombra para leitura em qualquer fundo
              padding: '0 30px',
              maxWidth: '90%'
            }}
          >
            {currentCaption.text}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
