from PIL import Image
import os
import math

def distance(c1, c2):
    (r1, g1, b1) = c1
    (r2, g2, b2) = c2
    return math.sqrt((r1 - r2)**2 + (g1 - g2)**2 + (b1 - b2)**2)

def process_logo():
    # Agora lê o JPEG e salva como PNG
    input_path = "d:/fatopago/public/LOGOFOTO.jpeg"
    output_path = "d:/fatopago/public/logo.png"
    
    if not os.path.exists(input_path):
        print(f"Erro: Arquivo {input_path} não encontrado.")
        # Tenta ler o logo.png se o jpg não existir (fallback)
        if os.path.exists(output_path):
             input_path = output_path
             print(f"Usando {input_path} como fallback.")
        else:
             return

    print(f"Processando {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    
    datas = img.getdata()
    new_data = []
    
    # Amostra a cor do canto superior esquerdo para detectar o fundo
    # (Geralmente é a cor sólida do fundo que queremos remover)
    bg_color = img.getpixel((0, 0))[:3]
    print(f"Cor de fundo detectada: {bg_color}")
    
    # Threshold de tolerância
    threshold = 40 
    
    for item in datas:
        pixel_color = item[:3]
        dist = distance(pixel_color, bg_color)
        
        if dist < threshold:
            # É fundo -> Transparente
            new_data.append((255, 255, 255, 0))
        else:
            # Não é fundo
            # Verifica se é muito escuro (preto/cinza escuro) -> pode ser sombra
            # Verifica se é Branco (Texto) -> Força Branco Puro Opaco
            r, g, b = pixel_color
            
            is_white = r > 200 and g > 200 and b > 200
            
            if is_white:
                # Texto Branco -> Branco Puro
                new_data.append((255, 255, 255, 255))
            else:
                # Mantém cor original (provavelmente o roxo do ícone)
                # Suavização de borda opcional
                if dist < threshold + 20:
                     alpha = int(((dist - threshold) / 20) * 255)
                     new_data.append(item[:3] + (alpha,))
                else:
                     new_data.append(item)
                
    img.putdata(new_data)
    
    # Crop automático (remove bordas transparentes sobrando)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Sucesso! Logo salva em {output_path}")

if __name__ == "__main__":
    process_logo()
