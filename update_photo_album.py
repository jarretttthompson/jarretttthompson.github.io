#!/usr/bin/env python3
"""Photo Album Updater Script.

Synchronizes `photo-album.json` with files found in `images/photo album/`.
"""

import os
import json
from pathlib import Path

def load_existing_manifest(manifest_file):
    """Load existing photo-album JSON items."""
    try:
        with open(manifest_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
    except FileNotFoundError:
        print(f"Warning: {manifest_file} not found, creating a new manifest")
    except Exception as e:
        print(f"Error reading {manifest_file}: {e}")
    return []

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
    name = Path(filename).stem
    name = name.replace("_", " ").replace("-", " ")
    name = name.strip()

    if name:
        name = name[0].upper() + name[1:]

    return name or "Photo"

def update_photo_album():
    """Update the photo album manifest with new images."""
    manifest_file = "photo-album.json"
    images_dir = "images/photo album"

    print("🖼️  Photo Album Updater")
    print("=" * 40)

    existing_items = load_existing_manifest(manifest_file)
    existing_by_name = {
        Path(item.get("src", "")).name: item
        for item in existing_items
        if isinstance(item, dict) and item.get("src")
    }
    existing_images = set(existing_by_name.keys())

    all_images = get_image_files(images_dir)
    new_images = [img for img in all_images if img not in existing_images]

    print(f"📁 Images directory: {images_dir}")
    print(f"📄 Manifest file: {manifest_file}")
    print(f"🔍 Found {len(all_images)} total images")
    print(f"✅ {len(existing_images)} already in album")
    print(f"🆕 {len(new_images)} new images to add")

    merged = []
    for filename in all_images:
        if filename in existing_by_name:
            merged.append(existing_by_name[filename])
        else:
            merged.append({
                "src": f"images/photo album/{filename}",
                "alt": generate_alt_text(filename)
            })

    try:
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2)
            f.write("\n")
        print(f"\n✅ Successfully updated {manifest_file}")
        print(f"➕ Added {len(new_images)} new photos to the album")
    except Exception as e:
        print(f"❌ Error writing {manifest_file}: {e}")

def main():
    """Main function."""
    print("Starting photo album update...")
    update_photo_album()
    print("\n🎉 Done!")

if __name__ == "__main__":
    main()
