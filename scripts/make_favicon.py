
from PIL import Image
import os

def remove_background(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    
    new_data = []
    # threshold for white
    threshold = 240
    
    for item in datas:
        # If r, g, b are all above threshold
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    # Resize for favicon
    # Standard sizes: 16x16, 32x32, 180x180
    # Let's keep it 180x180 for high res and browsers will scale
    img_fav = img.resize((180, 180), Image.Resampling.LANCZOS)
    img_fav.save(output_path, "PNG")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    input_p = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768670851132.jpg"
    output_p = r"d:/fatopago/public/favicon.png"
    
    remove_background(input_p, output_p)
