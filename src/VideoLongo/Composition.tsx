// src/Compositions/VideoLongo.tsx

import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Video,
  useAsync, // <--- NOVO: Para buscar dados de uma URL
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { parseSrt } from '@remotion/captions';
import { 
  CalculateMetadataFunction, 
  getVideoMetadata 
} from 'remotion'; 

import { VideoLongoProps } from '../types';
import { CenaImagem } from '../components/CenaImagem';

// A função de metadados não precisa mudar, pois ela não depende das legendas.
export const calculateVideoLongoMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({
  props,
  fps,
}) => {
  let duracaoTotalSegundos = 0;

  const duracoesVideos = await Promise.all(
    props.videos.map(async (video) => {
      if (video.duracaoEmSegundos) return video.duracaoEmSegundos;
      const meta = await getVideoMetadata(video.url);
      return meta.durationInSeconds;
    })
  );
  duracaoTotalSegundos += duracoesVideos.reduce((sum, dur) => sum + dur, 0);

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
  // Adiciona `legendaUrl` à desestruturação das props
  const { videos, imagens, audioUrl, legendasSrt, legendaUrl } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- LÓGICA DA LINHA DO TEMPO (mantida igual) ---
  const timeline = useMemo(() => {
    let currentFrame = 0;
    const videoElements = videos.map((video, index) => {
      const duracaoFrames = Math.round((video.duracaoEmSegundos || 5) * fps);
      const element = (
        <Sequence from={currentFrame} durationInFrames={duracaoFrames} key={`video-${index}`}>
          <Video src={video.url} />
        </Sequence>
      );
      currentFrame += duracaoFrames;
      return element;
    });
    const startFrameParaImagens = currentFrame;
    return { videoElements, startFrameParaImagens };
  }, [videos, fps]);
  
  // --- LÓGICA DAS LEGENDAS CORRIGIDA PARA USAR URL ---
  // 1. Buscamos o conteúdo do SRT de forma assíncrona
  const srtContent = useAsync(async () => {
    // Prioridade para a URL
    if (legendaUrl) {
      try {
        const response = await fetch(legendaUrl);
        if (!response.ok) return null; // Falha na requisição
        return await response.text();
      } catch (e) {
        console.error("Falha ao buscar SRT da URL", e);
        return null;
      }
    }
    // Fallback para o conteúdo direto
    return legendasSrt || null;
  }, [legendaUrl, legendasSrt]);

  // 2. Fazemos o parse do conteúdo quando ele estiver disponível
  const currentCaption = useMemo(() => {
    // Se o conteúdo ainda não foi carregado ou não existe, não faz nada.
    if (!srtContent.data) return null;
    
    const captions = parseSrt({ input: srtContent.data, fps }).captions;
    return captions.find(c => frame >= c.startInFrames && frame <= c.endInFrames);
  }, [frame, fps, srtContent.data]); // Depende do DADO carregado, não da prop


  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {audioUrl && <Audio src={audioUrl} />}
      {timeline.videoElements}
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
