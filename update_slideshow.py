#!/usr/bin/env python3
"""
Update slideshow to include images from both slideshow and photo album folders
"""

import json
import os

def update_slideshow():
    # Get images from slideshow folder
    slideshow_images = []
    slideshow_dir = 'slideshow'
    if os.path.exists(slideshow_dir):
        for file in os.listdir(slideshow_dir):
            if file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                slideshow_images.append(file)

    # Get images from photo album folder
    photo_album_images = []
    photo_album_dir = 'images/photo album'
    if os.path.exists(photo_album_dir):
        for file in os.listdir(photo_album_dir):
            if file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                # Prefix with the relative path for slideshow
                photo_album_images.append(f'../images/photo album/{file}')

    # Combine all images
    all_images = slideshow_images + photo_album_images

    print(f'🎬 Slideshow Updater')
    print(f'=' * 30)
    print(f'📁 Found {len(slideshow_images)} images in slideshow folder')
    print(f'📸 Found {len(photo_album_images)} images in photo album folder')
    print(f'🎬 Total slideshow images: {len(all_images)}')

    # Update slides.json
    try:
        with open('slides.json', 'w') as f:
            json.dump(all_images, f, indent=2)
        print('✅ Updated slides.json with all images!')
    except Exception as e:
        print(f'❌ Error updating slides.json: {e}')

if __name__ == "__main__":
    update_slideshow()
