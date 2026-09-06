let apps=[]; export function initializeApp(c){const a={config:c};apps.push(a);return a;} export function getApps(){return apps;} export function getApp(){return apps[0];}
