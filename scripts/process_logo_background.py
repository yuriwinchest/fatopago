
import sys
from PIL import Image

def process_logo_crop_only(input_path, output_path):
    try:
        img = Image.open(input_path)
        img = img.convert("RGB") # Keep original colors, no transparency
        
        # We want to crop to the "box". 
        # The image `logo_v2.jpg` is a screenshot of the phone.
        # It has a black notch area and the purple app area.
        # We need to find the purple box of the logo.
        
        # Simple heuristic:
        # The logo is likely in the center.
        # Let's try to detect the boundaries of the "logo content" (white text)
        # and add some padding of the CURRENT background around it.
        # OR: Detect the purple/pink card edges if it's a card?
        # In the screenshot, the logo is just white text ON the purple background of the app.
        # There isn't a "box" around the logo, the whole screen is the background.
        
        # The user said "coloca fundo roda nela".
        # If I just crop the text, I get a small purple rectangle with text.
        
        # Let's do this:
        # Find the bounding box of the WHITE pixels.
        # Crop with a generous padding around it, capturing the purple background.
        # This creates a "Purple Box" logo.
        
        # Threshold for white text
        # Convert to grayscale
        gray = img.convert("L")
        # Threshold
        bw = gray.point(lambda x: 255 if x > 200 else 0, '1')
        bbox = bw.getbbox()
        
        if bbox:
            # Add padding
            padding_x = 40
            padding_y = 20
            
            left, top, right, bottom = bbox
            width, height = img.size
            
            crop_box = (
                max(0, left - padding_x),
                max(0, top - padding_y),
                min(width, right + padding_x),
                min(height, bottom + padding_y)
            )
            
            cropped = img.crop(crop_box)
            cropped.save(output_path, "PNG")
            print(f"Successfully cropped (keeping background) {input_path} to {output_path}")
            
        else:
             # Fallback
            img.save(output_path, "PNG")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_logo_crop_only(r"d:\fatopago\public\logo_v2.jpg", r"d:\fatopago\public\logo.png")
