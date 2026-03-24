"""Extract base64 image styles for draw.io diagram generation."""
import json
import os
import html
import re

library_dir = "assets/drawio-libraries/azure-public-service-icons"

def get_image_style(fname, title_search):
    fpath = os.path.join(library_dir, fname)
    with open(fpath) as f:
        content = f.read()
    json_str = content[len('<mxlibrary>'):-len('</mxlibrary>')]
    items = json.loads(json_str)
    for item in items:
        title = item.get('title', '')
        if title_search in title:
            xml_unescaped = html.unescape(item['xml'])
            m = re.search(r'image=(data:image/svg[^"]+)', xml_unescaped)
            if m:
                return title, m.group(1)
    return None, None

icons_to_extract = [
    ('003 app services.xml', 'App-Services', 'app-svc'),
    ('002 analytics.xml', 'Log-Analytics-Workspaces', 'log-analytics'),
    ('010 devops.xml', 'Application-Insights', 'app-insights'),
    ('024 networking.xml', '00427-icon-service-Private-Link', 'private-link'),
    ('013 identity.xml', 'Entra-Managed-Identities', 'entra'),
]

for fname, search, alias in icons_to_extract:
    title, style = get_image_style(fname, search)
    if style:
        print(f'# {alias}: {title}')
        print(f'STYLE=shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image={style}')
        print()
    else:
        print(f'# MISSING: {alias} ({search})')
        print()

