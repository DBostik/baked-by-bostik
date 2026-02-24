import re

def update_policies():
    with open("policies.html", "r") as f:
        content = f.read()

    # Mini Hero
    content = re.sub(
        r'<section class=\"page-hero\" style=\"text-align: center; padding: var\(--space-8\) 0;\">\s*<div class=\"container fade-in-up\">\s*<h1 class=\"page-title\">Policies & Procedures</h1>\s*<p class=\"page-subtitle text-muted\">Important details to know before booking your custom order.</p>\s*</div>\s*</section>',
        '<section class="page-hero">\n            <div class="container fade-in-up">\n                <h1 class="page-title section-title">Policies & Procedures</h1>\n                <p class="page-subtitle">Important details to know before booking your custom order.</p>\n            </div>\n        </section>',
        content
    )
    with open("policies.html", "w") as f:
        f.write(content)


def update_resources():
    with open("resources.html", "r") as f:
        content = f.read()

    # Mini Hero
    content = re.sub(
        r'<section class=\"page-hero\" style=\"[^\"]+\">\s*<div class=\"container fade-in-up\">\s*<h1 class=\"page-title\">([\s\S]*?)</h1>\s*<p class=\"page-subtitle text-muted\">([\s\S]*?)</p>\s*</div>\s*</section>',
        '<section class="page-hero">\n            <div class="container fade-in-up">\n                <h1 class="page-title section-title">\\1</h1>\n                <p class="page-subtitle">\\2</p>\n            </div>\n        </section>',
        content
    )
    
    # Resources Grid and Card inline styles cleanup
    content = re.sub(r'class=\"resources-section bg-cream\" style=\"[^\"]+\"', 'class="resources-section bg-cream"', content)
    content = re.sub(r'class=\"resources-grid\"\n\s*style=\"[^\"]+\"', 'class="resources-grid"', content)
    content = re.sub(r'style=\"background: white; padding: var\(--space-6\); border-radius: var\(--radius-lg\); box-shadow: 0 4px 6px rgba\(0,0,0,0\.05\); text-align: center;\"', '', content)
    content = re.sub(r'style=\"font-size: 3rem; margin-bottom: var\(--space-4\);\"', '', content)
    content = re.sub(r'style=\"margin-bottom: var\(--space-2\);\"', '', content)
    content = re.sub(r'style=\"margin-bottom: var\(--space-4\);\"', '', content)

    with open("resources.html", "w") as f:
        f.write(content)

    
def update_menu():
    with open("menu.html", "r") as f:
        content = f.read()

    # Mini Hero
    content = re.sub(
        r'<section class=\"page-hero\"\s*style=\"[^\"]+\">\s*<div class=\"container fade-in-up\">\s*<h1 class=\"page-title\">([\s\S]*?)</h1>\s*<p class=\"page-subtitle text-muted\"\s*style=\"[^\"]+\">\s*([\s\S]*?)\s*</p>\s*</div>\s*</section>',
        '<section class="page-hero">\n            <div class="container fade-in-up">\n                <h1 class="page-title section-title">\\1</h1>\n                <p class="page-subtitle">\\2</p>\n            </div>\n        </section>',
        content
    )

    # Various inline replacements for menu
    content = re.sub(r'class=\"menu-section bg-cream\" style=\"[^\"]+\"', 'class="menu-section bg-cream"', content)
    content = re.sub(r'class=\"menu-grid\"\n\s*style=\"[^\"]+\"', 'class="menu-grid"', content)
    
    # Remove large inline from cards
    content = re.sub(r'class=\"menu-card\"\n\s*style=\"[^\"]+\"', 'class="menu-card fade-in-up delay-[INDEX]"', content)
    
    # We will manually do the index for delays below
    
    with open("menu.html", "w") as f:
        f.write(content)

update_policies()
update_resources()
update_menu()

print("Initial replacements done")
