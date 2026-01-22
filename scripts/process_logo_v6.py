
import sys
from PIL import Image

def process_logo_v6(input_path, output_path, tolerance=30):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        # 1. Flood fill from corners to remove purple background
        width, height = img.size
        # Sample corners
        corners = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        
        pixels = img.load()
        bg_color = pixels[0, 0] # Assume top-left is bg
        
        # Helper for color distance
        def is_sim(c1, c2, tol):
            return (abs(c1[0] - c2[0]) < tol and
                    abs(c1[1] - c2[1]) < tol and
                    abs(c1[2] - c2[2]) < tol)
        
        # BFS Flood Fill
        queue = []
        visited = set()
        
        # Init queue with matching corners
        for x, y in corners:
            if is_sim(pixels[x, y], bg_color, tolerance):
                queue.append((x, y))
                visited.add((x, y))
                
        # 4-way BFS
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

        # 2. Add a white glow/stroke or shadow if needed?
        # The user's previous logo was white text on purple. 
        # This new logo is white text on purple bg. 
        # If we remove the bg, the text is WHITE. 
        # The login page has a gradient background (purple). 
        # White text on purple gradient is perfect.
        
        # 3. Crop to content
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
        
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_logo_v6(r"d:\fatopago\public\logo_v2.jpg", r"d:\fatopago\public\logo.png")
