
import sys
from PIL import Image

def remove_background(input_path, output_path, tolerance=30):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        datas = img.getdata()
        
        # Get background color from top-left pixel
        bg_color = datas[0]
        
        new_data = []
        for item in datas:
            # Check if pixel is similar to background color
            if (abs(item[0] - bg_color[0]) < tolerance and
                abs(item[1] - bg_color[1]) < tolerance and
                abs(item[2] - bg_color[2]) < tolerance):
                new_data.append((255, 255, 255, 0)) # Transparent
            else:
                new_data.append(item)
        
        img.putdata(new_data)
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
    except Exception as e:
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    else:
        # Default for the specific task if args not provided
        input_path = r"d:\fatopago\public\logo.png"
        output_path = r"d:\fatopago\public\logo.png"
        
    remove_background(input_path, output_path)
