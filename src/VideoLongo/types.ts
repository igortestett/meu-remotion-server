import { z } from "zod";

// Schema para Vídeos
// A duração é opcional pois podemos calcular via metadata se não for enviada
const VideoItemSchema = z.object({
  url: z.string(),
  duracaoEmSegundos: z.number().optional(),
});

// Schema para Imagens
// Imagens precisam de duração explícita
const ImagemItemSchema = z.object({
  url: z.string(),
  duracaoEmSegundos: z.number(),
});

export const VideoLongoSchema = z.object({
  // Áudio (Opcional)
  audioUrl: z.string().optional(),
  
  // Legendas (SRT direto ou URL)
  legendasSrt: z.string().optional(),
  legendaUrl: z.string().optional(),

  // Listas de Mídia
  // Usamos .optional().default([]) para que você possa enviar 
  // um JSON sem a chave 'videos' ou 'imagens' e o código não quebre.
  videos: z.array(VideoItemSchema).optional().default([]),
  
  imagens: z.array(ImagemItemSchema).optional().default([]),
});

export type VideoLongoProps = z.infer<typeof VideoLongoSchema>;
