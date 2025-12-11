import { z } from "zod";

export const VideoLongoSchema = z.object({
  audioUrl: z.string(),
  legendaUrl: z.string().optional(), // Opcional por enquanto (SRT é complexo, vamos focar no áudio+imagem primeiro)
  imagens: z.array(
    z.object({
      url: z.string(),
      duracaoEmSegundos: z.number(),
    })
  ),
});

export type VideoLongoProps = z.infer<typeof VideoLongoSchema>;
