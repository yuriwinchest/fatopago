from PIL import Image, ImageDraw
import os

def clean_logo():
    input_path = "d:/fatopago/public/logo.png"
    output_path = "d:/fatopago/public/logo.png"
    
    if not os.path.exists(input_path):
        print("Logo não encontrada.")
        return

    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    
    # Tolerância para considerar "fundo sujo"
    # Se for muito claro (quase branco) mas não totalmente opaco, ou se for cinza claro.
    
    for item in datas:
        r, g, b, a = item
        
        # Se for totalmente transparente, mantém
        if a == 0:
            new_data.append((255, 255, 255, 0))
            continue
            
        # Análise de cor
        # O Ícone é Roxo. O Texto é Branco.
        # Roxo típico: R e B altos, G baixo.
        # Branco típico: R, G, B altos.
        
        is_purple = (r > g + 20) and (b > g + 20) and (r < 240 or b < 240) # Roxo não é branco
        is_white = (r > 230) and (g > 230) and (b > 230)
        
        if is_purple:
            # Mantém pixel roxo original (ícone)
            new_data.append(item)
        elif is_white:
            # É branco (texto ou parte do check do ícone)
            # Vamos garantir que seja Branco Puro e Opaco para o texto ficar nítido
            # Mas cuidado com bordas serrilhadas.
            if a > 100: # Se tem visibilidade razoável
                new_data.append((255, 255, 255, 255)) # Força opacidade total e branco puro
            else:
                new_data.append((255, 255, 255, 0)) # Remove se for muito transparente (sujeira)
        else:
            # Nem roxo, nem branco forte. Provavelmente borda suja ou cinza.
            # Se for claro (cinza), remove (torna transparente)
            if r > 200 and g > 200 and b > 200:
                 new_data.append((255, 255, 255, 0))
            else:
                # Mantém outras cores (talvez sombras do ícone)
                new_data.append(item)

    img.putdata(new_data)
    
    # Recortar espaços vazios (Crop) para otimizar
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Logo limpa e salva em {output_path}")

if __name__ == "__main__":
    clean_logo()
