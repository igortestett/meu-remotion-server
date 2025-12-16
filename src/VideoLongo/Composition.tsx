// src/Compositions/VideoLongo.tsx

import React, { useMemo, useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  OffthreadVideo,
  delayRender,
  continueRender,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { parseSrt } from '@remotion/captions';
import { 
  CalculateMetadataFunction, 
} from 'remotion';
import { getVideoMetadata } from '@remotion/media-utils';

import { VideoLongoProps } from './types';
import { CenaImagem } from './CenaImagem';

// A função de metadados não precisa mudar, pois ela não depende das legendas.
export const calculateVideoLongoMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({
  props,
}) => {
  const fps = 30;
  let duracaoTotalSegundos = 0;

  const duracoesVideos = await Promise.all(
    props.videos.map(async (video) => {
      if (video.duracaoEmSegundos) return video.duracaoEmSegundos;
      try {
        const meta = await getVideoMetadata(video.url);
        return meta.durationInSeconds;
      } catch (e) {
        console.error("Erro metadados video", e);
        return 5;
      }
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
  // Props desestruturadas com os novos campos de áudio
  const { 
    videos, 
    imagens, 
    // Áudio
    audioUrl, 
    musicaUrl, 
    volumeMusica = 0.1, // Default baixo para fundo
    narracaoUrl, 
    volumeNarracao = 1.0, // Default alto para voz
    // Legendas
    legendasSrt, 
    legendaUrl 
  } = props;
  
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Define qual URL usar para música de fundo (prioriza musicaUrl)
  const backgroundAudio = musicaUrl || audioUrl;

  // --- LÓGICA DA LINHA DO TEMPO REFORMULADA ---
  const timeline = useMemo(() => {
    let currentFrame = 0;
    
    // 1. Processa vídeos
    const videoSequences = videos.map((video, index) => {
      // Se tiver duração definida, usa. Se não, usa um padrão (mas idealmente o metadata já preencheu isso)
      const duracaoFrames = Math.round((video.duracaoEmSegundos || 5) * fps);
      
      const element = (
        <Sequence 
          from={currentFrame} 
          durationInFrames={duracaoFrames} 
          key={`video-${index}`}
        >
          <OffthreadVideo 
            src={video.url} 
            // Garante que o vídeo não tenha áudio se não for desejado, 
            // mas o usuário disse "vídeos não possuem áudio", então OffthreadVideo padrão já serve.
            // Se quisesse forçar mudo: muted={true}
          />
        </Sequence>
      );
      
      currentFrame += duracaoFrames;
      return element;
    });

    const startFrameParaImagens = currentFrame;

    return { videoSequences, startFrameParaImagens };
  }, [videos, fps]);
  
  // --- LÓGICA DAS LEGENDAS CORRIGIDA PARA USAR URL ---
  const [handle] = useState(() => delayRender());
  const [srtData, setSrtData] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSrt = async () => {
      if (legendasSrt) {
        if (mounted) setSrtData(legendasSrt);
      } else if (legendaUrl) {
        try {
          const response = await fetch(legendaUrl);
          if (response.ok) {
            const text = await response.text();
            if (mounted) setSrtData(text);
          }
        } catch (e) {
          console.error("Falha ao buscar SRT da URL", e);
        }
      }
      
      if (mounted) continueRender(handle);
    };

    loadSrt();

    return () => {
      mounted = false;
    };
  }, [legendaUrl, legendasSrt, handle]);

  const captions = useMemo(() => {
    if (!srtData) return null;
    try {
      return parseSrt({ input: srtData }).captions;
    } catch {
      return null;
    }
  }, [srtData]);

  const currentCaption = useMemo(() => {
    if (!captions) return null;

    return captions.find((c: any) => {
      const startMs = typeof c.startMs === 'number' ? c.startMs : 0;
      const endMs = typeof c.endMs === 'number' ? c.endMs : 0;
      const startInFrames = Math.floor((startMs / 1000) * fps);
      const endInFrames = Math.ceil((endMs / 1000) * fps);
      return frame >= startInFrames && frame <= endInFrames;
    });
  }, [captions, frame, fps]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Vídeos Sequenciais */}
      {timeline.videoSequences}

      {/* Imagens (após os vídeos) com Fade */}
      <Sequence from={timeline.startFrameParaImagens}>
        {imagens && imagens.length > 0 && (
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
        )}
      </Sequence>

      {/* Música de Fundo */}
      {backgroundAudio && (
        <Audio 
          src={backgroundAudio} 
          volume={volumeMusica}
        />
      )}

      {/* Narração (Voz) */}
      {narracaoUrl && (
        <Audio 
          src={narracaoUrl} 
          volume={volumeNarracao}
        />
      )}

      {/* Legendas */}
      {currentCaption && (
        <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 }}>
          <div style={{ 
            fontSize: 50, 
            color: 'white', 
            textShadow: '2px 2px 4px black',
            textAlign: 'center',
            padding: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 10
          }}>
            {currentCaption.text}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
