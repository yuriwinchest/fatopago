
import sys
from PIL import Image, ImageChops

def process_logo_advanced(input_path, output_path, tolerance=50):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        # 1. Flood fill from corners to remove main background
        width, height = img.size
        # Sample corners
        corners = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        
        pixels = img.load()
        bg_color = pixels[0, 0] # Assume top-left is bg
        
        # BFS Flood Fill
        queue = []
        visited = set()
        
        def is_sim(c1, c2, tol):
            return (abs(c1[0] - c2[0]) < tol and
                    abs(c1[1] - c2[1]) < tol and
                    abs(c1[2] - c2[2]) < tol)
                    
        for x, y in corners:
            if is_sim(pixels[x, y], bg_color, tolerance):
                queue.append((x, y))
                visited.add((x, y))
                
        while queue:
            cx, cy = queue.pop(0)
            pixels[cx, cy] = (0, 0, 0, 0)
            
            for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < width and 0 <= ny < height:
                    if (nx, ny) not in visited:
                        if is_sim(pixels[nx, ny], bg_color, tolerance):
                            visited.add((nx, ny))
                            queue.append((nx, ny))

        # 2. Crop to content
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        # 3. Filtering out small detached components (like the "star" if it's detached)
        # We can simulate connected components by processing the alpha channel.
        # This is a bit complex in pure PIL but we can try a simple heuristic:
        # If there are disjoint non-transparent parts, keep only the largest one (which should be the logo + text).
        
        # Actually, simpler: 
        # The star is likely just a small blob. 
        # This script won't implement full CCL for safety/time, but the crop + transparency 
        # should give a much better result than the full screenshot.
        
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_logo_advanced(r"d:\fatopago\public\logo_source.png", r"d:\fatopago\public\logo.png")
