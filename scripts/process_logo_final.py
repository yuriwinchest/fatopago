
import sys
from PIL import Image

def get_connected_components(img, pixels, width, height):
    """
    Returns a list of components. Each component is a set of (x, y) coordinates.
    Only considers non-transparent pixels.
    """
    visited = set()
    components = []
    
    for y in range(height):
        for x in range(width):
            # If not transparent and not visited
            if pixels[x, y][3] > 0 and (x, y) not in visited:
                # Start a new component
                component = set()
                stack = [(x, y)]
                visited.add((x, y))
                component.add((x, y))
                
                while stack:
                    cx, cy = stack.pop()
                    
                    for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height:
                            if (nx, ny) not in visited:
                                # If non-transparent
                                if pixels[nx, ny][3] > 0:
                                    visited.add((nx, ny))
                                    component.add((nx, ny))
                                    stack.append((nx, ny))
                components.append(component)
    return components

def process_logo_final(input_path, output_path, tolerance=60):
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        width, height = img.size
        pixels = img.load()
        
        # 1. Background Removal (Flood Fill from corners)
        bg_color = pixels[0, 0]
        
        def is_sim(c1, c2, tol):
            return (abs(c1[0] - c2[0]) < tol and
                    abs(c1[1] - c2[1]) < tol and
                    abs(c1[2] - c2[2]) < tol)
        
        queue = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)]
        visited = set()
        
        # Filter starting points
        valid_queue = []
        for q in queue:
            if is_sim(pixels[q[0], q[1]], bg_color, tolerance):
                valid_queue.append(q)
                visited.add(q)
        
        # BFS Flood Fill to remove background
        queue = valid_queue
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
                            
        # 2. Remove Small Artifacts (The "Star")
        # Find all connected components of NON-transparent pixels
        components = get_connected_components(img, pixels, width, height)
        
        if not components:
            print("Warning: No opaque pixels found!")
            img.save(output_path, "PNG")
            return

        # Find the largest component (likely the main logo background/text block if connected)
        # However, text letters might be disjoint.
        # Strategy: 
        # - Any component smaller than X pixels is noise.
        # - Or, keep components that are "significant".
        
        # Let's count total opaque pixels
        total_opaque = sum(len(c) for c in components)
        
        # Threshold: Discard components smaller than 0.5% of total opaque area?
        # Or just fixed size. The "star" is likely small.
        # Let's say 100 pixels.
        
        # Better: keep the Top N largest components, discard rest? 
        # Logo text "FATOPAGO" has 8 letters. Icon is 1. Total ~9 components if disjoint.
        # But usually in logo_v2.jpg, the text is white on a purple card.
        # Wait, if I removed the purple background, the white text remains.
        # The letters F, A, T... are disjoint.
        # So I shouldn't just keep the "largest". I should keep "all large enough" components.
        
        threshold = 50 # Arbitrary small number. A letter or icon part should be > 50 pixels essentially.
        
        kept_pixels = 0
        removed_pixels = 0
        
        for comp in components:
            if len(comp) < threshold:
                # Remove this component (make transparent)
                for (cx, cy) in comp:
                    pixels[cx, cy] = (0, 0, 0, 0)
                removed_pixels += len(comp)
            else:
                kept_pixels += len(comp)
                
        print(f"Removed {removed_pixels} noise pixels. Kept {kept_pixels} pixels.")
                            
        # 3. Crop Tight
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
            
        img.save(output_path, "PNG")
        print(f"Successfully processed {input_path} and saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process_logo_final(r"d:\fatopago\public\logo_v2.jpg", r"d:\fatopago\public\logo.png")
