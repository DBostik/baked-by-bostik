import re

with open("menu.html", "r") as f:
    html = f.read()

# Replace delay-[INDEX] with actual delays
html = html.replace('delay-[INDEX]', '', 1)
html = html.replace('delay-[INDEX]', 'delay-1', 1)
html = html.replace('delay-[INDEX]', 'delay-2', 1)
html = html.replace('delay-[INDEX]', 'delay-3', 1)

# Clean up h3 in cards
# from: <h3 style="margin-bottom: var(--space-2); display: flex; align-items: center; gap: 8px;">\n                            <span>🍪</span> Custom Sugar Cookies\n                        </h3>
# to:   <h3>\n                            <span class="menu-icon">🍪</span><br> Custom Sugar Cookies\n                        </h3>
html = re.sub(
    r'<h3 style=".*?">\s*<span>(.*?)</span> (.*?)\s*</h3>',
    r'<h3><span class="menu-icon">\1</span> \2</h3>',
    html
)

# Clean up Minimum Order
# from: <p class="text-muted" style="font-weight: 500; margin-bottom: var(--space-4);">Minimum Order: 2 Dozen</p>
# to:   <p class="minimum-order">Minimum Order: 2 Dozen</p>
html = re.sub(
    r'<p class="text-muted" style=".*?; margin-bottom: var\(--space-4\);">(.*?)</p>',
    r'<p class="minimum-order">\1</p>',
    html
)

html = re.sub(
    r'<p class="text-muted" style="font-weight: 500; margin-bottom: var\(--space-4\);">(.*?)</p>',
    r'<p class="minimum-order">\1</p>',
    html
)

# Replace inline styles in the bullet list items
html = re.sub(
    r'<li style="margin-bottom: 12px; display: flex; gap: 8px;">',
    r'<li>',
    html
)
html = re.sub(
    r'<span style="color: var\(--color-primary\);">•</span>',
    r'<span class="bullet">•</span>',
    html
)
# Make starting price look good by using starting-price class
html = re.sub(
    r'<strong>(.*?(?:\$\d+|The Taster|Half Dozen).*?)</strong>',
    r'<strong>\1</strong>', # Just in case we want to catch this later
    html
)

# Remove generic inline styles on card lists
html = re.sub(r'<ul style="list-style-type: none; padding: 0; margin-bottom: var\(--space-6\);">', '<ul>', html)
html = re.sub(r'<ul style="list-style-type: none; padding: 0; margin-bottom: var\(--space-4\);">', '<ul>', html)

# The Daily Drop inner margins
html = re.sub(r'<p style="margin-bottom: var\(--space-4\); font-size: 0\.95em;">', '<p>', html)
html = re.sub(r'<h4 style="margin-top: var\(--space-4\); margin-bottom: var\(--space-2\);">', '<h4>', html)

# Daily drop lists
html = re.sub(
    r'<li style="display: flex; justify-content: space-between; margin-bottom: 4px;">',
    r'<li>',
    html
)

# Celebration cake lists
html = re.sub(
    r'<li\s*style="margin-bottom: 12px; display: flex; justify-content: space-between; border-bottom: 1px dashed #eee; padding-bottom: 4px;">',
    r'<li class="price-row">',
    html
)
html = re.sub(r'<p class="text-muted" style="font-size: 0\.85em; margin-bottom: var\(--space-2\);">', '<p class="text-muted text-sm">', html)

# Full width buttons
html = re.sub(r'<button class="btn btn-primary full-width" style="width: 100%;">Request a Quote</button>', '<button class="btn btn-primary full-width" onclick="openOrderModal()">Request a Quote</button>', html)


# Design Tiers section cleanup
html = re.sub(
    r'<div\s*style="background: var\(--color-bg-cream\); padding: var\(--space-4\); border-radius: var\(--radius-md\);">\s*<h3 style="margin-bottom: var\(--space-2\);">',
    r'<div class="tier-card">\n                        <h3>',
    html
)
html = re.sub(
    r'<div style="margin-top: var\(--space-6\); max-width: 800px; margin-inline: auto;">\s*<h3 style="margin-bottom: var\(--space-2\);">',
    r'<div class="addons-box">\n                    <h3>',
    html
)

# Fillings section cleanup
html = re.sub(
    r'<div\s*style="text-align: left; background: white; padding: var\(--space-6\); border-radius: var\(--radius-lg\); box-shadow: 0 4px 6px rgba\(0,0,0,0\.05\);">\s*<ul style="list-style-type: none; padding: 0;">\s*<li style="margin-bottom: var\(--space-4\);">',
    r'<div class="fillings-box">\n                    <ul>\n                        <li>',
    html
)
html = re.sub(
    r'<p class="subtitle" style="margin-bottom: var\(--space-6\);">',
    r'<p class="subtitle">',
    html
)
html = re.sub(r'<li style="margin-bottom: var\(--space-4\);">', '<li>', html)

# Notes section cleanup
html = re.sub(r'<ul style="margin-inline: var\(--space-4\);">', '<ul class="notes-callout">', html)
html = re.sub(r'<li style="margin-bottom: var\(--space-2\);">', '<li>', html)

with open("menu.html", "w") as f:
    f.write(html)

print("Menu HTML cleaned successfully.")
