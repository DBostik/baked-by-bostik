#!/usr/bin/env python3
"""Builds ./site from the real admin files so the Costing screens render offline against the seed data.
Run from anywhere: python3 tools/costing-tests/harness/prepare.py ; then node tools/costing-tests/harness/run-phase2.js"""
import shutil, pathlib
here = pathlib.Path(__file__).resolve().parent
repo = here.parents[2]
site = here / 'site'
if site.exists(): shutil.rmtree(site)
(site / 'admin').mkdir(parents=True); (site / 'js').mkdir(); (site / 'stubs').mkdir()
for f in (repo / 'admin').glob('costing*'): shutil.copy(f, site / 'admin' / f.name)
shutil.copy(repo / 'admin' / 'admin.css', site / 'admin' / 'admin.css')
shutil.copy(repo / 'js' / 'firebase-config.js', site / 'js' / 'firebase-config.js')
for f in (here / 'stubs').glob('*.js'): shutil.copy(f, site / 'stubs' / f.name)
(site / 'vendor').mkdir()
shutil.copy(here / 'vendor' / 'chart.umd.js', site / 'vendor' / 'chart.umd.js')
s = (repo / 'admin' / 'index.html').read_text()
import re
s = re.sub(r'<script type="module" src="/admin/admin.js[^"]*"></script>', '', s)
s = s.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>', '<script src="/vendor/chart.umd.js"></script>')  # vendored copy so charts render offline
s = s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js"></script>', '')
im = """<script type="importmap">{"imports":{
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js":"/stubs/app.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js":"/stubs/auth.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js":"/stubs/firestore.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js":"/stubs/storage.js"}}</script>
<script>window.__HARNESS=true;document.addEventListener('DOMContentLoaded',()=>{document.getElementById('dashboard-view').classList.remove('hidden');document.getElementById('loading-overlay').style.display='none';document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.querySelectorAll('.page-section').forEach(p=>p.classList.add('hidden'));const t=document.getElementById('page-'+a.dataset.page);if(t)t.classList.remove('hidden');}));});</script>"""
s = s.replace('</head>', im + '\n</head>')
(site / 'admin' / 'index.html').write_text(s)
print('site built at', site)
