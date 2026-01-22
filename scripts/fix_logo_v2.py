from PIL import Image
import sys
import os

def fix_logo():
    input_path = "d:/fatopago/public/logo.png"
    output_path = "d:/fatopago/public/logo.png"
    
    if not os.path.exists(input_path):
        print(f"Erro: Arquivo não encontrado: {input_path}")
        return

    try:
        img = Image.open(input_path).convert("RGBA")
    except Exception as e:
        print(f"Erro ao abrir imagem: {e}")
        return

    width, height = img.size
    pixels = img.load()

    # 1. Detectar divisor entre ícone e texto
    # Varre da esquerda para a direita procurando uma coluna vazia
    split_x = int(width * 0.35) # Fallback padrão
    
    start_search = int(width * 0.20)
    end_search = int(width * 0.60)
    
    # Procura gap
    gap_start = -1
    gap_end = -1
    
    for x in range(start_search, end_search):
        is_column_empty = True
        for y in range(height):
            _, _, _, a = pixels[x, y]
            if a > 20: # Considera pixel visível se alpha > 20
                is_column_empty = False
                break
        
        if is_column_empty:
            if gap_start == -1:
                gap_start = x
            gap_end = x
        else:
            if gap_start != -1:
                # Achamos um gap e ele acabou. Vamos usar o meio dele.
                if (gap_end - gap_start) > 2: # Pelo menos 2 pixels de largura
                    split_x = gap_start + (gap_end - gap_start) // 2
                    print(f"Gap detectado entre x={gap_start} e x={gap_end}. Corte em {split_x}")
                    break
                gap_start = -1 # Falso positivo ou gap muito pequeno, reseta
    
    if gap_start == -1:
        print(f"Gap claro não detectado. Usando corte padrão em {split_x}")

    # 2. Processar pixels
    for x in range(width):
        for y in range(height):
            r, g, b, a = pixels[x, y]
            
            if a == 0: continue

            # LADO DIREITO (TEXTO) -> Pintar de Branco
            if x > split_x:
                # Mantém alpha original, muda cor para Branco
                pixels[x, y] = (255, 255, 255, a)
            
            # LADO ESQUERDO (ÍCONE) -> Tentar limpar halos
            else:
                # O ícone tem roxo e branco (check).
                # Halos indesejados costumam ser cinzas/brancos semi-transparentes nas bordas do roxo.
                
                # É parte do Check Branco? (Alta luminosidade, baixa saturação)
                is_white_check = r > 220 and g > 220 and b > 220
                
                # É Roxo? (R e B predominantes sobre G)
                is_purple = (r > g + 10) and (b > g + 10)
                
                if is_white_check:
                    # Mantém o check branco puro
                    continue
                
                if is_purple:
                    # Mantém o roxo
                    continue
                
                # Se não é check nem roxo, é provável que seja halo ou antialiasing sujo.
                # Especialmente se for claro.
                lum = (r + g + b) / 3
                if lum > 150:
                    # Reduz opacidade de pixels claros que não são o check
                    new_a = int(a * 0.0) # Remove totalmente
                    pixels[x, y] = (r, g, b, new_a)

    img.save(output_path)
    print(f"Sucesso! Imagem salva em {output_path}")

if __name__ == "__main__":
    fix_logo()
