import sys

new_css = """
/* =========================================
   Policies Page & Global FAQ Styles
   ========================================= */

.page-hero {
    padding: var(--space-12) 0;
    text-align: center;
}

.page-hero .section-title {
    font-size: var(--text-4xl);
    margin-bottom: var(--space-4);
}

.page-hero .page-subtitle {
    font-size: var(--text-lg);
    color: var(--color-text-muted);
    max-width: 600px;
    margin: 0 auto;
}

/* FAQ Accordion (matching about.html but globally available) */
.faq-grid {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.faq-item {
    background-color: var(--color-bg-white);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    transition: all var(--transition-normal);
    border-left: 4px solid transparent;
}

.faq-item[open] {
    border-left-color: var(--color-accent);
    box-shadow: var(--shadow-md);
}

.faq-item summary {
    padding: var(--space-4) var(--space-6);
    cursor: pointer;
    font-weight: 600;
    color: var(--color-primary);
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.faq-item summary::-webkit-details-marker {
    display: none;
}

.faq-item summary::after {
    content: '+';
    font-size: var(--text-xl);
    font-weight: 300;
    transition: transform var(--transition-fast);
}

.faq-item[open] summary::after {
    transform: rotate(45deg);
    color: var(--color-accent);
}

.faq-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-top: 1px solid var(--color-border);
    color: var(--color-text-muted);
    padding: var(--space-4) var(--space-6);
    line-height: 1.6;
}

/* =========================================
   Menu Page Styles
   ========================================= */

.menu-section {
    padding: var(--space-12) 0;
}

.menu-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-8);
}

@media(min-width: 1024px) {
    .menu-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

.menu-card {
    background: var(--color-bg-white);
    padding: var(--space-8);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    transition: transform var(--transition-smooth), box-shadow var(--transition-smooth);
    position: relative;
    overflow: hidden;
}

.menu-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: var(--color-accent);
    transform: scaleX(0);
    transition: transform var(--transition-normal);
    transform-origin: left;
}

.menu-card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-lg);
    border-color: transparent;
}

.menu-card:hover::before {
    transform: scaleX(1);
}

.menu-card .menu-card-header {
    text-align: center;
    margin-bottom: var(--space-4);
}

.menu-card .menu-icon {
    font-size: 3rem;
    display: inline-block;
    margin-bottom: var(--space-3);
    padding: var(--space-3);
    background: var(--color-bg-cream);
    border-radius: 50%;
    transition: transform var(--transition-normal);
}

.menu-card:hover .menu-icon {
    transform: scale(1.1) rotate(5deg);
}

.menu-card h3 {
    margin-bottom: var(--space-2);
    font-size: var(--text-xl);
}

.menu-card .minimum-order {
    font-weight: 500;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    text-align: center;
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 1px;
}

.menu-card .starting-price {
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-accent-hover);
    margin-bottom: var(--space-6);
    text-align: center;
}

.menu-card .card-features {
    flex-grow: 1;
    margin-bottom: var(--space-6);
}

.menu-card .card-features ul {
    list-style: none;
}

.menu-card .card-features li {
    margin-bottom: var(--space-4);
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
}

.menu-card .card-features li .bullet {
    color: var(--color-accent);
    font-weight: bold;
    flex-shrink: 0;
    margin-top: 2px;
}

.design-tiers-section {
    padding: var(--space-12) 0;
}

.tiers-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-6);
    margin-top: var(--space-8);
}

@media(min-width: 768px) {
    .tiers-grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

.tier-card {
    background: var(--color-bg-cream);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-normal);
}

.tier-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
}

.fillings-section {
    padding: var(--space-12) 0;
}

.fillings-box {
    text-align: left;
    background: var(--color-bg-white);
    padding: var(--space-8);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    margin-top: var(--space-8);
}

.fillings-box li {
    margin-bottom: var(--space-4);
}

.notes-section {
    padding: var(--space-12) 0;
}

.notes-callout {
    background: var(--color-bg-white);
    border-left: 4px solid var(--color-accent);
    padding: var(--space-6) var(--space-8);
    border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
    box-shadow: var(--shadow-md);
    margin: var(--space-8) auto 0;
}

.notes-callout li {
    margin-bottom: var(--space-3);
    padding-left: var(--space-2);
}

/* =========================================
   Resources Page Styles
   ========================================= */

.resources-section {
    padding: var(--space-12) 0;
}

.resources-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-8);
}

@media(min-width: 768px) {
    .resources-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

.resource-card {
    background: var(--color-bg-white);
    padding: var(--space-12);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    text-align: center;
    transition: transform var(--transition-smooth), box-shadow var(--transition-smooth);
    display: flex;
    flex-direction: column;
    align-items: center;
}

.resource-card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-lg);
}

.resource-card .resource-icon {
    font-size: 4rem;
    margin-bottom: var(--space-6);
    line-height: 1;
    display: inline-block;
    padding: var(--space-4);
    background: var(--color-bg-cream);
    border-radius: 50%;
    transition: transform var(--transition-normal);
}

.resource-card:hover .resource-icon {
    transform: scale(1.1);
}

.resource-card h3 {
    margin-bottom: var(--space-4);
    font-size: var(--text-2xl);
}

.resource-card p {
    margin-bottom: var(--space-8);
    flex-grow: 1;
    font-size: var(--text-lg);
}
"""

with open("/Users/davebostik/Desktop/BBB Website/css/styles.css", "a") as f:
    f.write(new_css)

print("Appended styles successfully.")
