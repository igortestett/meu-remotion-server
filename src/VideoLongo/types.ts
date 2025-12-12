// src/types.ts
import { z } from "zod";

// Item de vídeo
export const VideoItemSchema = z.object({
  url: z.string(),
  duracaoEmSegundos: z.number().optional(),
});

// Item de imagem
export const ImagemItemSchema = z.object({
  url: z.string(),
  duracaoEmSegundos: z.number(),
});

// Schema principal (props da composição)
export const VideoLongoSchema = z.object({
  videos: z.array(VideoItemSchema).optional().default([]),
  imagens: z.array(ImagemItemSchema).optional().default([]),

  audioUrl: z.string().optional(),

  // legenda pode vir como conteúdo (string) OU por URL
  legendasSrt: z.string().optional(),
  legendaUrl: z.string().optional(),
});

// Tipo TS inferido do schema
export type VideoLongoProps = z.infer<typeof VideoLongoSchema>;
