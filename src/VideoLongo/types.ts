import { z } from "zod";

export const VideoLongoSchema = z.object({
  // Ajustado para optional() para casar com a lógica do componente (pode haver vídeos sem áudio)
  audioUrl: z.string().optional(),
  
  // CAMPO NOVO: String contendo o texto do arquivo .srt
  legendasSrt: z.string().optional(),
  
  // Mantido para compatibilidade, caso queira passar a URL ao invés do conteúdo direto
  legendaUrl: z.string().optional(),

  imagens: z.array(
    z.object({
      url: z.string(),
      duracaoEmSegundos: z.number(),
    })
  ),
});

export type VideoLongoProps = z.infer<typeof VideoLongoSchema>;
