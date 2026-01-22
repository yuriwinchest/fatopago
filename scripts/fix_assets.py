
from PIL import Image
import os

def process_logo(input_path, output_path, padding=10):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    # 1. Remove background (white or near-white)
    datas = img.getdata()
    new_data = []
    threshold = 240
    for item in datas:
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    
    # 2. Crop empty space
    # Get the bounding box of non-transparent areas
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    # 3. Add a tiny bit of padding so it doesn't touch the edges
    width, height = img.size
    new_img = Image.new("RGBA", (width + padding*2, height + padding*2), (0, 0, 0, 0))
    new_img.paste(img, (padding, padding))
    
    # 4. Save
    new_img.save(output_path, "PNG")
    print(f"Logo saved to {output_path}")

def process_favicon(input_path, output_path):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    # 1. Remove background
    datas = img.getdata()
    new_data = []
    threshold = 240
    for item in datas:
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    
    # 2. For favicon, we usually want the icon ONLY, not the text, if it's too small.
    # But for now, let's just crop to content and make it square.
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    
    # Make it square
    w, h = img.size
    size = max(w, h)
    square_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Paste centered
    offset = ((size - w) // 2, (size - h) // 2)
    square_img.paste(img, offset)
    
    # Resize to standard favicon sizes
    square_img.resize((64, 64), Image.Resampling.LANCZOS).save(output_path, "PNG")
    print(f"Favicon saved to {output_path}")

if __name__ == "__main__":
    logo_input = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768669566643.jpg"
    favicon_input = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768670851132.jpg"
    
    public_dir = r"d:/fatopago/public"
    if not os.path.exists(public_dir):
        os.makedirs(public_dir)
        
    process_logo(logo_input, os.path.join(public_dir, "logo.png"))
    process_favicon(favicon_input, os.path.join(public_dir, "favicon.png"))
