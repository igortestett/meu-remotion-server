import { Composition } from "remotion";
import { HelloWorld, myCompSchema } from "./HelloWorld";
import { Logo, myCompSchema2 } from "./HelloWorld/Logo";

// Import único e correto para o VideoLongo e sua função de metadata
import { VideoLongo, calculateVideoLongoMetadata } from './VideoLongo/Composition';

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        // You can take the "id" to render a video:
        // npx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        schema={myCompSchema}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
          logoColor1: "#91EAE4",
          logoColor2: "#86A8E7",
        }}
      />

      {/* Mount any React component to make it show up in the sidebar and work on it individually! */}
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

      {/* Novo VideoLongo com cálculo automático de duração */}
      <Composition
        id="VideoLongo"
        component={VideoLongo}
        durationInFrames={150} // Valor padrão (será ignorado se calculateMetadata funcionar)
        fps={30}
        width={1920}
        height={1080}
        calculateMetadata={calculateVideoLongoMetadata} 
        defaultProps={{
          audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
          imagens: [
            { url: "https://picsum.photos/seed/1/1920/1080", duracaoEmSegundos: 5 },
          ]
        }}
      />
    </>
  );
};
