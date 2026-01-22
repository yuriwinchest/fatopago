
import sys
from PIL import Image, ImageChops

def process_logo_smart(input_path, output_path, tolerance=50):
    try:
        # Open the image
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        # Method: Flood fill from corners to make background transparent.
        # This protects inner white text if it's not connected to the border.
        
        # seed points: corners
        width, height = img.size
        seeds = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        
        # We define a function to check difference
        # But PIL doesn't have a native floodfill that supports tolerance easily for alpha replacement in one go.
        # However, Image.floodfill exists in newer Pillow versions! 
        # But usually it fills with a color. We want to fill with (0,0,0,0).
        
        # Let's try a custom BFS for safety and correctness.
        # It's slower but robust for this icon size.
        
        # Get data as list of lists or just modifying pixel access
        pixels = img.load()
        
        bg_color = pixels[0, 0] # Assume top-left is bg
        
        # Helper to check color similarity
        def is_similar(c1, c2, tol):
            return (abs(c1[0] - c2[0]) <= tol and
                    abs(c1[1] - c2[1]) <= tol and
                    abs(c1[2] - c2[2]) <= tol)

        # Queue for BFS
        queue = []
        visited = set()
        
        # Initialize queue with corners if they match bg
        for x, y in seeds:
            if is_similar(pixels[x, y], bg_color, tolerance):
                queue.append((x, y))
                visited.add((x, y))
        
        # Directions
        dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)]
        
        while queue:
            cx, cy = queue.pop(0)
            
            # Make transparent
            pixels[cx, cy] = (0, 0, 0, 0)
            
            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        # Check if similar to ORIGINAL bg_color (not current pixel which is now transparent)
                        if is_similar(pixels[nx, ny], bg_color, tolerance):
                            visited.add((nx, ny))
                            queue.append((nx, ny))
                            
        # Now Crop
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error processing image: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 2:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    else:
        input_path = r"d:\fatopago\public\logo.png"
        output_path = r"d:\fatopago\public\logo.png"
        
    process_logo_smart(input_path, output_path)
