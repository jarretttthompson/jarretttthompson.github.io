#!/usr/bin/env python3
"""
Photo Album Updater Script
Automatically adds new images from the images/ folder to the photo-album.html page.
"""

import os
import re
from pathlib import Path

def get_existing_images(html_file):
    """Extract existing image sources from the photo album HTML."""
    existing_images = set()
    
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Find all img src attributes in the photo gallery
        pattern = r'<img src="images/photo album/([^"]+)"'
        matches = re.findall(pattern, content)
        existing_images = set(matches)
        
    except FileNotFoundError:
        print(f"Warning: {html_file} not found")
    except Exception as e:
        print(f"Error reading {html_file}: {e}")
    
    return existing_images

def get_image_files(images_dir):
    """Get all image files from the images directory."""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
    image_files = []
    
    try:
        for file_path in Path(images_dir).iterdir():
            if file_path.is_file() and file_path.suffix.lower() in image_extensions:
                image_files.append(file_path.name)
    except FileNotFoundError:
        print(f"Warning: {images_dir} directory not found")
    except Exception as e:
        print(f"Error reading {images_dir}: {e}")
    
    return sorted(image_files)

def generate_alt_text(filename):
    """Generate alt text from filename."""
    # Remove extension and replace common separators
    name = Path(filename).stem
    name = re.sub(r'[_-]', ' ', name)
    name = re.sub(r'\d+', '', name)  # Remove numbers
    name = name.strip()
    
    # Capitalize first letter
    if name:
        name = name[0].upper() + name[1:]
    
    return name or "Photo"

def update_photo_album():
    """Update the photo album with new images."""
    # File paths
    html_file = "photo-album.html"
    images_dir = "images/photo album"
    
    print("🖼️  Photo Album Updater")
    print("=" * 40)
    
    # Get existing and new images
    existing_images = get_existing_images(html_file)
    all_images = get_image_files(images_dir)
    new_images = [img for img in all_images if img not in existing_images]
    
    print(f"📁 Images directory: {images_dir}")
    print(f"📄 HTML file: {html_file}")
    print(f"🔍 Found {len(all_images)} total images")
    print(f"✅ {len(existing_images)} already in album")
    print(f"🆕 {len(new_images)} new images to add")
    
    if not new_images:
        print("\n✨ No new images to add!")
        return
    
    print(f"\n📋 New images to add:")
    for img in new_images:
        print(f"   • {img}")
    
    # Read current HTML
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"❌ Error reading {html_file}: {e}")
        return
    
    # Find the insertion point (after the last existing photo)
    insertion_point = content.rfind('<!-- original gallery items end -->')
    
    if insertion_point == -1:
        print("❌ Could not find insertion point in HTML file")
        return
    
    # Generate HTML for new photos
    new_photos_html = ""
    for img in new_images:
        alt_text = generate_alt_text(img)
        new_photos_html += f'      <div class="framed-photo">\n'
        new_photos_html += f'          <img src="images/photo album/{img}" alt="{alt_text}" loading="lazy">\n'
        new_photos_html += f'      </div>\n'
    
    # Insert new photos before the end comment
    new_content = content[:insertion_point] + new_photos_html + "      " + content[insertion_point:]
    
    # Write updated HTML
    try:
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"\n✅ Successfully updated {html_file}")
        print(f"➕ Added {len(new_images)} new photos to the album")
    except Exception as e:
        print(f"❌ Error writing {html_file}: {e}")

def main():
    """Main function."""
    print("Starting photo album update...")
    update_photo_album()
    print("\n🎉 Done!")

if __name__ == "__main__":
    main()
