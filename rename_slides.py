import os
import json
import random

# === CONFIGURATION ===
slideshow_folder = 'slideshow'
json_output_path = 'slides.json'  # saved to root folder
valid_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
shuffle_files = True  # Set to False if you don’t want random order

# === Load all valid image filenames in the folder ===
all_files = os.listdir(slideshow_folder)
image_files = [f for f in all_files if os.path.splitext(f)[1].lower() in valid_extensions]

# === Filter out already correctly named files (e.g., slide1.jpg) ===
existing_slides = {f for f in image_files if f.startswith('slide') and os.path.splitext(f)[0][5:].isdigit()}
new_files = [f for f in image_files if f not in existing_slides]

# === Rename new files to continue numbering ===
next_index = len(existing_slides) + 1
for filename in new_files:
    ext = os.path.splitext(filename)[1].lower()
    new_name = f"slide{next_index}{ext}"
    os.rename(os.path.join(slideshow_folder, filename), os.path.join(slideshow_folder, new_name))
    existing_slides.add(new_name)
    next_index += 1

# === Refresh the list of all slide files ===
final_files = sorted([f for f in os.listdir(slideshow_folder) if os.path.splitext(f)[1].lower() in valid_extensions])

# === Optional shuffle ===
if shuffle_files:
    random.shuffle(final_files)

# === Write JSON file ===
with open(json_output_path, 'w') as json_file:
    json.dump(final_files, json_file, indent=2)

print(f"✅ Processed {len(final_files)} image(s). Updated '{json_output_path}'.")
