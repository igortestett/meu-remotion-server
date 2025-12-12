// src/Root.tsx
import React from "react";
import { Composition, CalculateMetadataFunction } from "remotion";
import { getVideoMetadata } from "@remotion/media-utils";

import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";

import { VideoLongo } from "./VideoLongo/Composition";
import { VideoLongoSchema, type VideoLongoProps } from "./types";

const calculateMetadata: CalculateMetadataFunction<VideoLongoProps> = async ({ props }) => {
  const fps = 30;

  const listaVideos = props.videos ?? [];
  const listaImagens = props.imagens ?? [];

  const videosProcessados = await Promise.all(
    listaVideos.map(async (video) => {
      if (video.duracaoEmSegundos) return video;

      try {
        const metadata = await getVideoMetadata(video.url);
        return { ...video, duracaoEmSegundos: metadata.durationInSeconds };
      } catch (err) {
        console.error(`Erro ao ler metadata do vídeo ${video.url}`, err);
        return { ...video, duracaoEmSegundos: 5 };
      }
    })
  );

  const tempoVideos = videosProcessados.reduce((acc, v) => acc + (v.duracaoEmSegundos || 0), 0);
  const tempoImagens = listaImagens.reduce((acc, img) => acc + img.duracaoEmSegundos, 0);

  const totalDurationInFrames = Math.ceil((tempoVideos + tempoImagens) * fps);

  return {
    fps,
    durationInFrames: totalDurationInFrames > 0 ? totalDurationInFrames : 30,
    props: {
      ...props,
      videos: videosProcessados,
      imagens: listaImagens,
    },
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

      <Composition
        id="VideoLongo"
        component={VideoLongo}
        schema={VideoLongoSchema}
        calculateMetadata={calculateMetadata}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          videos: [],
          imagens: [{ url: "https://picsum.photos/seed/1/1080/1920", duracaoEmSegundos: 5 }],
          legendasSrt: undefined,
          legendaUrl: undefined,
        }}
      />
    </>
  );
};
