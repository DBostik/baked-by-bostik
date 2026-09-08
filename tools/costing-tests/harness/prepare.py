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
s = s.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js"></script>', '<script src="/vendor/chart.umd.js"></script>')  # vendored copy so charts render offline
s = s.replace('<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js"></script>', '')
im = """<script type="importmap">{"imports":{
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js":"/stubs/app.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js":"/stubs/auth.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js":"/stubs/firestore.js",
 "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js":"/stubs/storage.js"}}</script>
<script>window.__HARNESS=true;
// Phase 5 harness: a tiny stand-in for admin.js's quote modal (same ids, same row inputs, same listener behavior)
window.__quoteItems=[];window.resendQuote=function(id){window.__quoteFor=id;window.__quoteItems=[{name:'Cakes (1) - Pickup',qty:1,price:0}];document.getElementById('quote-modal').classList.remove('hidden');window.__renderQuote();};
window.__renderQuote=function(){const b=document.getElementById('quote-items-body');b.innerHTML='';window.__quoteItems.forEach((it,i)=>{const tr=document.createElement('tr');tr.innerHTML='<td><input class="q-name" value="'+it.name+'"></td><td><input class="q-qty" type="number" value="'+it.qty+'"></td><td><input class="q-price" type="number" value="'+it.price+'"></td><td class="q-row-total"></td><td><button class="btn-text">x</button></td>';const inp=tr.querySelectorAll('input');inp[0].addEventListener('input',e=>{it.name=e.target.value});inp[1].addEventListener('input',e=>{it.qty=Number(e.target.value)});inp[2].addEventListener('input',e=>{it.price=Number(e.target.value)});tr.querySelector('button').addEventListener('click',()=>{window.__quoteItems.splice(i,1);window.__renderQuote();});b.appendChild(tr);});};
document.addEventListener('DOMContentLoaded',()=>{const a=document.getElementById('btn-add-item');if(a)a.addEventListener('click',()=>{window.__quoteItems.push({name:'',qty:1,price:0});window.__renderQuote();});});document.addEventListener('DOMContentLoaded',()=>{document.getElementById('dashboard-view').classList.remove('hidden');document.getElementById('loading-overlay').style.display='none';document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.querySelectorAll('.page-section').forEach(p=>p.classList.add('hidden'));const t=document.getElementById('page-'+a.dataset.page);if(t)t.classList.remove('hidden');}));});</script>"""
s = s.replace('</head>', im + '\n</head>')
(site / 'admin' / 'index.html').write_text(s)
print('site built at', site)
