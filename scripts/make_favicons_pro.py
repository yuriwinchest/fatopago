
from PIL import Image
import os

def process_favicon(input_path, public_dir):
    img = Image.open(input_path)
    img = img.convert("RGBA")
    
    # Remove background
    datas = img.getdata()
    new_data = []
    threshold = 240
    for item in datas:
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    
    # Crop to content
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    
    # Make square
    w, h = img.size
    size = max(w, h)
    square_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - w) // 2, (size - h) // 2)
    square_img.paste(img, offset)
    
    # Save PNG versions
    square_img.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon-32x32.png"), "PNG")
    square_img.resize((16, 16), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon-16x16.png"), "PNG")
    square_img.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
    square_img.resize((192, 192), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "android-chrome-192x192.png"), "PNG")
    square_img.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "android-chrome-512x512.png"), "PNG")

    # Save as ICO (containing multiple sizes)
    # Pillow can save multiple images in one ICO
    icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    icons = [square_img.resize(s, Image.Resampling.LANCZOS).convert("RGBA") for s in icon_sizes]
    # Filter out empty images if any
    icons = [ic for ic in icons if ic.getbbox()]
    
    if icons:
        icons[0].save(os.path.join(public_dir, "favicon.ico"), format="ICO", sizes=icon_sizes)
        # Also save the main favicon.png for backward compatibility
        square_img.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(public_dir, "favicon.png"), "PNG")
        print("Multiple Favicon formats generated successfully!")
    else:
        print("Error: Could not generate icons.")

if __name__ == "__main__":
    favicon_input = r"C:/Users/yuriv/.gemini/antigravity/brain/1405a759-afcd-4263-b561-0e86118dba21/uploaded_image_1768670851132.jpg"
    public_dir = r"d:/fatopago/public"
    
    process_favicon(favicon_input, public_dir)
