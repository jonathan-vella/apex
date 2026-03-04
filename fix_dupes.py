import re

with open("docs/how-it-works.md", "r", encoding="utf-8") as f:
    content = f.read()

# Replace double occurrences with single occurrences
images = [
    '<div align="center"><img src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>\n\n<div align="center"><img src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>',
    '<div align="center"><img src="https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>\n\n<div align="center"><img src="https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>',
    '<div align="center"><img src="https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>\n\n<div align="center"><img src="https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>',
    '<div align="center"><img src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop" height="250" style="object-fit: cover; border-radius: 8px;"></div><br/>\n\n<div align="center"><img src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop" height="250" style="object-fit: cover; border-radius: 8px;"></div><br/>'
]

single_images = [
    '<div align="center"><img src="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>',
    '<div align="center"><img src="https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>',
    '<div align="center"><img src="https://images.unsplash.com/photo-1474487548417-781cb71495f3?q=80&w=1200&auto=format&fit=crop" height="200" style="object-fit: cover; border-radius: 8px;"></div><br/>',
    '<div align="center"><img src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop" height="250" style="object-fit: cover; border-radius: 8px;"></div><br/>'
]


for double, single in zip(images, single_images):
    content = content.replace(double, single)

with open("docs/how-it-works.md", "w", encoding="utf-8") as f:
    f.write(content)

