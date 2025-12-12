// src/types.ts
// Adicionamos `legendaUrl` como um campo opcional.

import { z } from "zod";

// Schema para um item de vídeo individual
const VideoItemSchema = z.object({
  url: z.string(),
  duracaoEmSegundos: z.number().optional(),
});

// Schema para um item de imagem individual
const ImagemItemSchema = z.object({
  url: z.string(),
  duracaoEmSegundos: z.number(),
});

// Schema principal que define todas as props da composição
export const VideoLongoProps = z.object({
  // Lista de vídeos que tocarão no início.
  videos: z.array(VideoItemSchema).optional().default([]),

  // Lista de imagens que tocarão após os vídeos.
  imagens: z.array(ImagemItemSchema).optional().default([]),
  
  // URL para uma única faixa de áudio de fundo (opcional).
  audioUrl: z.string().optional(),
  
  // --- MUDANÇA AQUI ---
  // Permitimos AMBOS os formatos de legenda. O componente priorizará a URL.
  legendasSrt: z.string().optional(), // Conteúdo direto do SRT
  legendaUrl: z.string().optional(),  // URL para o arquivo .srt
});

// Exporta o tipo inferido para ser usado no React
export type VideoLongoProps = z.infer<typeof VideoLongoProps>;
