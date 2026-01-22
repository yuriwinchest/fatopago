
from PIL import Image
import os

def remove_background(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    
    new_data = []
    # threshold for white
    threshold = 240
    
    # Simple threshold removal (might remove the checkmark too if it's too white)
    # To be safer, we could use flood fill, but let's try this first and see.
    # Actually, the checkmark is inside the purple box. 
    # If the purple box is not white, we are safe.
    
    for item in datas:
        # If r, g, b are all above threshold
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    input_p = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768669566643.jpg"
    output_p = r"d:/fatopago/public/logo.png"
    
    if not os.path.exists("d:/fatopago/public"):
        os.makedirs("d:/fatopago/public")
        
    remove_background(input_p, output_p)
