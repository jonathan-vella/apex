"""Temporary script to search icon libraries."""
import json
import os

library_dir = "assets/drawio-libraries/azure-public-service-icons"
search_terms = ["app service", "log analytics", "application insights",
                "private endpoint", "private link"]

for fname in ["003 app services.xml", "002 analytics.xml",
              "010 devops.xml", "024 networking.xml"]:
    fpath = os.path.join(library_dir, fname)
    if not os.path.exists(fpath):
        print(f"MISSING: {fname}")
        continue
    with open(fpath) as f:
        content = f.read()
    json_str = content[len("<mxlibrary>"):-len("</mxlibrary>")]
    items = json.loads(json_str)
    for item in items:
        title_lower = item.get("title", "").lower()
        for term in search_terms:
            if term in title_lower:
                print(f"[{fname}] {item['title']}")
