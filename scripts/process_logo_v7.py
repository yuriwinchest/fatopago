
import sys
from PIL import Image

def process_logo_v7(input_path, output_path, tolerance=60):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        width, height = img.size
        pixels = img.load()
        
        # Determine background color from corners (average them to be robust?)
        # Or just top-left. Let's try top-left.
        bg_color = pixels[0, 0]
        
        print(f"Detected background color: {bg_color}")
        
        # Helper for color distance (Euclidean or Manhattan)
        # Manhattan is faster and usually fine for this
        def is_similar_bg(c1, c2, tol):
            return (abs(c1[0] - c2[0]) < tol and
                    abs(c1[1] - c2[1]) < tol and
                    abs(c1[2] - c2[2]) < tol)
        
        # Flood fill algorithm
        queue = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        visited = set(queue)
        
        # Pre-verify corners match bg logic roughly, otherwise we might start wrong
        # If a corner is drastically different, maybe don't start there. 
        # But for a logo rectangle, corners are usually bg.
        
        valid_queue = []
        for q in queue:
            if is_similar_bg(pixels[q[0], q[1]], bg_color, tolerance):
                valid_queue.append(q)
        
        queue = valid_queue
        
        # To handle JPG noise better, we can also set the alpha based on distance?
        # No, let's keep it binary transparent for now, but high tolerance.
        
        while queue:
            cx, cy = queue.pop(0)
            
            # Make transparent
            pixels[cx, cy] = (0, 0, 0, 0)
            
            for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        # If pixel is similar to the REFERENCE bg_color
                        if is_similar_bg(pixels[nx, ny], bg_color, tolerance):
                            visited.add((nx, ny))
                            queue.append((nx, ny))
                            
        # Crop whitespace/transparent areas
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Using the high quality source v2
    process_logo_v7(r"d:\fatopago\public\logo_v2.jpg", r"d:\fatopago\public\logo.png")
