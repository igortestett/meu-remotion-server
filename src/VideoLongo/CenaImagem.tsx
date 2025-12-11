import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const CenaImagem = ({ src }: { src: string }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Efeito Ken Burns: Zoom suave de 1.0 para 1.10
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.10],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};
