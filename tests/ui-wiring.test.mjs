import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('UI modules parse as valid JavaScript on Node 22',()=>{
 for(const file of ['src/app.js','src/chart.js','src/ui-preferences.js','src/workspace-ui.js']){
  const r=spawnSync(process.execPath,['--check',new URL('../'+file,import.meta.url).pathname],{encoding:'utf8'});
  assert.equal(r.status,0,file+' parse failed: '+r.stderr);
 }
});
test('chart workspace DOM contains all interactive IDs required by UI upgrade',()=>{
 const html=read('index.html');
 for(const id of ['symbolFavoriteBtn','tfMoreBtn','chartSettingsBtn','favoritesBar','favoriteSymbols','favoriteTools','favoriteIndicators','favoritesManageBtn','rightbar','bottomPanel','chartLegend','watchRows']){
  assert.match(html,new RegExp('id="'+id+'"'),id+' not in index.html');
 }
 assert.match(html,/src\/ui-modern\.css/);
});
test('UI module imports are present and no fake chart data is introduced',()=>{
 const app=read('src/app.js');
 const ui=read('src/workspace-ui.js');
 const chart=read('src/chart.js');
 assert.match(app,/import \{mountWorkspaceUI\}/);
 assert.match(app,/ui\.install\(\)/);
 assert.match(app,/setRight\('watchlist',false\)/);
 assert.match(app,/ui\.favoriteCatalog\(q\)/);
 assert.match(app,/ui\.watchlistSettings/);
 assert.match(ui,/export function mountWorkspaceUI/);
 assert.match(ui,/chart\.setPreferences\(prefs\.settings\)/);
 assert.match(chart,/setPreferences\(prefs\)/);
 assert.doesNotMatch(ui,/accessToken|refreshToken|client_secret/i);
});
