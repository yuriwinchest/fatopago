
import zipfile
import os
import shutil

def extract_logo(zip_path, output_path):
    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            # List files
            print("Files in zip:")
            for n in z.namelist():
                print(n)
            
            # Try to find a nice PNG.
            # Based on previous `tar` output, we saw `previews/page1.png`.
            # Let's try to extract that as the candidate.
            
            candidate = None
            if 'previews/page1.png' in z.namelist():
                candidate = 'previews/page1.png'
            elif 'previews/thumbnail.png' in z.namelist():
                candidate = 'previews/thumbnail.png'
            
            if candidate:
                print(f"Extracting {candidate}...")
                with z.open(candidate) as source, open(output_path, 'wb') as target:
                    shutil.copyfileobj(source, target)
                print(f"Success! Extracted to {output_path}")
            else:
                print("No suitable PNG found in zip.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_logo(r"d:\fatopago\public\logoBRANCA.png.zip", r"d:\fatopago\public\logo.png")
