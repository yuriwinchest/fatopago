
import sys
from PIL import Image

def make_logo_white(input_path, output_path):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        width, height = img.size
        pixels = img.load()
        
        # We want "LETRA BRANCA APENAS". 
        # So we take every non-transparent pixel and make it white.
        
        for y in range(height):
            for x in range(width):
                r, g, b, a = pixels[x, y]
                if a > 0:
                    # preserve alpha, set color to white
                    pixels[x, y] = (255, 255, 255, a)
                    
        # Crop tight? The user asked for organization before.
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Successfully converted {input_path} to WHITE and saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    make_logo_white(r"d:\fatopago\public\LogoSEMFUNDOPRETO.png", r"d:\fatopago\public\logo.png")
