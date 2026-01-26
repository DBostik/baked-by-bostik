import re

# Read the items
with open('gallery_items.html', 'r') as f:
    new_items = f.read()

# Read the HTML
with open('gallery.html', 'r') as f:
    content = f.read()

# Pattern to find the grid container and replace its content
# We look for <div class="gallery-grid fade-in-up delay-2"> ... </div>
# Finding the matching closing div is tricky with regex. 
# We'll assume the grid is the div immediately following "<!-- Grid -->" or similar comment/pattern.

start_marker = '<div class="gallery-grid fade-in-up delay-2">'
end_marker = '</div>' # This is risky.

# Better approach: Split by the start_marker.
parts = content.split(start_marker)
if len(parts) < 2:
    print("Could not find gallery-grid start")
    exit(1)

pre_grid = parts[0]
post_start = parts[1]

# Now we need to find where the grid ends. 
# Since there might be nested divs (though gallery items are distinct), we can just search for the next closing </div> IF the structure is clean 
# or use a counter.
# The gallery items are <div class="gallery-item"> ... </div>
# So we count.

grid_content = ""
rest_of_file = ""
depth = 1 # We are inside the grid div

i = 0
while i < len(post_start):
    if post_start[i:i+4] == '<div':
        depth += 1
    elif post_start[i:i+5] == '</div':
        depth -= 1
    
    if depth == 0:
        # Found the closing tag of the grid
        rest_of_file = post_start[i+6:] # Skip </div>
        break
    i += 1

# Reassemble
new_html = pre_grid + start_marker + "\n" + new_items + "\n            </div>" + rest_of_file

with open('gallery.html', 'w') as f:
    f.write(new_html)

print("Gallery grid updated successfully.")
