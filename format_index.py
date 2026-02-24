import re

with open("index.html", "r") as f:
    html = f.read()

# Fix footer links in index.html to be absolute paths
html = re.sub(
    r'<a href="privacy.html">Privacy Policy</a>',
    r'<a href="/privacy.html">Privacy Policy</a>',
    html
)
html = re.sub(
    r'<a href="terms.html">Terms</a>',
    r'<a href="/terms.html">Terms</a>',
    html
)

with open("index.html", "w") as f:
    f.write(html)
