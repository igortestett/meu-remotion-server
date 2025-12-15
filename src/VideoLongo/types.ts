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

  // Áudio e Narração
  audioUrl: z.string().optional().describe("URL para música de fundo (legado, prefira musicaUrl)"),
  musicaUrl: z.string().optional().describe("URL para música de fundo"),
  volumeMusica: z.number().min(0).max(1).optional().default(0.1),
  
  narracaoUrl: z.string().optional().describe("URL para narração/voz"),
  volumeNarracao: z.number().min(0).max(1).optional().default(1.0),

  // legenda pode vir como conteúdo (string) OU por URL
  legendasSrt: z.string().optional(),
  legendaUrl: z.string().optional(),
});

// Tipo TS inferido do schema
export type VideoLongoProps = z.infer<typeof VideoLongoSchema>;
