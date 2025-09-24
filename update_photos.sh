#!/bin/bash
# Photo Album Updater - Shell script version
# Run this script to automatically add new images to your photo album

echo "🖼️  Photo Album Updater"
echo "📁 Using images/photo album/ folder"
echo "========================"

# Check if Python is available
if command -v python3 &> /dev/null; then
    python3 update_photo_album.py
elif command -v python &> /dev/null; then
    python update_photo_album.py
else
    echo "❌ Python not found. Please install Python to run this script."
    exit 1
fi
