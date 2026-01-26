import os
import urllib.parse

root = "public/images/Gallery"
categories = {
    "Cakes": "cakes",
    "Cookies": "cookies",
    "Animals & Pets": "animals",
    "Holidays & Celebrations": "holidays",
    "Kids & Characters": "kids",
    "Life Events": "life",
    "School & Sports": "school",
    "All": "all" # Special case, maybe highlight images? 
}

# We'll map "All" folder images to 'all' category, but actually the filter logic usually implies 'all' shows everything.
# If there are images SPECIALLY in 'All' folder, we'll give them a generic category or just 'all'.

html_output = ""

for folder in os.listdir(root):
    folder_path = os.path.join(root, folder)
    if os.path.isdir(folder_path):
        # Determine filter key
        filter_key = categories.get(folder, "other")
        
        # Walk files
        for filename in os.listdir(folder_path):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                # Encode path for HTML
                # Path: public/images/Gallery/Folder/File.jpg
                # URL Encode path parts
                
                safe_folder = urllib.parse.quote(folder)
                safe_filename = urllib.parse.quote(filename)
                
                src = f"public/images/Gallery/{safe_folder}/{safe_filename}"
                alt = filename.replace('-', ' ').replace('.jpg', '').replace('.JPG', '').title()
                
                # Tag extraction:
                # Remove extension, split by '-', filter empty, title case each tag
                raw_name = filename.rsplit('.', 1)[0]
                tags_list = [t.title() for t in raw_name.split('-') if t]
                tags_str = ", ".join(tags_list)
                
                html_output += f"""
                <div class="gallery-item" data-category="{filter_key}" data-tags="{tags_str}">
                    <img src="{src}" alt="{alt}" loading="lazy">
                </div>"""

print(html_output)
