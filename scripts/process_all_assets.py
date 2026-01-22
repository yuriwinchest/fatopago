
from PIL import Image
import os

def process_assets(input_logo, input_circle, public_dir):
    # 1. Main Logo (Logo + Text)
    img_logo = Image.open(input_logo).convert("RGBA")
    # Remove white bg
    datas = img_logo.getdata()
    new_data = []
    for item in datas:
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img_logo.putdata(new_data)
    # Crop to content
    bbox = img_logo.getbbox()
    if bbox:
        img_logo = img_logo.crop(bbox)
    img_logo.save(os.path.join(public_dir, "logo.png"), "PNG")

    # 2. Watermark Logo (Circular Icon Only, pure white/transparent)
    img_circle = Image.open(input_circle).convert("RGBA")
    datas = img_circle.getdata()
    new_data = []
    for item in datas:
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0))
        else:
            # For watermark, we want it to be basically a white mask or very light
            # Let's just keep original but we'll use CSS opacity
            new_data.append(item)
    img_circle.putdata(new_data)
    bbox = img_circle.getbbox()
    if bbox:
        img_circle = img_circle.crop(bbox)
    img_circle.save(os.path.join(public_dir, "watermark.png"), "PNG")

    # 3. Favicon (Clean circular)
    # Save favicon.png and .ico
    square_size = 512
    square_img = Image.new("RGBA", (square_size, square_size), (0, 0, 0, 0))
    w, h = img_circle.size
    ratio = min(square_size/w, square_size/h)
    new_w, new_h = int(w*ratio), int(h*ratio)
    img_circle_resized = img_circle.resize((new_w, new_h), Image.Resampling.LANCZOS)
    square_img.paste(img_circle_resized, ((square_size-new_w)//2, (square_size-new_h)//2))
    
    square_img.save(os.path.join(public_dir, "favicon.png"), "PNG")
    square_img.resize((32, 32)).save(os.path.join(public_dir, "favicon-32x32.png"), "PNG")
    square_img.resize((16, 16)).save(os.path.join(public_dir, "favicon-16x16.png"), "PNG")
    
    # Save ICO
    icon_sizes = [(16, 16), (32, 32), (48, 48)]
    icons = [square_img.resize(s, Image.Resampling.LANCZOS) for s in icon_sizes]
    icons[0].save(os.path.join(public_dir, "favicon.ico"), format="ICO", sizes=icon_sizes)

    print("Assets processed successfully.")

if __name__ == "__main__":
    logo_input = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768669566643.jpg"
    circle_input = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768670851132.jpg"
    public_dir = r"d:/fatopago/public"
    process_assets(logo_input, circle_input, public_dir)
