// src/Compositions/VideoLongo.tsx

import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  Sequence, // <--- NOVO: Para posicionar os vídeos
  Video,    // <--- NOVO: Para renderizar os vídeos
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { parseSrt } from '@remotion/captions';
import { 
  CalculateMetadataFunction, 
  getVideoMetadata // <--- NOVO: Para buscar a duração dos vídeos
} from 'remotion'; 

import { VideoLongoProps } from '../types';
import { CenaImagem } from '../components/CenaImagem';

// --- FUNÇÃO DE METADADOS 100% CORRIGIDA ---
// Agora calcula a duração total somando os vídeos e as imagens.
export const calculateVideoLongoMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({
  props,
  fps,
}) => {
  let duracaoTotalSegundos = 0;

  // 1. Calcula a duração dos vídeos
  const duracoesVideos = await Promise.all(
    props.videos.map(async (video) => {
      // Se a duração foi fornecida, use-a.
      if (video.duracaoEmSegundos) {
        return video.duracaoEmSegundos;
      }
      // Senão, busque os metadados para descobrir a duração.
      const meta = await getVideoMetadata(video.url);
      return meta.durationInSeconds;
    })
  );
  duracaoTotalSegundos += duracoesVideos.reduce((sum, dur) => sum + dur, 0);

  // 2. Calcula a duração das imagens
  const duracaoImagens = props.imagens.reduce(
    (sum, img) => sum + img.duracaoEmSegundos,
    0
  );
  duracaoTotalSegundos += duracaoImagens;

  return {
    durationInFrames: Math.ceil(duracaoTotalSegundos * fps),
    props,
  };
};


// --- COMPONENTE 100% CORRIGIDO ---
export const VideoLongo = (props: VideoLongoProps) => {
  const { videos, imagens, audioUrl, legendasSrt } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- LÓGICA DA LINHA DO TEMPO (TIMELINE) ---
  // useMemo para calcular as posições apenas uma vez
  const timeline = useMemo(() => {
    let currentFrame = 0;

    // Gera as sequências de vídeo
    const videoElements = videos.map((video, index) => {
      // A duração em frames precisa ser calculada aqui novamente para o posicionamento
      // NOTA: Para performance máxima, a duração calculada em `calculateMetadata` poderia ser passada via props.
      const duracaoFrames = Math.round((video.duracaoEmSegundos || 5) * fps); // Fallback de 5s
      
      const element = (
        <Sequence from={currentFrame} durationInFrames={duracaoFrames} key={`video-${index}`}>
          <Video src={video.url} />
        </Sequence>
      );
      currentFrame += duracaoFrames;
      return element;
    });

    // O ponto de início para a sequência de imagens é após o término de todos os vídeos
    const startFrameParaImagens = currentFrame;

    return { videoElements, startFrameParaImagens };
  }, [videos, fps]);
  
  // --- LÓGICA DAS LEGENDAS (mantida igual, já estava correta) ---
  const currentCaption = useMemo(() => {
    if (!legendasSrt) return null;
    const captions = parseSrt({ input: legendasSrt, fps }).captions;
    return captions.find(c => frame >= c.startInFrames && frame <= c.endInFrames);
  }, [frame, fps, legendasSrt]);


  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audioUrl && <Audio src={audioUrl} />}

      {/* Camada dos Vídeos (Renderizados primeiro) */}
      {timeline.videoElements}

      {/* Camada das Imagens (Renderizadas após os vídeos) */}
      {imagens && imagens.length > 0 && (
        <Sequence from={timeline.startFrameParaImagens}>
          <TransitionSeries>
            {imagens.map((cena, index) => (
              <React.Fragment key={index}>
                <TransitionSeries.Sequence durationInFrames={Math.round(cena.duracaoEmSegundos * fps)}>
                  <CenaImagem src={cena.url} />
                </TransitionSeries.Sequence>
                {index < imagens.length - 1 && (
                  <TransitionSeries.Transition
                    presentation={fade()}
                    timing={linearTiming({ durationInFrames: 30 })}
                  />
                )}
              </React.Fragment>
            ))}
          </TransitionSeries>
        </Sequence>
      )}

      {/* Camada das Legendas (Sempre na frente) */}
      {currentCaption && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 }}>
          <div style={{
              textAlign: 'center', fontSize: 50, color: 'white', fontFamily: 'sans-serif',
              fontWeight: 'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.8)', padding: '0 30px', maxWidth: '90%'
            }}>
            {currentCaption.text}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
