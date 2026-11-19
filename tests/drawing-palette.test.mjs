import test from 'node:test';
import assert from 'node:assert/strict';
import {paletteGroups,canFavorite} from '../src/drawing-palette-model.js';
test('favorite category is empty initially; no invisible or unsupported tool appears',()=>{assert.deepEqual(paletteGroups('favorite','',[]),[]);assert.deepEqual(paletteGroups('favorite','',['horizontal','fibo']).flatMap(g=>g.items),['horizontal','fibo']);assert.equal(canFavorite('eraser'),false);assert.equal(canFavorite('horizontal'),true)});
test('search matches Indonesian and English labels across categories',()=>{assert.ok(paletteGroups('favorite','garis horizontal',[]).flatMap(g=>g.items).includes('horizontal'));assert.ok(paletteGroups('favorite','Horizontal line',[]).flatMap(g=>g.items).includes('horizontal'))});
