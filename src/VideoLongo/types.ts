// src/types.ts
// Nenhuma grande correção necessária aqui, sua estrutura já estava ótima.

import { z } from "zod";

// Schema para um item de vídeo individual
const VideoItemSchema = z.object({
  url: z.string(),
  // Duração opcional. Se não for fornecida, será calculada a partir dos metadados do vídeo.
  duracaoEmSegundos: z.number().optional(),
});

// Schema para um item de imagem individual
const ImagemItemSchema = z.object({
  url: z.string(),
  // Duração obrigatória para imagens, pois não têm duração intrínseca.
  duracaoEmSegundos: z.number(),
});

// Schema principal que define todas as props da composição
export const VideoLongoProps = z.object({
  // Lista de vídeos que tocarão no início.
  // .default([]) garante que o app não quebre se a chave 'videos' não for enviada.
  videos: z.array(VideoItemSchema).optional().default([]),

  // Lista de imagens que tocarão após os vídeos.
  imagens: z.array(ImagemItemSchema).optional().default([]),
  
  // URL para uma única faixa de áudio de fundo (opcional).
  audioUrl: z.string().optional(),
  
  // Conteúdo de um arquivo .srt para as legendas (opcional).
  legendasSrt: z.string().optional(),
});

// Exporta o tipo inferido para ser usado no React
export type VideoLongoProps = z.infer<typeof VideoLongoProps>;
