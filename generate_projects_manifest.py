#!/usr/bin/env python3
"""Scan the projects directory and emit a JSON manifest for site consumption.

The manifest groups media per project subfolder and optionally converts videos
into GIFs when `ffmpeg` is available on the host machine.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional

REPO_ROOT = Path(__file__).resolve().parent
PROJECTS_ROOT = REPO_ROOT / 'projects'
OUTPUT_PATH = PROJECTS_ROOT / 'projects.json'

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
VIDEO_EXTS = {'.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'}


@dataclass
class MediaItem:
    src: str
    alt: str
    kind: str  # image | gif | video


@dataclass
class Project:
    slug: str
    title: str
    items: List[MediaItem]


def slug_to_title(slug: str) -> str:
    words = slug.replace('-', ' ').replace('_', ' ').split()
    return ' '.join(w.capitalize() for w in words) or slug


def iter_projects(root: Path) -> Iterable[Path]:
    if not root.exists():
        return []
    return sorted(p for p in root.iterdir() if p.is_dir())


def derive_alt(path: Path) -> str:
    stem = path.stem.replace('-', ' ').replace('_', ' ').strip()
    return stem or path.name


def convert_video_to_gif(video_path: Path, ffmpeg_path: Optional[str]) -> Optional[Path]:
    if not ffmpeg_path:
        return None
    gif_path = video_path.with_suffix('.gif')
    if gif_path.exists():
        return gif_path

    cmd = [
        ffmpeg_path,
        '-hide_banner',
        '-loglevel', 'error',
        '-y',
        '-i', str(video_path),
        '-vf', 'fps=12,scale=960:-1:flags=lanczos',
        str(gif_path),
    ]
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError:
        return None
    return gif_path if gif_path.exists() else None


def build_manifest() -> List[Project]:
    ffmpeg_path = shutil.which('ffmpeg')
    projects: List[Project] = []

    for project_dir in iter_projects(PROJECTS_ROOT):
        slug = project_dir.name
        title = slug_to_title(slug)
        items: List[MediaItem] = []

        for media_path in sorted(project_dir.iterdir()):
            if media_path.is_dir():
                continue
            ext = media_path.suffix.lower()

            if ext in IMAGE_EXTS:
                rel = media_path.relative_to(REPO_ROOT)
                items.append(
                    MediaItem(src=str(rel).replace('\\', '/'), alt=derive_alt(media_path), kind='image')
                )
            elif ext in VIDEO_EXTS:
                gif_path = convert_video_to_gif(media_path, ffmpeg_path)
                if gif_path:
                    rel = gif_path.relative_to(REPO_ROOT)
                    items.append(
                        MediaItem(src=str(rel).replace('\\', '/'), alt=derive_alt(gif_path), kind='gif')
                    )
                else:
                    rel = media_path.relative_to(REPO_ROOT)
                    items.append(
                        MediaItem(src=str(rel).replace('\\', '/'), alt=derive_alt(media_path), kind='video')
                    )

        if items:
            projects.append(Project(slug=slug, title=title, items=items))

    return projects


def write_manifest(projects: List[Project]) -> None:
    data = [
        {
            'slug': project.slug,
            'title': project.title,
            'items': [
                {'src': item.src, 'alt': item.alt, 'type': item.kind}
                for item in project.items
            ],
        }
        for project in projects
    ]
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, indent=2), encoding='utf-8')


def main() -> None:
    projects = build_manifest()
    write_manifest(projects)
    print(f"Wrote {len(projects)} project(s) to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == '__main__':
    main()
